import {
  closeSpannerContext,
  createSpannerTestContext,
  expectationsFixturePath,
  seedSamples,
} from "./helpers/spanner.ts";

async function main(): Promise<void> {
  const context = createSpannerTestContext();
  const { database, spannerAssert } = context;

  try {
    console.log("Seeding sample data...");
    await seedSamples(database);

    console.log("Running expectation assertions...");
    await spannerAssert.assert(
      expectationsFixturePath("samples.yaml")
    );

    console.log("✅ All assertions passed!");
  } catch (error) {
    console.error("❌ E2E test failed:");
    console.error(error);
    throw error;
  } finally {
    console.log("Closing client resources...");
    await closeSpannerContext(context);
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
