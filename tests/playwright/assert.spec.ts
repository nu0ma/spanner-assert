import { test } from "@playwright/test";

import { createSpannerAssert } from "../../src/spanner-assert.ts";
import { SpannerAssertInstance } from "../../src/types.ts";
import expectations from "../e2e/fixtures/expectations/samples.json" with { type: "json" };
import { seed } from "../seed.ts";

import { config } from "./config.ts";

// Create spanner-assert instance
const spannerAssert: SpannerAssertInstance = createSpannerAssert({
  connection: {
    projectId: config.projectID,
    instanceId: config.instanceID,
    databaseId: config.databaseID,
    emulatorHost: config.emulatorHost,
  },
});

// use in playwright tests
test.describe("spanner-assert with Playwright", () => {
  test.beforeAll(async () => {
    await seed();
  });

  test.afterEach(async () => {
    // Reset database after each test to ensure clean state
    await spannerAssert.resetDatabase([
      "Users",
      "Products",
      "Books",
      "ArrayTests",
    ]);
  });

  test("seeds are present in the emulator", async () => {
    await spannerAssert.assert(expectations);
  });

  test("resetDatabase deletes all data from specified tables", async () => {
    // 1. Seed test data
    await seed();

    // 2. Verify data exists
    await spannerAssert.assert({
      tables: {
        Users: { count: 1 },
        Products: { count: 1 },
        Books: { count: 1 },
        ArrayTests: { count: 3 },
      },
    });

    // 3. Reset database
    await spannerAssert.resetDatabase([
      "Users",
      "Products",
      "Books",
      "ArrayTests",
    ]);

    // 4. Verify all tables are empty
    await spannerAssert.assert({
      tables: {
        Users: { count: 0 },
        Products: { count: 0 },
        Books: { count: 0 },
        ArrayTests: { count: 0 },
      },
    });
  });
});
