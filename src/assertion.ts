import type { Database, ExecuteSqlRequest } from '@google-cloud/spanner';

import { SpannerAssertionError } from './errors.js';
import type { ExpectationsFile, TableExpectation } from './types.js';

const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

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

  if (typeof expectation.count === 'number') {
    const actualCount = await fetchCount(database, quotedTableName);
    if (actualCount !== expectation.count) {
      throw new SpannerAssertionError(`Row count mismatch detected for ${tableName}.`, {
        expected: expectation.count,
        actual: actualCount,
        table: tableName,
      });
    }
  }

  if (expectation.columns) {
    const matchedCount = await fetchMatchCount(database, quotedTableName, expectation.columns);
    if (matchedCount === 0) {
      throw new SpannerAssertionError(`No rows matched the expected column values in ${tableName}.`, {
        table: tableName,
        columns: expectation.columns,
      });
    }
  }
}

async function fetchCount(database: Database, quotedTableName: string): Promise<number> {
  const query: ExecuteSqlRequest = {
    sql: `SELECT COUNT(*) AS total FROM ${quotedTableName}`,
  };
  const [rows] = await database.run(query);
  if (!rows.length) {
    return 0;
  }

  return normalizeNumericValue(rows[0].toJSON().total);
}

async function fetchMatchCount(
  database: Database,
  quotedTableName: string,
  conditions: Record<string, unknown>,
): Promise<number> {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  let index = 0;

  for (const [column, value] of Object.entries(conditions)) {
    const paramName = `p${index++}`;
    clauses.push(`${quoteIdentifier(column)} = @${paramName}`);
    params[paramName] = value;
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const query: ExecuteSqlRequest = {
    sql: `SELECT COUNT(*) AS total FROM ${quotedTableName} ${whereClause}`,
    params,
  };

  const [rows] = await database.run(query);
  if (!rows.length) {
    return 0;
  }

  return normalizeNumericValue(rows[0].toJSON().total);
}

function normalizeNumericValue(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  throw new SpannerAssertionError('Failed to convert value to a numeric type.', {
    value,
  });
}

function quoteIdentifier(identifier: string): string {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new SpannerAssertionError('Identifier contains unsupported characters.', {
      identifier,
    });
  }

  return `\`${identifier}\``;
}
