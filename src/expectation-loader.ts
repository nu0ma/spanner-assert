import { readFile } from 'node:fs/promises';
import path from 'node:path';

import yaml from 'js-yaml';

import type { ExpectationsFile, TableExpectation } from './types.js';

export class InvalidExpectationFileError extends Error {
  constructor(message: string) {
    super(`Expectation file format is invalid: ${message}`);
    this.name = 'InvalidExpectationFileError';
  }
}

export type LoadExpectationOptions = {
  baseDir?: string;
};

export async function loadExpectationsFromFile(
  expectedPath: string,
  options: LoadExpectationOptions = {},
): Promise<ExpectationsFile> {
  const normalizedPath = path.isAbsolute(expectedPath)
    ? expectedPath
    : path.join(options.baseDir ?? process.cwd(), expectedPath);
  const raw = await readFile(normalizedPath, 'utf8');
  const parsed = yaml.load(raw);

  if (!parsed || typeof parsed !== 'object') {
    throw new InvalidExpectationFileError('Root value must be an object.');
  }

  if (!('tables' in parsed)) {
    throw new InvalidExpectationFileError('Missing tables section.');
  }

  const tables = (parsed as { tables: unknown }).tables;

  if (!tables || typeof tables !== 'object') {
    throw new InvalidExpectationFileError('tables must be an object.');
  }

  const normalizedTables: Record<string, TableExpectation> = {};

  for (const [tableName, expectation] of Object.entries(tables as Record<string, unknown>)) {
    if (!expectation || typeof expectation !== 'object') {
      throw new InvalidExpectationFileError(`${tableName} definition must be an object.`);
    }

    const { count, columns, ...rest } = expectation as TableExpectation & Record<string, unknown>;

    if (count !== undefined && typeof count !== 'number') {
      throw new InvalidExpectationFileError(`${tableName}.count must be numeric.`);
    }

    if (columns !== undefined && (typeof columns !== 'object' || Array.isArray(columns))) {
      throw new InvalidExpectationFileError(`${tableName}.columns must be an object.`);
    }

    const unexpectedKeys = Object.keys(rest);
    if (unexpectedKeys.length > 0) {
      throw new InvalidExpectationFileError(
        `${tableName} contains unsupported keys: ${unexpectedKeys.join(', ')}`,
      );
    }

    normalizedTables[tableName] = {
      ...(count !== undefined ? { count } : {}),
      ...(columns !== undefined ? { columns } : {}),
    };
  }

  return {
    tables: normalizedTables,
  };
}
