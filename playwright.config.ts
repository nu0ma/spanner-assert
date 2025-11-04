import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/playwright",
  fullyParallel: false, // Disable parallel execution to prevent database race conditions
  workers: 1, // Run tests sequentially (single worker) since all tests share the same database
});
