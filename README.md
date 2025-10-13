## spanner-assert

Minimal utilities to verify Cloud Spanner table contents against YAML expectations.

### Install

```bash
npm install spanner-assert
```

### Usage

```ts
import { spannerAssert } from 'spanner-assert';

await spannerAssert.assert('path/to/expectations.yaml');
```

Provide connection settings with environment variables such as `SPANNER_ASSERT_PROJECT_ID` and `SPANNER_EMULATOR_HOST`. See `tests/e2e` for a working example.
