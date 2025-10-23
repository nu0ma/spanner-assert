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
  const clientConfig: SpannerOptions = {
    projectId: config.projectId,
  };

  // configure emulator host if provided
  if (config.emulatorHost) {
    clientConfig.servicePath = config.emulatorHost.split(":")[0];
    clientConfig.port = Number.parseInt(
      config.emulatorHost.split(":")[1] || "9010"
    );
    clientConfig.sslCreds = undefined;
  }

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
