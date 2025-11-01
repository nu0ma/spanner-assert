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

  test.afterAll(async () => {
    await spannerAssert.close();
  });

  test("seeds are present in the emulator", async () => {
    await spannerAssert.assert(expectations);
  });
});
