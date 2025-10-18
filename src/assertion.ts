import type { Database } from "@google-cloud/spanner";

import { SpannerAssertionError } from "./errors.ts";
import type {
  ExpectationsFile,
  TableColumnExpectations,
  TableExpectation,
} from "./types.ts";
import { fetchCount, fetchRows, quoteIdentifier } from "./utils.ts";

export async function assertExpectations(
  database: Database,
  expectations: ExpectationsFile
): Promise<void> {
  for (const [tableName, expectation] of Object.entries(expectations.tables)) {
    await assertTable(database, tableName, expectation);
  }
}

type AssertionType = "count" | "columns";

async function assertTable(
  database: Database,
  tableName: string,
  expectation: TableExpectation
): Promise<void> {
  const quotedTableName = quoteIdentifier(tableName);

  const assertionTypes: AssertionType[] = [];
  if (typeof expectation.count === "number") {
    assertionTypes.push("count");
  }
  if (expectation.columns) {
    assertionTypes.push("columns");
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

      case "columns":
        await assertColumnValues(
          database,
          tableName,
          quotedTableName,
          expectation.columns as TableColumnExpectations
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

async function assertColumnValues(
  database: Database,
  tableName: string,
  quotedTableName: string,
  columns: TableColumnExpectations
): Promise<void> {
  const matchedCount = await fetchCount(database, quotedTableName, columns);
  if (matchedCount === 0) {
    // Fetch actual data to show in error message
    const actualRows = await fetchRows(database, quotedTableName, 5);
    throw new SpannerAssertionError(
      `No rows matched the expected column values in table "${tableName}".`,
      {
        table: tableName,
        expected: columns,
        actual: actualRows.length > 0 ? actualRows : "No rows found in table",
      }
    );
  }
}
