# spanner-assert

Validate Google Cloud Spanner data (emulator supported) against expectations written in YAML. Lightweight Node.js library, fast feedback loops.

## Install

```bash
npm install spanner-assert
```

## Quick Start

1. Start the Spanner emulator (optional) and note the connection settings you want to validate against.

2. Create an expectations YAML file:

```yaml
# expectations.yaml
tables:
  Users:
    columns:
      UserID: "user-001"
      Name: "Alice Example"
      Email: "alice@example.com"
      Status: 1
      CreatedAt: "2024-01-01T00:00:00Z"
  Products:
    columns:
      ProductID: "product-001"
      Name: "Example Product"
      Price: 1999
      IsActive: true
      CategoryID: null
      CreatedAt: "2024-01-01T00:00:00Z"
  Books:
    columns:
      BookID: "book-001"
      Title: "Example Book"
      Author: "Jane Doe"
      PublishedYear: 2024
      JSONData: '{"genre":"Fiction","rating":4.5}'
```

3. Run the assertion from a script:

```ts
import { createSpannerAssert } from "spanner-assert";

const spannerAssert = createSpannerAssert({
  connection: {
    projectId: "your-project",
    instanceId: "your-instance",
    databaseId: "your-database",
    emulatorHost: "127.0.0.1:9010", // optional when using the emulator
  },
});

await spannerAssert.assert("./expectations.yaml");
```

On success you get no output (or your own logging) because all tables matched.

### If not successful

```text
SpannerAssertionError: No rows matched the expected column values in Books.
    expected columns: { JSONData: '{"genre":"Fiction","rating":4.5}' }
    table: Books
```

An error is thrown detailing which table and columns failed to match.

## Usage with Playwright

This repository ships with a runnable Playwright scenario (`tests/playwright/spanner-assert.spec.ts`) that validates the state of a Docker-hosted Spanner emulator without touching any UI.

### Run the demo

```bash
# 1. Build the library (Task targets do this automatically)
pnpm run build

# 2. Spin up the emulator and apply the schema
task emulator:up
task emulator:setup

# 3. Execute the Playwright test suite
pnpm exec playwright test

# Or run everything (including lifecycle) with a single Task target:
task test:playwright

# (初回のみ) Playwright のブラウザバイナリを取得する場合
pnpm exec playwright install --with-deps
```

The Playwright test seeds sample data through the Spanner client and then verifies tables with `spanner-assert`:

```ts
import { test } from "@playwright/test";
import {
  closeSpannerContext,
  createSpannerTestContext,
  expectationsFixturePath,
  seedSamples,
} from "../e2e/helpers/spanner.ts";

let context;

test.describe("spanner-assert with Playwright", () => {
  test.beforeAll(async () => {
    context = createSpannerTestContext();
    await seedSamples(context.database);
  });

  test.afterAll(async () => {
    if (context) {
      await closeSpannerContext(context);
    }
  });

  test("seeds are present in the emulator", async () => {
    await context.spannerAssert.assert(expectationsFixturePath("samples.yaml"));
  });
});
```

**Expectation fixture** (`tests/e2e/fixtures/expectations/samples.yaml`):

```yaml
tables:
  Users:
    count: 1
    columns:
      Email: "alice@example.com"
      Name: "Alice Example"
      Status: 1
```

**Example with multiple tables** (`test/expectations/product-inventory.yaml`):

```yaml
tables:
  Products:
    columns:
      Name: "Example Product"
      Price: 1999
      IsActive: true
  Inventory:
    columns:
      ProductID: "product-001"
      Quantity: 0
      LastUpdated: "2024-01-01T00:00:00Z"
```

This pattern allows you to:
- Verify UI actions resulted in correct database changes
- Validate complex multi-table relationships
- Catch data integrity issues early in the development cycle
- Keep test expectations readable and version-controlled

## License

MIT
