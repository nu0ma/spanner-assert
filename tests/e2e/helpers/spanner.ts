import path from "node:path";

import { Spanner } from "@google-cloud/spanner";
import type { Database } from "@google-cloud/spanner";

import { createSpannerAssert } from "../../../src/index.ts";

const FIXTURES_ROOT = "tests/e2e/fixtures";

export interface SpannerTestEnv {
  projectId: string;
  instanceId: string;
  databaseId: string;
  emulatorHost: string;
}

export interface SpannerTestContext extends SpannerTestEnv {
  spanner: Spanner;
  database: Database;
  spannerAssert: ReturnType<typeof createSpannerAssert>;
}

const DEFAULT_ENV: SpannerTestEnv = {
  projectId: "e2e-project",
  instanceId: "e2e-instance",
  databaseId: "e2e-database",
  emulatorHost: "127.0.0.1:9010",
};

export function resolveSpannerEnv(): SpannerTestEnv {
  return {
    projectId: process.env.SPANNER_PROJECT ?? DEFAULT_ENV.projectId,
    instanceId: process.env.SPANNER_INSTANCE ?? DEFAULT_ENV.instanceId,
    databaseId: process.env.SPANNER_DATABASE ?? DEFAULT_ENV.databaseId,
    emulatorHost:
      process.env.SPANNER_EMULATOR_HOST ?? DEFAULT_ENV.emulatorHost,
  };
}

export function createSpannerTestContext(
  env: SpannerTestEnv = resolveSpannerEnv()
): SpannerTestContext {
  const [servicePath, portCandidate] = env.emulatorHost.split(":");
  const port = Number.parseInt(portCandidate ?? "9010", 10);

  const spanner = new Spanner({
    projectId: env.projectId,
    servicePath,
    port,
  });

  const database = spanner.instance(env.instanceId).database(env.databaseId);

  const spannerAssert = createSpannerAssert({
    connection: {
      projectId: env.projectId,
      instanceId: env.instanceId,
      databaseId: env.databaseId,
      emulatorHost: env.emulatorHost,
    },
    clientDependencies: {
      database,
    },
  });

  return {
    ...env,
    spanner,
    database,
    spannerAssert,
  };
}

export async function closeSpannerContext(
  context: Pick<SpannerTestContext, "database" | "spanner">
): Promise<void> {
  await context.database.close();
  context.spanner.close();
}

export function expectationsFixturePath(...segments: string[]): string {
  return path.join(FIXTURES_ROOT, "expectations", ...segments);
}

export async function seedSamples(database: Database): Promise<void> {
  const createdAt = new Date("2024-01-01T00:00:00Z").toISOString();

  await database.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      {
        sql: "DELETE FROM Users WHERE TRUE",
      },
      {
        sql: "DELETE FROM Products WHERE TRUE",
      },
      {
        sql: "DELETE FROM Books WHERE TRUE",
      },
      {
        sql: `INSERT INTO Users (UserID, Name, Email, Status, CreatedAt)
               VALUES (@userId, @name, @email, @status, TIMESTAMP(@createdAt))`,
        params: {
          userId: "user-001",
          name: "Alice Example",
          email: "alice@example.com",
          status: 1,
          createdAt,
        },
        types: {
          userId: { type: "string" },
          name: { type: "string" },
          email: { type: "string" },
          status: { type: "int64" },
          createdAt: { type: "string" },
        },
      },
      {
        sql: `INSERT INTO Products (ProductID, Name, Price, IsActive, CategoryID, CreatedAt)
               VALUES (@productId, @name, @price, @isActive, @categoryId, TIMESTAMP(@createdAt))`,
        params: {
          productId: "product-001",
          name: "Example Product",
          price: 1999,
          isActive: true,
          categoryId: null,
          createdAt,
        },
        types: {
          productId: { type: "string" },
          name: { type: "string" },
          price: { type: "int64" },
          isActive: { type: "bool" },
          categoryId: { type: "string" },
          createdAt: { type: "string" },
        },
      },
      {
        sql: `INSERT INTO Books (BookID, Title, Author, PublishedYear)
               VALUES (@bookId, @title, @author, @publishedYear)`,
        params: {
          bookId: "book-001",
          title: "Example Book",
          author: "Jane Doe",
          publishedYear: 2024,
        },
        types: {
          bookId: { type: "string" },
          title: { type: "string" },
          author: { type: "string" },
          publishedYear: { type: "int64" },
        },
      },
    ]);
    await transaction.commit();
  });
}
