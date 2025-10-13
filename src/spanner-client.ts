import { Spanner, type ClientConfig, type Database } from '@google-cloud/spanner';

import type { ResolvedSpannerConnectionConfig } from './types.js';

export type SpannerClientDependencies = {
  spannerInstance?: Spanner;
  database?: Database;
  clientConfig?: ClientConfig;
};

export class SpannerClientProvider {
  #config: ResolvedSpannerConnectionConfig;
  #dependencies: SpannerClientDependencies;
  #spanner: Spanner | null = null;
  #database: Database | null = null;

  constructor(
    config: ResolvedSpannerConnectionConfig,
    dependencies: SpannerClientDependencies = {},
  ) {
    this.#config = config;
    this.#dependencies = dependencies;
  }

  getDatabase(): Database {
    if (!this.#database) {
      this.#database = this.#resolveDatabase();
    }

    return this.#database;
  }

  async close(): Promise<void> {
    if (this.#database) {
      await this.#database.close();
      this.#database = null;
    }

    if (this.#spanner) {
      await this.#spanner.close();
      this.#spanner = null;
    }
  }

  #resolveDatabase(): Database {
    if (this.#dependencies.database) {
      return this.#dependencies.database;
    }

    const spanner = this.#resolveSpanner();
    const instance = spanner.instance(this.#config.instanceId);
    return instance.database(this.#config.databaseId);
  }

  #resolveSpanner(): Spanner {
    if (this.#dependencies.spannerInstance) {
      return this.#dependencies.spannerInstance;
    }

    if (!this.#spanner) {
      const options: ClientConfig = {
        projectId: this.#config.projectId,
        ...(this.#config.emulatorHost ? { emulatorHost: this.#config.emulatorHost } : {}),
        ...(this.#dependencies.clientConfig ?? {}),
      };

      this.#spanner = new Spanner(options);
    }

    return this.#spanner;
  }
}
