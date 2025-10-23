import { readFile } from "node:fs/promises";
import path from "node:path";

import yaml from "js-yaml";

import { InvalidExpectationFileError } from "./errors.ts";
import type { ExpectationsFile } from "./types.ts";

export type LoadExpectationOptions = {
  baseDir?: string;
};

export async function loadExpectationsFromFile(
  expectedPath: string,
  options: LoadExpectationOptions = {}
): Promise<ExpectationsFile> {
  const filePath = path.isAbsolute(expectedPath)
    ? expectedPath
    : path.join(options.baseDir ?? process.cwd(), expectedPath);

  const raw = await readFile(filePath, "utf8");
  const parsed = yaml.load(raw);

  if (!parsed || typeof parsed !== "object" || !("tables" in parsed)) {
    throw new InvalidExpectationFileError("Invalid expectation file format");
  }

  return parsed as ExpectationsFile;
}
