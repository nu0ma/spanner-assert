import { Spanner } from "@google-cloud/spanner";

import { createSpannerAssert, resetDatabase } from "../../src/index.ts";
import { seedSamples } from "../seed.ts";

const projectId = "e2e-project";
const instanceId = "e2e-instance";
const databaseId = "e2e-database";
const emulatorHost = "127.0.0.1:9010";

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
    console.log("Test 1: Reset via SpannerAssertInstance method");
    console.log("Seeding sample data...");
    await seedSamples(database);

    console.log("Verifying data exists...");
    await spannerAssert.assert({
      tables: {
        Users: { count: 1, rows: [{ Email: "alice@example.com" }] },
        Products: { count: 1, rows: [{ Name: "Example Product" }] },
        Books: { count: 1, rows: [{ Title: "Example Book" }] },
        ArrayTests: { count: 3, rows: [{ TestID: "array-001" }] },
      },
    });

    console.log("Resetting tables via spannerAssert.reset()...");
    await spannerAssert.reset(["Users", "Products", "Books", "ArrayTests"]);

    console.log("Verifying all tables are empty...");
    await spannerAssert.assert({
      tables: {
        Users: { count: 0 },
        Products: { count: 0 },
        Books: { count: 0 },
        ArrayTests: { count: 0 },
      },
    });

    console.log("✅ Test 1 passed!");

    console.log("\nTest 2: Reset via standalone resetDatabase function");
    console.log("Seeding sample data again...");
    await seedSamples(database);

    console.log("Resetting tables via resetDatabase()...");
    await resetDatabase(database, ["Users", "Products"]);

    console.log("Verifying only specified tables are empty...");
    await spannerAssert.assert({
      tables: {
        Users: { count: 0 },
        Products: { count: 0 },
        Books: { count: 1, rows: [{ Title: "Example Book" }] },
        ArrayTests: { count: 3, rows: [{ TestID: "array-001" }] },
      },
    });

    console.log("✅ Test 2 passed!");

    console.log("\nTest 3: Reset with invalid table name");
    try {
      await resetDatabase(database, ["Invalid-Table-Name"]);
      console.error("❌ Test 3 failed: Expected error was not thrown");
      throw new Error("Expected error for invalid table name");
    } catch (error) {
      if (error instanceof Error && error.name === "SpannerAssertionError") {
        console.log("✅ Test 3 passed: Error correctly thrown for invalid table name");
      } else {
        throw error;
      }
    }

    console.log("\n✅ All reset E2E tests passed!");
  } catch (error) {
    console.error("❌ E2E reset test failed:");
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
