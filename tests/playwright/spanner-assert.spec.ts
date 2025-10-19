import { test } from "@playwright/test";

import {
  closeSpannerContext,
  createSpannerTestContext,
  expectationsFixturePath,
  seedSamples,
  type SpannerTestContext,
} from "../e2e/helpers/spanner.ts";

let context: SpannerTestContext | undefined;

test.describe("spanner-assert with Playwright", () => {
  test.beforeAll(async () => {
    context = createSpannerTestContext();

    console.log("context", context);
    await seedSamples(context.database);
  });

  // test.afterAll(async () => {
  //   if (context) {
  //     await closeSpannerContext(context);
  //   }
  // });

  test("seeds are present in the emulator", async () => {
    if (!context) {
      throw new Error("Spanner test context was not initialised");
    }

    await context.spannerAssert.assert(expectationsFixturePath("samples.yaml"));
  });
});
