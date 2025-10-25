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
  const [host, portStr] = config.emulatorHost.split(":");
  const port = Number.parseInt(portStr || "9010");

  const clientConfig: SpannerOptions = {
    projectId: config.projectId,
    servicePath: host,
    port: port,
    sslCreds: undefined,
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
