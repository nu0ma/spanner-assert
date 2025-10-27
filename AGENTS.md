# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`spanner-assert` is a Node.js testing library for validating Google Cloud Spanner **emulator** database state against JSON-defined expectations. It's designed exclusively for E2E testing workflows (especially with Playwright) to assert database records match expected values after UI interactions or API calls.

**⚠️ Emulator-only**: This library only supports Cloud Spanner emulator, not production databases.

**Core value**: Declarative JSON expectations for database assertions instead of imperative query-and-compare code.

## Development Commands

### Package Manager
**IMPORTANT**: This project enforces `pnpm` via preinstall hook. All `npm` commands will fail.

### Build & Quality
- `pnpm run build` - Compile TypeScript with tsdown (outputs to `dist/`)
- `pnpm run lint` / `pnpm run lint:fix` - ESLint
- `pnpm run prettier` / `pnpm run prettier:fix` - Code formatting
- `pnpm run typecheck` - Type check without emitting files

### Testing
- `pnpm run test` - Run vitest unit tests
- **`task test:emulator`** - Recommended: Full E2E test with automatic emulator lifecycle
- **`task test:playwright`** - Run Playwright tests with automatic emulator setup

### Task Runner (Taskfile.yml)
The project uses [Task](https://taskfile.dev) for orchestrating emulator workflows:

- `task emulator:up` - Start Spanner emulator in Docker (ports 9010 gRPC, 9020 admin)
- `task emulator:down` - Stop emulator container
- `task emulator:setup` - Create instance/database using `wrench` CLI
- `task test:emulator` - Complete E2E cycle: start emulator → setup schema → seed → test → cleanup

## Architecture

### Data Flow
```
assert(expectations)
  → assertExpectations() - Iterate tables
  → assertTable() - Validate count & rows
  → fetchAllRows() / fetchCount() - Execute SQL
  → findMissingRows() - Compare expected vs actual
  → throw SpannerAssertionError with jest-diff output
```

### Core Components

#### Entry Point: `createSpannerAssert()` (src/spanner-assert.ts)
Returns `SpannerAssertInstance` with:
- `assert(expectations: ExpectationsFile): Promise<void>` - Run assertions, throw on mismatch
- `getConnectionInfo(): SpannerConnectionConfig` - Get resolved connection config

**Connection lifecycle**: Database connection opened in factory, closed in `finally` after each `assert()` call.

#### Configuration (src/config.ts)
**Required**: `projectId`, `instanceId`, `databaseId`, `emulatorHost`

#### Database Client (src/spanner-client.ts)
**Emulator-only configuration** (always applied):
```typescript
const [host, portStr] = config.emulatorHost.split(":");
const port = parseInt(portStr || "9010");

clientConfig.servicePath = host;
clientConfig.port = port;
clientConfig.sslCreds = undefined;  // Emulator uses insecure credentials
```

#### Assertion Engine (src/assertion.ts)
Two assertion types:
1. **count**: `SELECT COUNT(*) FROM table` validation
2. **rows**: Specific row value validation

Throws `SpannerAssertionError` with structured details (table, expected, actual).

#### Data Fetching (src/fetch.ts)
**SQL safety**:
- Identifiers validated with `/^[A-Za-z][A-Za-z0-9_]*$/` and backtick-quoted
- Parameterized queries with `@paramName` placeholders
- NULL handling: `IS NULL` for null values, `= @param` for non-null

**Row matching** (`findMissingRows()`):
- Greedy matching: finds first matching actual row, removes from pool
- **Subset matching**: Only columns in expected row are compared
- Returns list of expected rows not found

**Comparison logic** (`rowMatches()`):
```typescript
for (const [column, expectedValue] of Object.entries(expected)) {
  const actualValue = actual[column];
  if (expectedValue === null) {
    if (actualValue !== null) return false;  // Strict null check
  } else {
    if (actualValue !== expectedValue) return false;  // Direct equality
  }
}
```

**Numeric normalization**: Converts Spanner INT64 (bigint) → number for JavaScript compatibility.

#### Error Formatting (src/errors.ts)
`SpannerAssertionError`:
- Uses `jest-diff` for visual comparison (green expected, red actual)
- `picocolors` for colored terminal output
- Stores structured `details` object for programmatic access

Example output:
```
SpannerAssertionError: 1 expected row(s) not found in table "Users".
  - Expected
  + Actual

  Array [
    Object {
-     "Email": "alice@example.com",
+     "Email": "bob@example.com",
    },
  ]
```

### Type System (src/types.ts)
- `ColumnValue = string | number | boolean | null` - Supported primitive types
- `TableExpectation = { count?: number; rows: TableColumnExpectations[] }`
- Only primitives supported - TIMESTAMP/DATE must be compared as strings in JSON

## Testing Infrastructure

### E2E Test Pattern (tests/e2e/run.ts)
1. Initialize Spanner client pointing to emulator
2. Seed test data with `seedSamples(database)`
3. Import JSON expectations and run `spannerAssert.assert(expectations)`
4. Clean up in `finally` block

### Seed Data Best Practice (tests/seed.ts)
Use transactions for atomic setup:
```typescript
await database.runTransactionAsync(async (transaction) => {
  await transaction.batchUpdate([
    { sql: "DELETE FROM Users WHERE TRUE" },  // Clean slate
    {
      sql: "INSERT INTO Users (...) VALUES (...)",
      params: { userId: "user-001", ... },
      types: { userId: { type: "string" }, ... }
    }
  ]);
  await transaction.commit();
});
```

**TIMESTAMP handling**: Convert to ISO string with `new Date(...).toISOString()`, use `TIMESTAMP(@param)` in SQL.

### Playwright Integration (tests/playwright/assert.spec.ts)
Create `SpannerAssertInstance` once, reuse across tests:
```typescript
import expectations from "./expectations.json" with { type: "json" };

// Minimal configuration (uses emulator defaults)
const spannerAssert = createSpannerAssert({
  connection: {
    projectId: "your-project-id",
    instanceId: "your-instance-id",
    emulatorHost: "127.0.0.1:9010",
    databaseId: "your-database",
  }
});

test.beforeAll(async () => {
  await seed();  // Setup once
});

test("validates database", async () => {
  await spannerAssert.assert(expectations);
});
```

### Emulator Setup
**Docker**: `gcr.io/cloud-spanner-emulator/emulator` on ports 9010 (gRPC), 9020 (admin)

**Schema setup via `wrench`**:
```bash
wrench instance create
wrench create --database=X --schema_file=Y
```

**Environment variables** (Taskfile.yml defaults):
- `SPANNER_EMULATOR_HOST=127.0.0.1:9010`
- `SPANNER_PROJECT=e2e-project`
- `SPANNER_INSTANCE=e2e-instance`
- `SPANNER_DATABASE=e2e-database`

## Development Guidelines

### Identifier Naming
Table/column names must match `/^[A-Za-z][A-Za-z0-9_]*$/`:
- ✅ Valid: `Users`, `user_id`, `CreatedAt`
- ❌ Invalid: `user-id`, `2Users`, `User ID`

### JSON Expectation Best Practices

**1. Partial matching** - Only specify columns you care about:
```json
{
  "tables": {
    "Users": {
      "rows": [
        { "Email": "alice@example.com" }
      ]
    }
  }
}
```

**2. Avoid TIMESTAMP comparisons**:
```json
// ❌ Brittle
{ "CreatedAt": "2024-01-01T00:00:00Z" }

// ✅ Better - omit unpredictable columns
{
  "Email": "alice@example.com",
  "Status": 1
}
```

**3. Use count for totals, rows for specific data**:
```json
{
  "tables": {
    "Users": {
      "count": 10,
      "rows": [
        { "Email": "admin@example.com" }
      ]
    }
  }
}
```

**4. NULL handling**:
```json
{ "CategoryID": null }
```

### Adding New Features

**New assertion type**:
1. Add to `AssertionType` union in `src/assertion.ts:25`
2. Implement `assert{Type}()` function
3. Add case to switch in `assertTable()`

**New column types**:
1. Extend `ColumnValue` in `src/types.ts`
2. Update `rowMatches()` in `src/fetch.ts`
3. Add normalization if needed

## Troubleshooting

### Connection Issues
```bash
docker ps | grep spanner-emulator  # Check if running
task emulator:down && task emulator:up  # Restart
```

### Assertion Failures
Check error diff (green = expected, red = actual):
- Verify seed data inserted correctly
- Check column name casing (case-sensitive)
- Review data types (INT64 vs string)

**Common mistakes**:
- TIMESTAMP comparison (use strings or omit)
- Wrong NULL handling (`null` not `"null"`)
- Column name typos

### Identifier Errors
Rename tables/columns to match `/^[A-Za-z][A-Za-z0-9_]*$/`:
```sql
-- ❌ Invalid
CREATE TABLE user-sessions (...);

-- ✅ Valid
CREATE TABLE user_sessions (...);
```

## CI/CD

### GitHub Actions (.github/workflows/ci.yaml)
1. Setup: pnpm/Node.js/Task
2. Install `wrench` (Go tool for schema migration)
3. Run: lint, typecheck, `task test:emulator`, `task test:playwright`

**External dependency**: `wrench` CLI required for schema setup
```bash
go install github.com/cloudspannerecosystem/wrench@latest
```

## Key Implementation Details

### SQL Injection Prevention
Parameterized queries for all user values:
```typescript
const sql = `SELECT \`Email\` FROM \`Users\` WHERE \`Status\` = @status`;
const params = { status: userInput };  // Safe
```

### Connection Pooling
**Not used** - Each assertion creates new client. Intentional for test isolation but inefficient for high-volume usage.

### Greedy Row Matching
First expected row consumes first matching actual row. Use specific columns to avoid ambiguity when expectations overlap.
