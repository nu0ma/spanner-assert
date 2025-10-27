import type { Database } from "@google-cloud/spanner";
import { consola } from "consola";

import { SpannerAssertionError } from "./errors.ts";
import {
  fetchAllRows,
  fetchCount,
  findMissingRows,
  quoteIdentifier,
} from "./fetch.ts";
import type {
  ExpectationsFile,
  TableColumnExpectations,
  TableExpectation,
} from "./types.ts";

export async function assertExpectations(
  database: Database,
  expectations: ExpectationsFile
): Promise<void> {
  for (const [tableName, expectation] of Object.entries(expectations.tables)) {
    await assertTable(database, tableName, expectation);
  }
}

type AssertionType = "count" | "rows";

async function assertTable(
  database: Database,
  tableName: string,
  expectation: TableExpectation
): Promise<void> {
  const quotedTableName = quoteIdentifier(tableName);

  if (expectation.rows) {
    if (expectation.rows.length === 0) {
      consola.error(
        `Invalid expectation: rows array cannot be empty in table "${tableName}".`
      );
      throw new SpannerAssertionError(
        `Invalid expectation: rows array cannot be empty in table "${tableName}".`,
        { table: tableName }
      );
    }

    if (
      typeof expectation.count === "number" &&
      expectation.rows.length > expectation.count
    ) {
      consola.error(
        `Invalid expectation: specified ${expectation.rows.length} rows but count is ${expectation.count} in table "${tableName}".`
      );
      throw new SpannerAssertionError(
        `Invalid expectation: specified ${expectation.rows.length} rows but count is ${expectation.count} in table "${tableName}".`,
        {
          table: tableName,
          rowsCount: expectation.rows.length,
          expectedCount: expectation.count,
        }
      );
    }
  }

  const assertionTypes: AssertionType[] = [];
  if (typeof expectation.count === "number") {
    assertionTypes.push("count");
  }
  if (expectation.rows) {
    assertionTypes.push("rows");
  }

  for (const type of assertionTypes) {
    switch (type) {
      case "count":
        await assertRowCount(
          database,
          tableName,
          quotedTableName,
          expectation.count as number
        );
        break;

      case "rows":
        await assertRows(
          database,
          tableName,
          quotedTableName,
          expectation.rows as TableColumnExpectations[]
        );
        break;

      default: {
        const exhaustiveCheck: never = type;
        throw new Error(`Unknown assertion type: ${exhaustiveCheck}`);
      }
    }
  }
}

async function assertRowCount(
  database: Database,
  tableName: string,
  quotedTableName: string,
  expectedCount: number
): Promise<void> {
  const actualCount = await fetchCount(database, quotedTableName);
  if (actualCount !== expectedCount) {
    consola.error(`Row count mismatch in table "${tableName}".`);
    throw new SpannerAssertionError(
      `Row count mismatch in table "${tableName}".`,
      {
        table: tableName,
        expected: expectedCount,
        actual: actualCount,
      }
    );
  }
}

async function assertRows(
  database: Database,
  tableName: string,
  quotedTableName: string,
  expectedRows: TableColumnExpectations[]
): Promise<void> {
  const actualRows = await fetchAllRows(database, quotedTableName, expectedRows);
  const missingRows = findMissingRows(expectedRows, actualRows);

  if (missingRows.length > 0) {
    consola.error(
      `${missingRows.length} expected row(s) not found in table "${tableName}".`
    );
    throw new SpannerAssertionError(
      `${missingRows.length} expected row(s) not found in table "${tableName}".`,
      {
        table: tableName,
        expected: expectedRows,
        actual: actualRows,
      }
    );
  }
}
