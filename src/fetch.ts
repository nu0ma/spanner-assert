import type { Database } from "@google-cloud/spanner";

import { SpannerAssertionError } from "./errors.ts";
import type { ColumnValue, TableColumnExpectations } from "./types.ts";

const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

type QueryRequest = {
  sql: string;
  params?: Record<string, ColumnValue>;
};

export async function fetchCount(
  database: Database,
  quotedTableName: string,
  conditions?: TableColumnExpectations
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

export async function fetchRows(
  database: Database,
  quotedTableName: string,
  limit: number
): Promise<Record<string, unknown>[]> {
  const query: QueryRequest = {
    sql: `SELECT * FROM ${quotedTableName} LIMIT ${limit}`,
  };

  const [rows] = await database.run(query);
  return rows.map((row) => row.toJSON());
}

export async function fetchAllRows(
  database: Database,
  quotedTableName: string,
  columns: string[]
): Promise<Record<string, unknown>[]> {
  const columnList = columns.map(quoteIdentifier).join(", ");
  const query: QueryRequest = {
    sql: `SELECT ${columnList} FROM ${quotedTableName}`,
  };

  const [rows] = await database.run(query);
  return rows.map((row) => row.toJSON());
}

export function buildSelectColumns(rows: TableColumnExpectations[]): string[] {
  const columns = new Set<string>();
  for (const row of rows) {
    for (const col of Object.keys(row)) {
      columns.add(col);
    }
  }
  return Array.from(columns);
}

export function findMissingRows(
  expectedRows: TableColumnExpectations[],
  actualRows: Record<string, unknown>[]
): TableColumnExpectations[] {
  const missing: TableColumnExpectations[] = [];
  const remainingActual = [...actualRows];

  for (const expected of expectedRows) {
    const index = remainingActual.findIndex((actual) =>
      rowMatches(expected, actual)
    );

    if (index === -1) {
      missing.push(expected);
    } else {
      remainingActual.splice(index, 1);
    }
  }

  return missing;
}

function rowMatches(
  expected: TableColumnExpectations,
  actual: Record<string, unknown>
): boolean {
  for (const [column, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[column];

    if (expectedValue === null) {
      if (actualValue !== null) return false;
    } else {
      if (actualValue !== expectedValue) return false;
    }
  }
  return true;
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
    }
  );
}

export function quoteIdentifier(identifier: string): string {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new SpannerAssertionError(
      "Identifier contains unsupported characters.",
      {
        identifier,
      }
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
