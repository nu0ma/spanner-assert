import { assertExpectations } from "./assertion.ts";
import { resolveConnectionConfig } from "./config.ts";
import { loadExpectationsFromFile } from "./expectation-loader.ts";
import { openDatabase } from "./spanner-client.ts";
import type {
  ExpectationsFile,
  ResolvedSpannerConnectionConfig,
  SpannerAssertOptions,
  SpannerAssertInstance,
} from "./types.ts";

export function createSpannerAssert(
  options: SpannerAssertOptions
): SpannerAssertInstance {
  const resolvedConfig = resolveConnectionConfig(options.connection);

  const openHandle = () => openDatabase(resolvedConfig);

  const assertWithExpectations = async (
    expectations: ExpectationsFile
  ): Promise<void> => {
    const handle = openHandle();

    try {
      await assertExpectations(handle.database, expectations);
    } finally {
      await handle.close();
    }
  };

  const assert = async (expectedFile: string): Promise<void> => {
    const expectations = await loadExpectationsFromFile(expectedFile);
    await assertWithExpectations(expectations);
  };

  const assertExpectationsPublic = async (
    expectations: ExpectationsFile
  ): Promise<void> => {
    await assertWithExpectations(expectations);
  };

  const getConnectionInfo = (): ResolvedSpannerConnectionConfig => ({
    ...resolvedConfig,
  });

  return {
    assert,
    assertExpectations: assertExpectationsPublic,
    getConnectionInfo,
  };
}
