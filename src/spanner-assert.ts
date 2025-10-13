import { assertExpectations } from "./assertion.js";
import { resolveConnectionConfig } from "./config.js";
import { loadExpectationsFromFile } from "./expectation-loader.js";
import { openDatabase } from "./spanner-client.js";
import type {
  ExpectationsFile,
  SpannerAssertOptions,
  SpannerAssertInstance,
  AssertOptions,
} from "./types.js";

export function createSpannerAssert(
  options: SpannerAssertOptions = {},
): SpannerAssertInstance {
  const openHandle = (overrides: AssertOptions) => {
    const connectionOverrides = overrides.connection ?? {};
    const mergedConnection = {
      ...options.connection,
      ...connectionOverrides,
    };
    const resolved = resolveConnectionConfig(mergedConnection);
    return openDatabase(resolved, options.clientDependencies ?? {});
  };

  const assertWithExpectations = async (
    expectations: ExpectationsFile,
    overrides: AssertOptions,
  ): Promise<void> => {
    const handle = openHandle(overrides);

    try {
      await assertExpectations(handle.database, expectations);
    } finally {
      await handle.close();
    }
  };

  const assert = async (
    expectedFile: string,
    overrides: AssertOptions = {},
  ): Promise<void> => {
    const expectations = await loadExpectationsFromFile(expectedFile, {
      baseDir: overrides.baseDir,
    });
    await assertWithExpectations(expectations, overrides);
  };

  const assertExpectationsPublic = async (
    expectations: ExpectationsFile,
    overrides: AssertOptions = {},
  ): Promise<void> => {
    await assertWithExpectations(expectations, overrides);
  };

  return {
    assert,
    assertExpectations: assertExpectationsPublic,
  };
}
