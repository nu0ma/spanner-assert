import { describe, expect, it, vi } from 'vitest';

import { createSpannerAssert, SpannerAssertionError } from '../src/index.js';
import type { ExpectationsFile } from '../src/types.js';

type Row = { toJSON(): Record<string, unknown> };
type RunResult = Array<Row>;

function createRow(values: Record<string, unknown>) {
  return {
    toJSON: () => values,
  };
}

function createInstance(runMocks: RunResult[]) {
  const run = vi.fn();
  for (const result of runMocks) {
    run.mockResolvedValueOnce([result, undefined]);
  }
  const close = vi.fn().mockResolvedValue(undefined);
  const database = { run, close } as unknown as import('@google-cloud/spanner').Database;

  const instance = createSpannerAssert({
    connection: {
      projectId: 'project',
      instanceId: 'instance',
      databaseId: 'database',
    },
    clientDependencies: {
      database,
    },
  });

  return { instance, run, close };
}

describe('SpannerAssert', () => {
  it('succeeds when expectations are met', async () => {
    const expectations: ExpectationsFile = {
      tables: {
        Samples: {
          count: 1,
          columns: {
            Id: '1',
            Name: 'Default Name',
          },
        },
      },
    };

    const runResults: RunResult[] = [
      [createRow({ total: '1' })],
      [createRow({ total: '1' })],
    ];

    const { instance, run } = createInstance(runResults);

    await expect(instance.assertExpectations(expectations)).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(2);
    await instance.close();
  });

  it('fails when row count differs', async () => {
    const expectations: ExpectationsFile = {
      tables: {
        Samples: {
          count: 2,
        },
      },
    };

    const runResults: RunResult[] = [[createRow({ total: '1' })]];
    const { instance } = createInstance(runResults);

    await expect(instance.assertExpectations(expectations)).rejects.toBeInstanceOf(
      SpannerAssertionError,
    );
    await instance.close();
  });

  it('fails when no rows match column expectations', async () => {
    const expectations: ExpectationsFile = {
      tables: {
        Samples: {
          columns: {
            Id: '2',
          },
        },
      },
    };

    const runResults: RunResult[] = [[createRow({ total: '0' })]];
    const { instance } = createInstance(runResults);

    await expect(instance.assertExpectations(expectations)).rejects.toBeInstanceOf(
      SpannerAssertionError,
    );
    await instance.close();
  });

  it('fails immediately when table name is invalid', async () => {
    const expectations: ExpectationsFile = {
      tables: {
        'invalid-table': {
          count: 1,
        },
      },
    };

    const runResults: RunResult[] = [];
    const { instance } = createInstance(runResults);

    await expect(instance.assertExpectations(expectations)).rejects.toBeInstanceOf(
      SpannerAssertionError,
    );
    await instance.close();
  });
});
