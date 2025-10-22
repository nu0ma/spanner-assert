import type { Database } from "@google-cloud/spanner";

import { SpannerAssertionError } from "./errors.ts";
import type {
  ExpectationsFile,
  TableColumnExpectations,
  TableExpectation,
} from "./types.ts";
import {
  buildSelectColumns,
  fetchAllRows,
  fetchCount,
  fetchRows,
  findMissingRows,
  quoteIdentifier,
} from "./fetch.ts";

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
      throw new SpannerAssertionError(
        `Invalid expectation: rows array cannot be empty in table "${tableName}".`,
        { table: tableName }
      );
    }

    if (
      typeof expectation.count === "number" &&
      expectation.rows.length > expectation.count
    ) {
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
  const columns = buildSelectColumns(expectedRows);
  const actualRows = await fetchAllRows(database, quotedTableName, columns);
  const missingRows = findMissingRows(expectedRows, actualRows);

  if (missingRows.length > 0) {
    const missingRowsText = missingRows
      .map((row, index) => `    ${index + 1}. ${JSON.stringify(row)}`)
      .join("\n");

    const actualRowsPreview = actualRows
      .slice(0, 5)
      .map((row, index) => `    ${index + 1}. ${JSON.stringify(row)}`)
      .join("\n");

    const totalActualRows = actualRows.length;
    const actualRowsText =
      actualRowsPreview +
      (totalActualRows > 5 ? `\n    ... (${totalActualRows - 5} more rows)` : "");

    throw new SpannerAssertionError(
      `${missingRows.length} expected row(s) not found in table "${tableName}".\n` +
        `  Missing rows:\n${missingRowsText}\n\n` +
        `  Actual rows (showing first 5 of ${totalActualRows} total):\n${actualRowsText}`,
      {
        table: tableName,
        missingRows,
        actualRowsCount: totalActualRows,
      }
    );
  }
}
