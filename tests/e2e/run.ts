import { Spanner } from "@google-cloud/spanner";

import { createSpannerAssert } from "../../src/index.ts";
import { config } from "../playwright/config.ts";
import { seedSamples } from "../seed.ts";

import expectations from "./fixtures/expectations/samples.json" with { type: "json" };

async function main(): Promise<void> {
  const spanner = new Spanner({
    projectId: config.projectID,
    servicePath: config.emulatorHost.split(":")[0],
    port: Number.parseInt(config.emulatorHost.split(":")[1]),
  });

  const instance = spanner.instance(config.instanceID);
  const database = instance.database(config.databaseID);

  const spannerAssert = createSpannerAssert({
    connection: {
      projectId: config.projectID,
      instanceId: config.instanceID,
      databaseId: config.databaseID,
      emulatorHost: config.emulatorHost,
    },
  });

  try {
    console.log("Seeding sample data...");
    await seedSamples(database);

    console.log("Running expectation assertions...");
    await spannerAssert.assert(expectations);

    console.log("✅ All assertions passed!");
  } catch (error) {
    console.error("❌ E2E test failed:");
    console.error(error);
    throw error;
  } finally {
    console.log("Closing client resources...");
    await database.close();
    spanner.close();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
