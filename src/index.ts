import { assertExpectations } from './assertion.js';
import { resolveConnectionConfig } from './config.js';
import { loadExpectationsFromFile } from './expectation-loader.js';
import {
  createSpannerClientProvider,
  type SpannerClientDependencies,
  type SpannerClientProvider,
} from './spanner-client.js';
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
  let providerRef: SpannerClientProvider | null = null;

  const ensureProvider = (overrides: AssertOptions): [SpannerClientProvider, boolean] => {
    const connectionOverrides = overrides.connection ?? {};
    const mergedConnection = {
      ...options.connection,
      ...connectionOverrides,
    };
    const resolved = resolveConnectionConfig(mergedConnection);
    const useTemporaryProvider = Object.keys(connectionOverrides).length > 0;

    if (useTemporaryProvider) {
      const temporaryProvider = createSpannerClientProvider(
        resolved,
        options.clientDependencies ?? {},
      );
      return [temporaryProvider, true];
    }

    if (!providerRef) {
      providerRef = createSpannerClientProvider(resolved, options.clientDependencies ?? {});
    }

    return [providerRef, false];
  };

  const assertWithExpectations = async (
    expectations: ExpectationsFile,
    overrides: AssertOptions,
  ): Promise<void> => {
    const [provider, shouldDispose] = ensureProvider(overrides);

    try {
      await assertExpectations(provider.getDatabase(), expectations);
    } finally {
      if (shouldDispose) {
        await provider.close();
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
    if (providerRef) {
      await providerRef.close();
      providerRef = null;
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
export type { AssertOptions, SpannerAssertOptions, SpannerAssertInstance };
