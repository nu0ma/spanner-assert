import { readFile } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

import type { ExpectationsFile, TableExpectation } from './types.js';

export class InvalidExpectationFileError extends Error {
  constructor(message: string) {
    super(`期待値ファイルの形式が正しくありません: ${message}`);
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
    throw new InvalidExpectationFileError('ルートがオブジェクトではありません。');
  }

  if (!('tables' in parsed)) {
    throw new InvalidExpectationFileError('tablesセクションが見つかりません。');
  }

  const tables = (parsed as { tables: unknown }).tables;

  if (!tables || typeof tables !== 'object') {
    throw new InvalidExpectationFileError('tablesがオブジェクトではありません。');
  }

  const normalizedTables: Record<string, TableExpectation> = {};

  for (const [tableName, expectation] of Object.entries(tables as Record<string, unknown>)) {
    if (!expectation || typeof expectation !== 'object') {
      throw new InvalidExpectationFileError(`${tableName}の定義がオブジェクトではありません。`);
    }

    const { count, columns, ...rest } = expectation as TableExpectation & Record<string, unknown>;

    if (count !== undefined && typeof count !== 'number') {
      throw new InvalidExpectationFileError(`${tableName}.countは数値である必要があります。`);
    }

    if (columns !== undefined && (typeof columns !== 'object' || Array.isArray(columns))) {
      throw new InvalidExpectationFileError(`${tableName}.columnsはオブジェクトである必要があります。`);
    }

    const unexpectedKeys = Object.keys(rest);
    if (unexpectedKeys.length > 0) {
      throw new InvalidExpectationFileError(
        `${tableName}に未対応のキー(${unexpectedKeys.join(', ')})があります。`,
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
