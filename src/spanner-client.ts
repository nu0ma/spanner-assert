import {
  type Database,
  type SpannerOptions,
  Spanner,
} from "@google-cloud/spanner";

import type { SpannerConnectionConfig } from "./types.ts";

export type DatabaseHandle = {
  database: Database;
  close(): Promise<void>;
};

export function openDatabase(config: SpannerConnectionConfig): DatabaseHandle {
  // Set SPANNER_EMULATOR_HOST environment variable for the client library
  // This ensures the library uses emulator-specific configuration (no SSL)
  process.env.SPANNER_EMULATOR_HOST = config.emulatorHost;

  const clientConfig: SpannerOptions = {
    projectId: config.projectId,
  };

  const spanner = new Spanner(clientConfig);

  const instance = spanner.instance(config.instanceId);
  const database = instance.database(config.databaseId);

  return {
    database,
    async close(): Promise<void> {
      await database.close();
      spanner.close();
    },
  };
}
