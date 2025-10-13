import type { SpannerClientDependencies } from "./spanner-client.js";

export type ColumnValue = string | number | boolean | null;

export type TableColumnExpectations = Record<string, ColumnValue>;

export type TableExpectation = {
  count?: number;
  columns?: TableColumnExpectations;
};

export type ExpectationsFile = {
  tables: Record<string, TableExpectation>;
};

export type SpannerConnectionConfig = {
  projectId: string;
  instanceId: string;
  databaseId: string;
  emulatorHost?: string;
};

export type ResolvedSpannerConnectionConfig = SpannerConnectionConfig;

export type SpannerAssertOptions = {
  connection?: Partial<SpannerConnectionConfig>;
  clientDependencies?: SpannerClientDependencies;
};

export type AssertOptions = {
  connection?: Partial<SpannerConnectionConfig>;
  baseDir?: string;
};

export type SpannerAssertInstance = {
  assert(expectedFile: string, options?: AssertOptions): Promise<void>;
  assertExpectations(
    expectations: ExpectationsFile,
    options?: AssertOptions,
  ): Promise<void>;
};
