import type { Database } from "@google-cloud/spanner";
import { consola } from "consola";

import { SpannerAssertionError } from "./errors.ts";
import type { ColumnValue, TableColumnExpectations } from "./types.ts";

const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

type QueryRequest = {
  sql: string;
  params?: Record<string, ColumnValue>;
};

async function executeQuery(
  database: Database,
  query: QueryRequest
): Promise<Record<string, unknown>[]> {
  const [rows] = await database.run(query);
  return rows.map((row) => row.toJSON());
}

function buildQueryRequest(
  sql: string,
  params?: Record<string, ColumnValue>
): QueryRequest {
  const query: QueryRequest = { sql };

  if (params && Object.keys(params).length > 0) {
    query.params = params;
  }

  return query;
}

export async function fetchCount(
  database: Database,
  quotedTableName: string,
  conditions?: TableColumnExpectations
): Promise<number> {
  const { whereClause, params } = buildWhereClause(conditions);

  const sql = `SELECT COUNT(*) AS total FROM ${quotedTableName}${whereClause}`;
  const query = buildQueryRequest(sql, params);

  const rows = await executeQuery(database, query);
  if (!rows.length) {
    return 0;
  }

  return normalizeNumericValue(rows[0].total);
}

export async function fetchAllRows(
  database: Database,
  quotedTableName: string,
  expectedRows: TableColumnExpectations[]
): Promise<Record<string, unknown>[]> {
  const columns = new Set<string>();
  for (const row of expectedRows) {
    for (const col of Object.keys(row)) {
      columns.add(col);
    }
  }

  const columnList = Array.from(columns).map(quoteIdentifier).join(", ");
  const sql = `SELECT ${columnList} FROM ${quotedTableName}`;
  const query = buildQueryRequest(sql);

  return executeQuery(database, query);
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

    // Treat objects and arrays as JSON values (enables subset matching and order-insensitive comparison)
    // This applies to both JSON columns and ARRAY<T> columns for consistency
    const treatAsJson =
      isPlainObject(expectedValue) || Array.isArray(expectedValue);
    if (!valuesMatch(expectedValue, actualValue, treatAsJson)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a value is a plain object (not null, not an array)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Compare two arrays with order-insensitive matching.
 * Each element in expected must have a matching element in actual.
 */
function arraysMatchUnordered(
  expected: unknown[],
  actual: unknown[],
  insideJson: boolean
): boolean {
  if (expected.length !== actual.length) return false;

  // Create a copy to track which actual elements have been matched
  const remaining = [...actual];

  for (const expectedElement of expected) {
    const index = remaining.findIndex((actualElement) =>
      valuesMatch(expectedElement, actualElement, insideJson)
    );

    if (index === -1) return false;
    remaining.splice(index, 1);
  }

  return true;
}

/**
 * Compare two values for equality.
 * - Primitives: strict equality
 * - Arrays (ARRAY<T> columns): order-sensitive comparison
 * - Arrays (inside JSON): order-insensitive comparison
 * - Objects (JSON): subset matching (only checks keys present in expected)
 *
 * @param expected - The expected value from the test expectation
 * @param actual - The actual value from the database
 * @param insideJson - Whether we're currently inside a JSON value context
 */
function valuesMatch(
  expected: unknown,
  actual: unknown,
  insideJson = false
): boolean {
  // Handle null and undefined values (treat undefined as null)
  if (expected === null || expected === undefined) {
    return actual === null || actual === undefined;
  }

  // Handle JSON objects (subset matching)
  if (isPlainObject(expected)) {
    if (!isPlainObject(actual)) return false;

    // Subset matching: only check keys present in expected
    for (const [key, expectedValue] of Object.entries(expected)) {
      if (!valuesMatch(expectedValue, actual[key], true)) {
        return false;
      }
    }
    return true;
  }

  // Handle arrays
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;

    if (insideJson) {
      // Order-insensitive comparison for arrays inside JSON
      return arraysMatchUnordered(expected, actual, insideJson);
    } else {
      // Order-sensitive comparison for ARRAY<T> columns
      if (expected.length !== actual.length) return false;

      for (let i = 0; i < expected.length; i++) {
        if (!valuesMatch(expected[i], actual[i], insideJson)) {
          return false;
        }
      }
      return true;
    }
  }

  // Handle primitive values
  return expected === actual;
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

  consola.error("Failed to convert value to a numeric type.");
  throw new SpannerAssertionError(
    "Failed to convert value to a numeric type.",
    {
      value,
    }
  );
}

export function quoteIdentifier(identifier: string): string {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    consola.error("Identifier contains unsupported characters.");
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
