import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/playwright",
  timeout: 60_000,
  workers: 1,
  use: {
    headless: true,
  },
  reporter: [["list"]],
});
