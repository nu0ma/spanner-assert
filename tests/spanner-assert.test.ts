import { describe, expect, it, vi } from 'vitest';

import { SpannerAssert, SpannerAssertionError } from '../src/index.js';
import type { ExpectationsFile } from '../src/types.js';

type Row = { toJSON(): Record<string, unknown> };
type RunResult = Array<Row>;

function createRow(values: Record<string, unknown>) {
  return {
    toJSON: () => values,
  };
}

function createSpannerAssert(runMocks: RunResult[]) {
  const run = vi.fn();
  runMocks.forEach((result) => run.mockResolvedValueOnce([result, undefined]));
  const close = vi.fn().mockResolvedValue(undefined);
  const database = { run, close } as unknown as import('@google-cloud/spanner').Database;

  const instance = new SpannerAssert({
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
  it('期待値通りなら成功する', async () => {
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

    const { instance, run } = createSpannerAssert(runResults);

    await expect(instance.assertExpectations(expectations)).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(2);
    await instance.close();
  });

  it('件数が一致しなければ失敗する', async () => {
    const expectations: ExpectationsFile = {
      tables: {
        Samples: {
          count: 2,
        },
      },
    };

    const runResults: RunResult[] = [[createRow({ total: '1' })]];
    const { instance } = createSpannerAssert(runResults);

    await expect(instance.assertExpectations(expectations)).rejects.toBeInstanceOf(
      SpannerAssertionError,
    );
    await instance.close();
  });

  it('列条件に合致するレコードが無ければ失敗する', async () => {
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
    const { instance } = createSpannerAssert(runResults);

    await expect(instance.assertExpectations(expectations)).rejects.toBeInstanceOf(
      SpannerAssertionError,
    );
    await instance.close();
  });

  it('不正なテーブル名は即座に失敗する', async () => {
    const expectations: ExpectationsFile = {
      tables: {
        'invalid-table': {
          count: 1,
        },
      },
    };

    const runResults: RunResult[] = [];
    const { instance } = createSpannerAssert(runResults);

    await expect(instance.assertExpectations(expectations)).rejects.toBeInstanceOf(
      SpannerAssertionError,
    );
    await instance.close();
  });
});
