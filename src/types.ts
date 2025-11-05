/**
 * Supported column value types:
 * - Primitives: string, number, boolean, null, undefined
 * - Arrays: Arrays of any values (for ARRAY<T> and JSON columns)
 * - Objects: Nested objects (for JSON columns)
 *
 * This recursive type definition supports unlimited nesting depth.
 * Note: undefined is included for TypeScript type inference compatibility
 * (e.g., when importing JSON files with optional properties in union types).
 * At runtime, undefined values are treated the same as null.
 */
export type ColumnValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ColumnValue[]
  | { [key: string]: ColumnValue };

export type TableColumnExpectations = Record<string, ColumnValue>;

export type TableExpectation = {
  count?: number;
  rows?: TableColumnExpectations[];
};

export type ExpectationsFile = {
  tables: Record<string, TableExpectation>;
};

export type SpannerConnectionConfig = {
  projectId: string;
  instanceId: string;
  databaseId: string;
  emulatorHost: string;
};

export type SpannerAssertOptions = {
  connection: SpannerConnectionConfig
};

export type SpannerAssertInstance = {
  assert(expectations: ExpectationsFile): Promise<void>;
  getConnectionInfo(): SpannerConnectionConfig;
  resetDatabase(tableNames: string[]): Promise<void>;
};
