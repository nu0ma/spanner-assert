import { readFile } from "node:fs/promises";
import path from "node:path";

import yaml from "js-yaml";

import { InvalidExpectationFileError } from "./errors.ts";
import type {
  ColumnValue,
  ExpectationsFile,
  TableColumnExpectations,
  TableExpectation,
} from "./types.ts";

export type LoadExpectationOptions = {
  baseDir?: string;
};

export async function loadExpectationsFromFile(
  expectedPath: string,
  options: LoadExpectationOptions = {}
): Promise<ExpectationsFile> {
  const filePath = resolveFilePath(expectedPath, options.baseDir);
  const raw = await readFile(filePath, "utf8");
  const parsed = yaml.load(raw);

  return parseExpectationsFile(parsed);
}

function resolveFilePath(expectedPath: string, baseDir?: string): string {
  if (path.isAbsolute(expectedPath)) {
    return expectedPath;
  }
  return path.join(baseDir ?? process.cwd(), expectedPath);
}

function parseExpectationsFile(parsed: unknown): ExpectationsFile {
  if (!isObject(parsed)) {
    throw new InvalidExpectationFileError("Root value must be an object.");
  }

  if (!("tables" in parsed)) {
    throw new InvalidExpectationFileError("Missing tables section.");
  }

  if (!isObject(parsed.tables)) {
    throw new InvalidExpectationFileError("tables must be an object.");
  }

  const normalizedTables: Record<string, TableExpectation> = {};

  for (const [tableName, expectation] of Object.entries(parsed.tables)) {
    normalizedTables[tableName] = validateTableExpectation(
      tableName,
      expectation
    );
  }

  return {
    tables: normalizedTables,
  };
}

function validateTableExpectation(
  tableName: string,
  expectation: unknown
): TableExpectation {
  if (!isObject(expectation)) {
    throw new InvalidExpectationFileError(
      `${tableName} definition must be an object.`
    );
  }

  const { count, rows, ...rest } = expectation;

  // Validate count
  if (count !== undefined && typeof count !== "number") {
    throw new InvalidExpectationFileError(
      `${tableName}.count must be numeric.`
    );
  }

  // Validate rows
  if (rows !== undefined && !Array.isArray(rows)) {
    throw new InvalidExpectationFileError(
      `${tableName}.rows must be an array.`
    );
  }

  if (rows) {
    validateRows(tableName, rows);
  }

  // Check for unexpected keys
  const unexpectedKeys = Object.keys(rest);
  if (unexpectedKeys.length > 0) {
    throw new InvalidExpectationFileError(
      `${tableName} contains unsupported keys: ${unexpectedKeys.join(", ")}`
    );
  }

  return {
    rows: rows ?? [],
    ...(count !== undefined ? { count } : {}),
  };
}

function validateRows(
  tableName: string,
  rows: unknown[]
): asserts rows is TableColumnExpectations[] {
  if (rows.length === 0) {
    throw new InvalidExpectationFileError(
      `${tableName}.rows cannot be an empty array.`
    );
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (!isObject(row) || Array.isArray(row)) {
      throw new InvalidExpectationFileError(
        `${tableName}.rows[${i}] must be an object.`
      );
    }

    validateColumnValues(`${tableName}.rows[${i}]`, row);
  }
}

function validateColumnValues(
  context: string,
  columns: Record<string, unknown>
): asserts columns is TableColumnExpectations {
  for (const [columnName, value] of Object.entries(columns)) {
    if (!isSupportedColumnValue(value)) {
      const actualType = value === null ? "null" : typeof value;
      throw new InvalidExpectationFileError(
        `${context}.${columnName} must be a string, number, boolean, or null (received ${actualType}).`
      );
    }
  }
}

function isSupportedColumnValue(value: unknown): value is ColumnValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
