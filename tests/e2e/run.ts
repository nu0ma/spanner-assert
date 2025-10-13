import { spawn, spawnSync } from 'node:child_process';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { Spanner } from '@google-cloud/spanner';

import { spannerAssert } from '../../dist/index.js';

process.on('exit', () => {
  spawnSync('docker', ['rm', '-f', emulatorContainer], {
    stdio: 'ignore',
  });
});
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    spawnSync('docker', ['rm', '-f', emulatorContainer], {
      stdio: 'ignore',
    });
    process.exit(1);
  });
});

const projectId = process.env.SPANNER_PROJECT ?? 'e2e-project';
const instanceId = process.env.SPANNER_INSTANCE ?? 'e2e-instance';
const databaseId = process.env.SPANNER_DATABASE ?? 'e2e-database';
const emulatorPort = Number(process.env.SPANNER_EMULATOR_PORT ?? '9010');
const emulatorHost =
  process.env.SPANNER_EMULATOR_HOST ?? `127.0.0.1:${emulatorPort.toString()}`;
const emulatorAdminPort = Number(process.env.SPANNER_EMULATOR_ADMIN_PORT ?? '9020');
const emulatorContainer =
  process.env.SPANNER_EMULATOR_CONTAINER ?? 'spanner-emulator';
const fixturesDir = 'tests/e2e/fixtures';
const schemaFile = path.join(fixturesDir, 'schema', 'schema.sql');

const dockerImage = 'gcr.io/cloud-spanner-emulator/emulator';

type SpawnOptions = {
  env?: NodeJS.ProcessEnv;
  ignoreError?: boolean;
  stdio?: 'inherit' | 'ignore';
};

async function runCommand(
  command: string,
  args: string[],
  options: SpawnOptions = {},
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.stdio ?? 'inherit',
      env: options.env ? { ...process.env, ...options.env } : process.env,
    });

    child.on('error', (error) => {
      if (options.ignoreError) {
        resolve();
        return;
      }
      reject(error);
    });

    child.on('exit', (code) => {
      if (code === 0 || options.ignoreError) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
      }
    });
  });
}

async function waitForPort(host: string, port: number, retries = 30): Promise<void> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const connected = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host, port });
      socket.once('connect', () => {
        socket.end();
        resolve(true);
      });
      socket.once('error', () => {
        resolve(false);
      });
    });

    if (connected) {
      return;
    }

    await delay(1000);
  }

  throw new Error(`Port ${host}:${port} did not become ready`);
}

async function startEmulator(): Promise<void> {
  await runCommand('docker', ['rm', '-f', emulatorContainer], {
    ignoreError: true,
    stdio: 'ignore',
  });
  console.info('Spanner emulator: starting container...');
  await runCommand(
    'docker',
    [
      'run',
      '-d',
      '--rm',
      '-p',
      `${emulatorPort}:9010`,
      '-p',
      `${emulatorAdminPort}:9020`,
      '--name',
      emulatorContainer,
      dockerImage,
    ],
    { stdio: 'ignore' },
  );
  const host = emulatorHost.split(':')[0] ?? '127.0.0.1';
  await waitForPort(host, emulatorPort);
  console.info('Spanner emulator: container is ready.');
}

async function stopEmulator(): Promise<void> {
  console.info('Spanner emulator: stopping container...');
  await runCommand('docker', ['rm', '-f', emulatorContainer], {
    ignoreError: true,
    stdio: 'ignore',
  });
}

async function setupEmulator(): Promise<void> {
  const baseEnv = {
    SPANNER_PROJECT_ID: projectId,
    SPANNER_INSTANCE_ID: instanceId,
    SPANNER_EMULATOR_HOST: emulatorHost,
  };

  await runCommand('wrench', ['instance', 'create'], { env: baseEnv, ignoreError: true });

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'spanner-assert-'));
  const schemaTarget = path.join(tmpDir, 'schema.sql');
  await copyFile(schemaFile, schemaTarget);

  try {
    await runCommand(
      'wrench',
      [
        'create',
        `--database=${databaseId}`,
        `--directory=${tmpDir}`,
        '--schema_file=schema.sql',
      ],
      { env: baseEnv, ignoreError: true },
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function seedSamples(
  database: import('@google-cloud/spanner').Database,
): Promise<void> {
  const createdAt = '2024-01-01T00:00:00Z';

  await database.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      {
        sql: 'DELETE FROM Users WHERE TRUE',
      },
      {
        sql: 'DELETE FROM Products WHERE TRUE',
      },
      {
        sql: 'DELETE FROM Books WHERE TRUE',
      },
      {
        sql: `INSERT INTO Users (UserID, Name, Email, Status, CreatedAt)
               VALUES (@userId, @name, @email, @status, @createdAt)`,
        params: {
          userId: 'user-001',
          name: 'Alice Example',
          email: 'alice@example.com',
          status: 1,
          createdAt,
        },
      },
      {
        sql: `INSERT INTO Products (ProductID, Name, Price, IsActive, CategoryID, CreatedAt)
               VALUES (@productId, @name, @price, @isActive, @categoryId, @createdAt)`,
        params: {
          productId: 'product-001',
          name: 'Example Product',
          price: 1999,
          isActive: true,
          categoryId: null,
          createdAt,
        },
      },
      {
        sql: `INSERT INTO Books (BookID, Title, Author, PublishedYear, JSONData)
               VALUES (@bookId, @title, @author, @publishedYear,
                       @jsonData)`,
        params: {
          bookId: 'book-001',
          title: 'Example Book',
          author: 'Jane Doe',
          publishedYear: 2024,
          jsonData: '{"genre":"fiction","pages":320}',
        },
      },
    ]);
    await transaction.commit();
  });
}

async function main(): Promise<void> {
  process.env.SPANNER_PROJECT = projectId;
  process.env.SPANNER_INSTANCE_ID = instanceId;
  process.env.SPANNER_DATABASE_ID = databaseId;
  process.env.SPANNER_EMULATOR_HOST = emulatorHost;
  process.env.GOOGLE_CLOUD_PROJECT = projectId;
  process.env.CLOUDSDK_API_ENDPOINT_OVERRIDES_SPANNER = `http://127.0.0.1:${emulatorAdminPort}/`;

  let emulatorRunning = false;

  await startEmulator();
  emulatorRunning = true;

  try {
    await setupEmulator();

    const spanner = new Spanner({
      projectId,
    });

    const instance = spanner.instance(instanceId);
    const database = instance.database(databaseId);

    try {
      console.info('Seeding sample data...');
      await seedSamples(database);
      console.info('Running expectation assertions...');
      try {
        await spannerAssert.assert(path.join(fixturesDir, 'expectations', 'samples.yaml'));
        console.info('E2E assertion succeeded.');
      } catch (error) {
        console.error('Assertion failed before cleanup.', error);
        throw error;
      }
    } finally {
      console.info('Closing client resources...');
      await spannerAssert.close();
      await database.close();
      await spanner.close();
    }
    await stopEmulator();
    emulatorRunning = false;
    console.info('Spanner emulator: stopped.');
  } finally {
    if (emulatorRunning) {
      await stopEmulator();
      console.info('Spanner emulator: stopped (forced).');
    }
  }

  console.info('E2E script completed.');
}

main().catch((error) => {
  console.error('E2E assertion failed:', error);
  process.exitCode = 1;
});
