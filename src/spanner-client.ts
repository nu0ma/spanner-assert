import { type ClientConfig, type Database, Spanner } from '@google-cloud/spanner';

import type { ResolvedSpannerConnectionConfig } from './types.js';

export type SpannerClientDependencies = {
  spannerInstance?: Spanner;
  database?: Database;
  clientConfig?: ClientConfig;
};

export type SpannerClientProvider = {
  getDatabase(): Database;
  close(): Promise<void>;
};

export function createSpannerClientProvider(
  config: ResolvedSpannerConnectionConfig,
  dependencies: SpannerClientDependencies = {},
): SpannerClientProvider {
  let spannerRef: Spanner | null = dependencies.spannerInstance ?? null;
  let databaseRef: Database | null = dependencies.database ?? null;

  const resolveSpanner = (): Spanner => {
    if (dependencies.spannerInstance) {
      return dependencies.spannerInstance;
    }

    if (!spannerRef) {
      const options: ClientConfig = {
        projectId: config.projectId,
        ...(config.emulatorHost ? { emulatorHost: config.emulatorHost } : {}),
        ...(dependencies.clientConfig ?? {}),
      };

      spannerRef = new Spanner(options);
    }

    return spannerRef;
  };

  const resolveDatabase = (): Database => {
    if (dependencies.database) {
      return dependencies.database;
    }

    if (!databaseRef) {
      const spanner = resolveSpanner();
      const instance = spanner.instance(config.instanceId);
      databaseRef = instance.database(config.databaseId);
    }

    return databaseRef;
  };

  const close = async (): Promise<void> => {
    if (databaseRef) {
      await databaseRef.close();
      databaseRef = null;
    }

    if (spannerRef && !dependencies.spannerInstance) {
      await spannerRef.close();
      spannerRef = null;
    }
  };

  return {
    getDatabase: resolveDatabase,
    close,
  };
}
