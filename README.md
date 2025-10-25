# spanner-assert

Validate Google Cloud Spanner **emulator** data against expectations written in YAML. Lightweight Node.js testing library for E2E workflows, fast feedback loops.

> ⚠️ **This library only supports Cloud Spanner emulator** - designed for testing environments, not production databases.

## Install

```bash
npm install spanner-assert
```

## Quick Start

1. Start the Spanner emulator and note the connection settings.

2. Create an expectations YAML file:

```yaml
# expectations.yaml
tables:
  Users:
    rows:
      - UserID: "user-001"
        Name: "Alice Example"
        Email: "alice@example.com"
        Status: 1
        CreatedAt: "2024-01-01T00:00:00Z"
  Products:
    rows:
      - ProductID: "product-001"
        Name: "Example Product"
        Price: 1999
        IsActive: true
        CategoryID: null
        CreatedAt: "2024-01-01T00:00:00Z"
  Books:
    rows:
      - BookID: "book-001"
        Title: "Example Book"
        Author: "Jane Doe"
        PublishedYear: 2024
        JSONData: '{"genre":"Fiction","rating":4.5}'
```

Each table lists expected rows as an array. Add an optional `count` field when you also want to assert the total number of rows returned.

### Supported value types

`spanner-assert` compares column values using only `string`, `number`, `boolean`, and `null`. For other Spanner types such as `TIMESTAMP` or `DATE`, provide the expected value as a string (for example, `"2024-01-01T00:00:00Z"`).

3. Run the assertion from a script:

```ts
import { createSpannerAssert } from "spanner-assert";

// Minimal configuration (uses defaults for emulator)
const spannerAssert = createSpannerAssert({
  connection: {
    databaseId: "your-database",
  },
});

// Or with explicit configuration
const spannerAssert = createSpannerAssert({
  connection: {
    projectId: "test-project",       // default: "test-project"
    instanceId: "test-instance",     // default: "test-instance"
    databaseId: "your-database",     // required
    emulatorHost: "127.0.0.1:9010",  // default: "127.0.0.1:9010"
  },
});

console.log(spannerAssert.getConnectionInfo()); // -> resolved connection settings

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

Here's a practical example of using `spanner-assert` in Playwright E2E tests to validate database state after user interactions:

```ts
import { test, expect } from '@playwright/test';
import { createSpannerAssert } from 'spanner-assert';

test.describe('User Registration Flow', () => {
  let spannerAssert;

  test.beforeAll(async () => {
    // Initialize spanner-assert once for all tests
    // Minimal config - uses emulator defaults
    spannerAssert = createSpannerAssert({
      connection: {
        databaseId: 'test-database',
      },
    });
  });

  test('should create user record after registration', async ({ page }) => {
    // 1. Perform UI actions
    await page.goto('https://your-app.com/register');
    await page.fill('[name="email"]', 'alice@example.com');
    await page.fill('[name="name"]', 'Alice Example');
    await page.click('button[type="submit"]');

    await expect(page.locator('.success-message')).toBeVisible();

    // 2. Validate database state with spanner-assert
    await spannerAssert.assert('./test/expectations/user-created.yaml');
  });

  test('should update user profile', async ({ page }) => {
    // Navigate and update profile
    await page.goto('https://your-app.com/profile');
    await page.fill('[name="bio"]', 'Software engineer');
    await page.click('button:has-text("Save")');

    await expect(page.locator('.success-notification')).toBeVisible();

    // Verify database was updated correctly
    await spannerAssert.assert('./test/expectations/profile-updated.yaml');
  });

  test('should create product and verify inventory', async ({ page }) => {
    // Admin creates a new product
    await page.goto('https://your-app.com/admin/products');
    await page.fill('[name="productName"]', 'Example Product');
    await page.fill('[name="price"]', '1999');
    await page.check('[name="isActive"]');
    await page.click('button:has-text("Create Product")');

    await expect(page.locator('.product-created')).toBeVisible();

    // Validate both Products and Inventory tables
    await spannerAssert.assert('./test/expectations/product-inventory.yaml');
  });
});
```

**Example expectation file** (`test/expectations/user-created.yaml`):

```yaml
tables:
  Users:
    count: 1
    rows:
      - Email: "alice@example.com"
        Name: "Alice Example"
        Status: 1
```

**Example with multiple tables** (`test/expectations/product-inventory.yaml`):

```yaml
tables:
  Products:
    count: 1
    rows:
      - Name: "Example Product"
        Price: 1999
        IsActive: true
  Inventory:
    count: 1
    rows:
      - ProductID: "product-001"
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
