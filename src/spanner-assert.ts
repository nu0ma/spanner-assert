import { assertExpectations } from "./assertion.ts";
import { resolveConnectionConfig } from "./config.ts";
import { resetDatabase } from "./reset.ts";
import { openDatabase } from "./spanner-client.ts";
import type {
  SpannerConnectionConfig,
  SpannerAssertOptions,
  SpannerAssertInstance,
  ExpectationsFile,
} from "./types.ts";

export function createSpannerAssert(
  options: SpannerAssertOptions
): SpannerAssertInstance {
  const config = resolveConnectionConfig({
    projectId: options.connection.projectId,
    instanceId: options.connection.instanceId,
    databaseId: options.connection.databaseId,
    emulatorHost: options.connection.emulatorHost,
  });

  const assert = async (expectations: ExpectationsFile): Promise<void> => {
    const dbHandle = openDatabase(config);
    try {
      await assertExpectations(dbHandle.database, expectations);
    } finally {
      await dbHandle.close();
    }
  };

  const reset = async (tableNames: string[]): Promise<void> => {
    const dbHandle = openDatabase(config);
    try {
      await resetDatabase(dbHandle.database, tableNames);
    } finally {
      await dbHandle.close();
    }
  };

  const getConnectionInfo = (): SpannerConnectionConfig => ({
    ...config,
  });

  return {
    assert,
    reset,
    getConnectionInfo,
  };
}
