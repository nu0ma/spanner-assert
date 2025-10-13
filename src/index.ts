import { resolveConnectionConfig } from './config.js';
import { assertExpectations } from './assertion.js';
import { loadExpectationsFromFile } from './expectation-loader.js';
import { SpannerClientProvider, type SpannerClientDependencies } from './spanner-client.js';
import type { ExpectationsFile, SpannerConnectionConfig } from './types.js';

export type SpannerAssertOptions = {
  connection?: Partial<SpannerConnectionConfig>;
  clientDependencies?: SpannerClientDependencies;
};

export type AssertOptions = {
  connection?: Partial<SpannerConnectionConfig>;
  baseDir?: string;
};

export class SpannerAssert {
  #options: SpannerAssertOptions;
  #provider: SpannerClientProvider | null = null;

  constructor(options: SpannerAssertOptions = {}) {
    this.#options = options;
  }

  async assert(expectedFile: string, options: AssertOptions = {}): Promise<void> {
    const expectations = await loadExpectationsFromFile(expectedFile, {
      baseDir: options.baseDir,
    });
    await this.#assertWithExpectations(expectations, options);
  }

  async assertExpectations(
    expectations: ExpectationsFile,
    options: AssertOptions = {},
  ): Promise<void> {
    await this.#assertWithExpectations(expectations, options);
  }

  async close(): Promise<void> {
    if (this.#provider) {
      await this.#provider.close();
      this.#provider = null;
    }
  }

  protected async #assertWithExpectations(
    expectations: ExpectationsFile,
    options: AssertOptions,
  ): Promise<void> {
    const provider = this.#ensureProvider(options);
    const isTemporaryProvider = provider !== this.#provider;

    try {
      await assertExpectations(provider.getDatabase(), expectations);
    } finally {
      if (isTemporaryProvider) {
        await provider.close();
      }
    }
  }

  #ensureProvider(options: AssertOptions): SpannerClientProvider {
    const connectionOverrides = options.connection ?? {};
    const mergedConnection = {
      ...this.#options.connection,
      ...connectionOverrides,
    };
    const resolved = resolveConnectionConfig(mergedConnection);
    const useTemporaryProvider = Object.keys(connectionOverrides).length > 0;

    if (useTemporaryProvider) {
      return new SpannerClientProvider(resolved, this.#options.clientDependencies ?? {});
    }

    if (!this.#provider) {
      this.#provider = new SpannerClientProvider(resolved, this.#options.clientDependencies ?? {});
    }

    return this.#provider;
  }
}

export const spannerAssert = new SpannerAssert();

export { SpannerAssertionError } from './errors.js';
export type {
  ExpectationsFile,
  SpannerConnectionConfig,
} from './types.js';
export type { AssertOptions, SpannerAssertOptions };
