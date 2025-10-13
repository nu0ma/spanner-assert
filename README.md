# spanner-assert

Validate Google Cloud Spanner data (emulator supported) against expectations written in YAML. Lightweight Node.js library, fast feedback loops.

## Install

```bash
pnpm add spanner-assert
```

## Quick Start

1. Start the Spanner emulator (optional) and set connection environment variables such as `SPANNER_ASSERT_PROJECT_ID`, `SPANNER_ASSERT_INSTANCE_ID`, `SPANNER_ASSERT_DATABASE_ID`, `SPANNER_EMULATOR_HOST`.

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
import { spannerAssert } from "spanner-assert";

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

## License

MIT
