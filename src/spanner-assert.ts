import { assertExpectations } from "./assertion.js";
import { resolveConnectionConfig } from "./config.js";
import { loadExpectationsFromFile } from "./expectation-loader.js";
import { openDatabase } from "./spanner-client.js";
import type {
  ExpectationsFile,
  SpannerAssertOptions,
  SpannerAssertInstance,
} from "./types.js";

export function createSpannerAssert(
  options: SpannerAssertOptions
): SpannerAssertInstance {
  const resolvedConfig = resolveConnectionConfig(options.connection);
  const dependencies = options.clientDependencies ?? {};

  const openHandle = () => openDatabase(resolvedConfig, dependencies);

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

  return {
    assert,
    assertExpectations: assertExpectationsPublic,
  };
}
