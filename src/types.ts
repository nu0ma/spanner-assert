export type ColumnValue = string | number | boolean | null | (string | number | boolean | null)[];

export type TableColumnExpectations = Record<string, ColumnValue>;

export type TableExpectation = {
  count?: number;
  rows: TableColumnExpectations[];
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
  close(): Promise<void>;
  getConnectionInfo(): SpannerConnectionConfig;
};
