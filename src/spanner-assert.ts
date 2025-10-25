import { assertExpectations } from "./assertion.ts";
import { resolveConnectionConfig } from "./config.ts";
import { loadExpectationsFromFile } from "./expectation-loader.ts";
import { openDatabase } from "./spanner-client.ts";
import type {
  SpannerConnectionConfig,
  SpannerAssertOptions,
  SpannerAssertInstance,
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
  const dbHandle = openDatabase(config);

  const assert = async (expectedFile: string): Promise<void> => {
    const expectations = await loadExpectationsFromFile(expectedFile);

    try {
      await assertExpectations(dbHandle.database, expectations);
    } finally {
      await dbHandle.close();
    }
  };

  const getConnectionInfo = (): SpannerConnectionConfig => ({
    ...config,
  });

  return {
    assert,
    getConnectionInfo,
  };
}
