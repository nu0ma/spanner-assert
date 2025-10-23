import { readFile } from "node:fs/promises";
import path from "node:path";

import yaml from "js-yaml";

import type {
  ColumnValue,
  ExpectationsFile,
  TableExpectation,
} from "./types.ts";

export class InvalidExpectationFileError extends Error {
  constructor(message: string) {
    super(`Expectation file format is invalid: ${message}`);
    this.name = "InvalidExpectationFileError";
  }
}

export type LoadExpectationOptions = {
  baseDir?: string;
};

export async function loadExpectationsFromFile(
  expectedPath: string,
  options: LoadExpectationOptions = {}
): Promise<ExpectationsFile> {
  const normalizedPath = path.isAbsolute(expectedPath)
    ? expectedPath
    : path.join(options.baseDir ?? process.cwd(), expectedPath);
  const raw = await readFile(normalizedPath, "utf8");
  const parsed = yaml.load(raw);

  if (!parsed || typeof parsed !== "object") {
    throw new InvalidExpectationFileError("Root value must be an object.");
  }

  if (!("tables" in parsed)) {
    throw new InvalidExpectationFileError("Missing tables section.");
  }

  const tables = (parsed as { tables: unknown }).tables;

  if (!tables || typeof tables !== "object") {
    throw new InvalidExpectationFileError("tables must be an object.");
  }

  const normalizedTables: Record<string, TableExpectation> = {};

  for (const [tableName, expectation] of Object.entries(
    tables as Record<string, unknown>
  )) {
    if (!expectation || typeof expectation !== "object") {
      throw new InvalidExpectationFileError(
        `${tableName} definition must be an object.`
      );
    }

    const { count, rows, ...rest } = expectation as TableExpectation &
      Record<string, unknown>;

    if (count !== undefined && typeof count !== "number") {
      throw new InvalidExpectationFileError(
        `${tableName}.count must be numeric.`
      );
    }

    if (rows !== undefined && !Array.isArray(rows)) {
      throw new InvalidExpectationFileError(
        `${tableName}.rows must be an array.`
      );
    }

    if (rows) {
      if (rows.length === 0) {
        throw new InvalidExpectationFileError(
          `${tableName}.rows cannot be an empty array.`
        );
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || typeof row !== "object" || Array.isArray(row)) {
          throw new InvalidExpectationFileError(
            `${tableName}.rows[${i}] must be an object.`
          );
        }
        validateColumnValues(
          `${tableName}.rows[${i}]`,
          row as Record<string, unknown>
        );
      }
    }

    const unexpectedKeys = Object.keys(rest);
    if (unexpectedKeys.length > 0) {
      throw new InvalidExpectationFileError(
        `${tableName} contains unsupported keys: ${unexpectedKeys.join(", ")}`
      );
    }

    normalizedTables[tableName] = {
      ...(count !== undefined ? { count } : {}),
      ...(rows !== undefined ? { rows } : {}),
    };
  }

  return {
    tables: normalizedTables,
  };
}

function validateColumnValues(
  context: string,
  columns: Record<string, unknown>
): void {
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
