import {
  type Database,
  type SpannerOptions,
  Spanner,
} from "@google-cloud/spanner";

import type { ResolvedSpannerConnectionConfig } from "./types.ts";

export type SpannerClientDependencies = {
  spannerInstance?: Spanner;
  database?: Database;
  clientConfig?: SpannerOptions;
};

export type DatabaseHandle = {
  database: Database;
  close(): Promise<void>;
};

export function openDatabase(
  config: ResolvedSpannerConnectionConfig,
  dependencies: SpannerClientDependencies = {}
): DatabaseHandle {
  if (dependencies.database) {
    return {
      database: dependencies.database,
      async close() {
        // Provided database is owned by the caller; nothing to do.
      },
    };
  }

  const clientConfig: SpannerOptions = {
    projectId: config.projectId,
    ...(dependencies.clientConfig ?? {}),
  };

  // Add emulator host configuration if provided
  if (config.emulatorHost) {
    clientConfig.servicePath = config.emulatorHost.split(":")[0];
    clientConfig.port = Number.parseInt(
      config.emulatorHost.split(":")[1] || "9010"
    );
    clientConfig.sslCreds = undefined;
  }

  const spanner = dependencies.spannerInstance ?? new Spanner(clientConfig);

  const instance = spanner.instance(config.instanceId);
  const database = instance.database(config.databaseId);

  return {
    database,
    async close(): Promise<void> {
      await database.close();
      if (!dependencies.spannerInstance) {
        await spanner.close();
      }
    },
  };
}
