import { assertExpectations } from "./assertion.ts";
import { resolveConnectionConfig } from "./config.ts";
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
  const dbHandle = openDatabase(config);

  const assert = async (expectations: ExpectationsFile): Promise<void> => {
    await assertExpectations(dbHandle.database, expectations);
  };

  const close = async (): Promise<void> => {
    await dbHandle.close();
  };

  const getConnectionInfo = (): SpannerConnectionConfig => ({
    ...config,
  });

  return {
    assert,
    close,
    getConnectionInfo,
  };
}
