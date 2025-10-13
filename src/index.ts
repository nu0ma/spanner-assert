import { assertExpectations } from './assertion.js';
import { resolveConnectionConfig } from './config.js';
import { loadExpectationsFromFile } from './expectation-loader.js';
import { openDatabase, type DatabaseHandle, type SpannerClientDependencies } from './spanner-client.js';
import type { ExpectationsFile, SpannerConnectionConfig } from './types.js';

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
  close(): Promise<void>;
};

export function createSpannerAssert(
  options: SpannerAssertOptions = {},
): SpannerAssertInstance {
  let cachedHandle: DatabaseHandle | null = null;

  const ensureHandle = (overrides: AssertOptions): [DatabaseHandle, boolean] => {
    const connectionOverrides = overrides.connection ?? {};
    const mergedConnection = {
      ...options.connection,
      ...connectionOverrides,
    };
    const resolved = resolveConnectionConfig(mergedConnection);
    const expectsTemporaryHandle = Object.keys(connectionOverrides).length > 0;

    if (expectsTemporaryHandle) {
      const temporaryHandle = openDatabase(resolved, options.clientDependencies ?? {});
      return [temporaryHandle, true];
    }

    if (!cachedHandle) {
      cachedHandle = openDatabase(resolved, options.clientDependencies ?? {});
    }

    return [cachedHandle, false];
  };

  const assertWithExpectations = async (
    expectations: ExpectationsFile,
    overrides: AssertOptions,
  ): Promise<void> => {
    const [handle, shouldDispose] = ensureHandle(overrides);

    try {
      await assertExpectations(handle.database, expectations);
    } finally {
      if (shouldDispose) {
        await handle.close();
      }
    }
  };

  const assert = async (expectedFile: string, overrides: AssertOptions = {}): Promise<void> => {
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

  const close = async (): Promise<void> => {
    if (cachedHandle) {
      await cachedHandle.close();
      cachedHandle = null;
    }
  };

  return {
    assert,
    assertExpectations: assertExpectationsPublic,
    close,
  };
}

export const spannerAssert = createSpannerAssert();

export { SpannerAssertionError } from './errors.js';
export type { ExpectationsFile, SpannerConnectionConfig } from './types.js';
