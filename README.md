# spanner-assert

[![npm version](https://img.shields.io/npm/v/spanner-assert)](https://www.npmjs.com/package/spanner-assert)
[![CI](https://github.com/nu0ma/spanner-assert/actions/workflows/ci.yaml/badge.svg)](https://github.com/nu0ma/spanner-assert/actions/workflows/ci.yaml)
[![License](https://img.shields.io/npm/l/spanner-assert)](https://github.com/nu0ma/spanner-assert/blob/main/LICENSE)

Validate Google Cloud Spanner **emulator** data against expectations written in JSON. Lightweight Node.js testing library for E2E workflows, fast feedback loops.

> ⚠️ **This library only supports Cloud Spanner emulator** - designed for testing environments, not production databases.

## Why spanner-assert?

While there are many database testing tools available for Node.js, `spanner-assert` fills a unique gap in the testing ecosystem:

### No Spanner-specific testing libraries exist

Our research found no dedicated testing or assertion libraries for Cloud Spanner in the npm ecosystem. The only available option is the official [@google-cloud/spanner](https://www.npmjs.com/package/@google-cloud/spanner) client library, which requires writing imperative query-and-compare code for every test assertion.

### Declarative approach reduces test maintenance

Unlike traditional database testing approaches that require imperative code:

```ts
// Traditional approach - imperative and verbose
const [rows] = await database.run({
  sql: 'SELECT * FROM Users WHERE Email = @email',
  params: { email: 'alice@example.com' }
});
expect(rows.length).toBe(1);
expect(rows[0].Name).toBe('Alice Example');
expect(rows[0].Status).toBe(1);
// Repeat for every table and column...
```

`spanner-assert` lets you define expectations declaratively in JSON:

```json
{
  "tables": {
    "Users": {
      "rows": [
        {
          "Email": "alice@example.com",
          "Name": "Alice Example",
          "Status": 1
        }
      ]
    }
  }
}
```

This approach:
- **Reduces boilerplate**: No repetitive query-and-compare code
- **Version-controlled expectations**: JSON files track what your database should look like
- **Clear test intent**: Expectations are readable by non-developers
- **Fast feedback**: Visual diffs using jest-diff show exactly what changed

### Comparison with related tools

| Tool | Focus | Approach | Spanner Support |
|------|-------|----------|-----------------|
| **spanner-assert** | Spanner emulator E2E testing | Declarative JSON expectations | ✅ Exclusive |
| [@google-cloud/spanner](https://www.npmjs.com/package/@google-cloud/spanner) | Spanner client library | Imperative queries | ✅ Yes |
| [declarative-e2e-test](https://github.com/marc-ed-raffalli/declarative-e2e-test) | REST API testing | Declarative JSON tests | ❌ API only |
| [@databases/mysql-test](https://www.atdatabases.org/docs/mysql-test) | MySQL testing | Docker-based test environment | ❌ MySQL only |
| [testcontainers](https://www.npmjs.com/search?q=testcontainers) | Multi-database testing | Docker container management | ❌ PostgreSQL/MongoDB/etc |
| [node-mongodb-fixtures](https://www.npmjs.com/package/node-mongodb-fixtures) | MongoDB fixture management | JSON fixtures for seeding | ❌ MongoDB only |

### Built for E2E workflows

`spanner-assert` is specifically designed for end-to-end testing scenarios where you:
1. Perform UI actions or API calls (e.g., in Playwright tests)
2. Need to verify the database state changed correctly
3. Want fast, reliable assertions without complex query logic

If you're building applications with Cloud Spanner and need to validate database state in your E2E tests, `spanner-assert` provides a focused, ergonomic solution that doesn't exist elsewhere in the ecosystem.

## Install

```bash
npm install spanner-assert
```

## Quick Start

1. Start the Spanner emulator and note the connection settings.

2. Create an expectations JSON file:

```json
// expectations.json
{
  "tables": {
    "Users": {
      "rows": [
        {
          "UserID": "user-001",
          "Name": "Alice Example",
          "Email": "alice@example.com",
          "Status": 1,
          "CreatedAt": "2024-01-01T00:00:00Z"
        }
      ]
    },
    "Products": {
      "rows": [
        {
          "ProductID": "product-001",
          "Name": "Example Product",
          "Price": 1999,
          "IsActive": true,
          "CategoryID": null,
          "CreatedAt": "2024-01-01T00:00:00Z"
        }
      ]
    },
    "Books": {
      "rows": [
        {
          "BookID": "book-001",
          "Title": "Example Book",
          "Author": "Jane Doe",
          "PublishedYear": 2024,
          "JSONData": "{\"genre\":\"Fiction\",\"rating\":4.5}"
        }
      ]
    }
  }
}
```

Each table lists expected rows as an array. Add an optional `count` field when you also want to assert the total number of rows returned.

### Supported value types

`spanner-assert` compares column values using `string`, `number`, `boolean`, `null`, and **arrays** of these primitive types.

**Primitive types:**
- `string`, `number`, `boolean`, `null`
- For Spanner types like `TIMESTAMP` or `DATE`, provide values as strings (e.g., `"2024-01-01T00:00:00Z"`)

**Array types (ARRAY columns):**
- `ARRAY<STRING>`, `ARRAY<INT64>`, `ARRAY<BOOL>` are supported
- Arrays are compared with **order-sensitive matching** (exact element order required)
- Empty arrays (`[]`) are supported

**Array example:**

```json
{
  "tables": {
    "Articles": {
      "rows": [
        {
          "ArticleID": "article-001",
          "Tags": ["javascript", "typescript", "node"],
          "Scores": [100, 200, 300],
          "Flags": [true, false, true]
        },
        {
          "ArticleID": "article-002",
          "Tags": [],
          "Scores": [],
          "Flags": []
        }
      ]
    }
  }
}
```

3. Run the assertion from a script:

```ts
import { createSpannerAssert } from "spanner-assert";
import expectations from "./expectations.json" with { type: "json" };

const spannerAssert = createSpannerAssert({
  connection: {
    projectId: "your-project-id",
    instanceId: "your-instance-id",
    databaseId: "your-database",
    emulatorHost: "127.0.0.1:9010",
  },
});

console.log(spannerAssert.getConnectionInfo()); // -> resolved connection settings

await spannerAssert.assert(expectations);
```

On success you get no output (or your own logging) because all tables matched.

### If not successful

```text
SpannerAssertionError: 1 expected row(s) not found in table "Users".
  - Expected
  + Actual

  Array [
    Object {
-     "Name": "Alice",
+     "Name": "Invalid Name",
    },
  ]
```

An error is thrown with a color-coded diff showing expected vs actual values (using jest-diff).

## Usage with Playwright

Here's a practical example of using `spanner-assert` in Playwright E2E tests to validate database state after user interactions:

```ts
import { test, expect } from "@playwright/test";
import { createSpannerAssert } from "spanner-assert";
import userCreatedExpectations from "./test/expectations/user-created.json" with { type: "json" };
import profileUpdatedExpectations from "./test/expectations/profile-updated.json" with { type: "json" };
import productInventoryExpectations from "./test/expectations/product-inventory.json" with { type: "json" };

test.describe("User Registration Flow", () => {
  let spannerAssert;

  test.beforeAll(async () => {
    spannerAssert = createSpannerAssert({
      connection: {
        projectId: "your-project-id",
        instanceId: "your-instance-id",
        databaseId: "your-database",
        emulatorHost: "127.0.0.1:9010",
      },
    });
  });

  test("should create user record after registration", async ({ page }) => {
    // 1. Perform UI actions
    await page.goto("https://your-app.com/register");
    await page.fill('[name="email"]', "alice@example.com");
    await page.fill('[name="name"]', "Alice Example");
    await page.click('button[type="submit"]');

    await expect(page.locator(".success-message")).toBeVisible();

    // 2. Validate database state with spanner-assert
    await spannerAssert.assert(userCreatedExpectations);
  });

  test("should update user profile", async ({ page }) => {
    // Navigate and update profile
    await page.goto("https://your-app.com/profile");
    await page.fill('[name="bio"]', "Software engineer");
    await page.click('button:has-text("Save")');

    await expect(page.locator(".success-notification")).toBeVisible();

    // Verify database was updated correctly
    await spannerAssert.assert(profileUpdatedExpectations);
  });

  test("should create product and verify inventory", async ({ page }) => {
    // Admin creates a new product
    await page.goto("https://your-app.com/admin/products");
    await page.fill('[name="productName"]', "Example Product");
    await page.fill('[name="price"]', "1999");
    await page.check('[name="isActive"]');
    await page.click('button:has-text("Create Product")');

    await expect(page.locator(".product-created")).toBeVisible();

    // Validate both Products and Inventory tables
    await spannerAssert.assert(productInventoryExpectations);
  });
});
```

**Example expectation file** (`test/expectations/user-created.json`):

```json
{
  "tables": {
    "Users": {
      "count": 1,
      "rows": [
        {
          "Email": "alice@example.com",
          "Name": "Alice Example",
          "Status": 1
        }
      ]
    }
  }
}
```

**Example with multiple tables** (`test/expectations/product-inventory.json`):

```json
{
  "tables": {
    "Products": {
      "count": 1,
      "rows": [
        {
          "Name": "Example Product",
          "Price": 1999,
          "IsActive": true
        }
      ]
    },
    "Inventory": {
      "count": 1,
      "rows": [
        {
          "ProductID": "product-001",
          "Quantity": 0,
          "LastUpdated": "2024-01-01T00:00:00Z"
        }
      ]
    }
  }
}
```

This pattern allows you to:

- Verify UI actions resulted in correct database changes
- Validate complex multi-table relationships
- Catch data integrity issues early in the development cycle
- Keep test expectations readable and version-controlled

## Row Matching Algorithm

`spanner-assert` uses a **greedy matching algorithm** to compare expected rows against actual database rows. Understanding this behavior helps you write effective test expectations.

### How It Works

The algorithm processes expected rows sequentially:

1. For each expected row, it searches through the remaining actual rows
2. When a match is found, that actual row is **immediately consumed** (removed from the pool)
3. The algorithm moves to the next expected row
4. Any expected rows that don't find a match are reported as missing

**Key characteristics:**

- **Subset matching**: Only columns specified in the expected row are compared. Additional columns in the database are ignored.
- **Greedy selection**: The first matching actual row is chosen—no backtracking or optimization.
- **Order-dependent**: The order of expected rows can affect the outcome if expectations are ambiguous.

### Example: Subset Matching

```yaml
# Expected (only 2 columns specified)
tables:
  Users:
    rows:
      - Email: "alice@example.com"
        Status: 1
```

This will match a database row even if it has additional columns:

```
Actual database row:
{
  UserID: "user-001",
  Name: "Alice Example",
  Email: "alice@example.com",  ✅ matches
  Status: 1,                    ✅ matches
  CreatedAt: "2024-01-01T..."  ⬜ ignored (not in expectation)
}
```

### Best Practice: Use Unique Identifiers

To avoid ambiguity and ensure reliable matching, **always include unique columns** (like primary keys) in your expectations:

```json
// ✅ Good: Specific and unambiguous
{
  "tables": {
    "Users": {
      "rows": [
        {
          "UserID": "user-001",
          "Email": "alice@example.com",
          "Status": 1
        },
        {
          "UserID": "user-002",
          "Email": "bob@example.com",
          "Status": 1
        }
      ]
    }
  }
}

// ❌ Risky: Ambiguous expectations
{
  "tables": {
    "Users": {
      "rows": [
        { "Status": 1 },
        { "Status": 1 }
      ]
    }
  }
}
```

### When Greedy Matching Can Fail

Consider this scenario:

```json
// Actual database has 3 rows:
// - { UserID: "A", Status: 1 }
// - { UserID: "B", Status: 1 }
// - { UserID: "C", Status: 2 }

// Expectations:
{
  "tables": {
    "Users": {
      "rows": [
        { "Status": 1 },      // ① Ambiguous - matches A or B
        { "UserID": "A" }     // ② Specific - needs A
      ]
    }
  }
}
```

The greedy algorithm will:

1. Process expectation ①, match it to the first row with `Status: 1` (e.g., row A), and consume row A
2. Process expectation ②, look for `UserID: "A"`, but row A was already consumed
3. **Result: Assertion fails** even though a valid assignment exists

**Solution**: Make expectations specific:

```json
{
  "tables": {
    "Users": {
      "rows": [
        {
          "UserID": "A",
          "Status": 1
        },
        {
          "UserID": "B",
          "Status": 1
        }
      ]
    }
  }
}
```

### Combining `count` and `rows`

Use both for comprehensive validation:

```json
{
  "tables": {
    "Users": {
      "count": 10,
      "rows": [
        {
          "UserID": "admin-001",
          "Role": "admin"
        }
      ]
    }
  }
}
```

This ensures:

- Exactly 10 users exist (not 9 or 11)
- At least one admin user with ID "admin-001" exists

## License

MIT
