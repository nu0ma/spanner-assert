import { Spanner } from '@google-cloud/spanner';

import { spannerAssert } from '../../dist/index.js';

const projectId = process.env.SPANNER_PROJECT ?? 'e2e-project';
const instanceId = process.env.SPANNER_INSTANCE ?? 'e2e-instance';
const databaseId = process.env.SPANNER_DATABASE ?? 'e2e-database';
const emulatorHost = process.env.SPANNER_EMULATOR_HOST ?? '127.0.0.1:9010';

async function seedSamples(database) {
  await database.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      {
        sql: 'DELETE FROM Samples WHERE TRUE',
      },
      {
        sql: 'INSERT INTO Samples (Id, Name) VALUES (@id, @name)',
        params: {
          id: '1',
          name: 'Default Name',
        },
      },
    ]);
    await transaction.commit();
  });
}

async function main() {
  const spanner = new Spanner({
    projectId,
    emulatorHost,
  });

  const instance = spanner.instance(instanceId);
  const database = instance.database(databaseId);

  try {
    await seedSamples(database);

    await spannerAssert.assert('tests/e2e/fixtures/expectations/samples.yaml');
    console.log('E2E assertion succeeded.');
  } finally {
    await spannerAssert.close();
    await database.close();
    await spanner.close();
  }
}

main().catch((error) => {
  console.error('E2E assertion failed:', error);
  process.exitCode = 1;
});
