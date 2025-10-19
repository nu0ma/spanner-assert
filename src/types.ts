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
  connection: SpannerConnectionConfig;
};

export type SpannerAssertInstance = {
  assert(expectedFile: string): Promise<void>;
  assertExpectations(expectations: ExpectationsFile): Promise<void>;
  getConnectionInfo(): ResolvedSpannerConnectionConfig;
};
