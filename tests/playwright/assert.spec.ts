import { test } from "@playwright/test";

import { createSpannerAssert } from "../../src/spanner-assert.ts";
import { SpannerAssertInstance } from "../../src/types.ts";
import expectations from "../e2e/fixtures/expectations/samples.json" with { type: "json" };
import { seed } from "../seed.ts";

// Create spanner-assert instance
const spannerAssert: SpannerAssertInstance = createSpannerAssert({
  connection: {
    projectId: "e2e-project",
    instanceId: "e2e-instance",
    databaseId: "e2e-database",
    emulatorHost: "127.0.0.1:9010",
  },
});

// use in playwright tests
test.describe("spanner-assert with Playwright", () => {
  test.beforeAll(async () => {
    await seed();
  });

  test("seeds are present in the emulator", async () => {
    await spannerAssert.assert(expectations);
  });
});
