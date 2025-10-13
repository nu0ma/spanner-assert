import type { Database } from "@google-cloud/spanner";

import { SpannerAssertionError } from "./errors.ts";
import type {
  ColumnValue,
  ExpectationsFile,
  TableColumnExpectations,
  TableExpectation,
} from "./types.ts";

const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

type QueryRequest = {
  sql: string;
  params?: Record<string, ColumnValue>;
};

export async function assertExpectations(
  database: Database,
  expectations: ExpectationsFile,
): Promise<void> {
  for (const [tableName, expectation] of Object.entries(expectations.tables)) {
    await assertTable(database, tableName, expectation);
  }
}

async function assertTable(
  database: Database,
  tableName: string,
  expectation: TableExpectation,
): Promise<void> {
  const quotedTableName = quoteIdentifier(tableName);

  if (typeof expectation.count === "number") {
    const actualCount = await fetchCount(database, quotedTableName);
    if (actualCount !== expectation.count) {
      throw new SpannerAssertionError(
        `Row count mismatch detected for ${tableName}.`,
        {
          expected: expectation.count,
          actual: actualCount,
          table: tableName,
        },
      );
    }
  }

  if (expectation.columns) {
    const matchedCount = await fetchCount(
      database,
      quotedTableName,
      expectation.columns,
    );
    if (matchedCount === 0) {
      throw new SpannerAssertionError(
        `No rows matched the expected column values in ${tableName}.`,
        {
          table: tableName,
          columns: expectation.columns,
        },
      );
    }
  }
}

async function fetchCount(
  database: Database,
  quotedTableName: string,
  conditions?: TableColumnExpectations,
): Promise<number> {
  const { whereClause, params } = buildWhereClause(conditions);

  const query: QueryRequest = {
    sql: `SELECT COUNT(*) AS total FROM ${quotedTableName}${whereClause}`,
  };

  if (params && Object.keys(params).length > 0) {
    query.params = params;
  }

  const [rows] = await database.run(query);
  if (!rows.length) {
    return 0;
  }

  return normalizeNumericValue(rows[0].toJSON().total);
}

function normalizeNumericValue(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  throw new SpannerAssertionError(
    "Failed to convert value to a numeric type.",
    {
      value,
    },
  );
}

function quoteIdentifier(identifier: string): string {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new SpannerAssertionError(
      "Identifier contains unsupported characters.",
      {
        identifier,
      },
    );
  }

  return `\`${identifier}\``;
}

function buildWhereClause(conditions?: TableColumnExpectations): {
  whereClause: string;
  params: Record<string, ColumnValue>;
} {
  if (!conditions || Object.keys(conditions).length === 0) {
    return { whereClause: "", params: {} };
  }

  const clauses: string[] = [];
  const params: Record<string, ColumnValue> = {};
  let index = 0;

  for (const [column, value] of Object.entries(conditions)) {
    if (value === null) {
      clauses.push(`${quoteIdentifier(column)} IS NULL`);
      continue;
    }

    const paramName = `p${index++}`;
    clauses.push(`${quoteIdentifier(column)} = @${paramName}`);
    params[paramName] = value;
  }

  const whereClause =
    clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
  return { whereClause, params };
}
