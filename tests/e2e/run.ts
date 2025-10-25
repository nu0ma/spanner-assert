import path from "node:path";

import { Spanner } from "@google-cloud/spanner";

import { createSpannerAssert } from "../../src/index.ts";
import { seedSamples } from "../seed.ts";

const projectId = "e2e-project";
const instanceId = "e2e-instance";
const databaseId = "e2e-database";
const emulatorHost = "127.0.0.1:9010";

const fixturesDir = "tests/e2e/fixtures";

async function main(): Promise<void> {
  const spanner = new Spanner({
    projectId,
    servicePath: emulatorHost.split(":")[0],
    port: 9010,
  });

  const instance = spanner.instance(instanceId);
  const database = instance.database(databaseId);

  const spannerAssert = createSpannerAssert({
    connection: {
      projectId,
      instanceId,
      databaseId,
      emulatorHost,
    },
  });

  try {
    console.log("Seeding sample data...");
    await seedSamples(database);

    console.log("Running expectation assertions...");
    await spannerAssert.assert(
      path.join(fixturesDir, "expectations", "samples.yaml")
    );

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
