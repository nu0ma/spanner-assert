import path from "node:path";

import { Spanner } from "@google-cloud/spanner";

import { createSpannerAssert } from "../../src/index.ts";

const fixturesDir = "tests/e2e/fixtures";

async function seedSamples(
  database: import("@google-cloud/spanner").Database,
): Promise<void> {
  const createdAt = "2024-01-01T00:00:00Z";

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
               VALUES (@userId, @name, @email, @status, @createdAt)`,
        params: {
          userId: "user-001",
          name: "Alice Example",
          email: "alice@example.com",
          status: 1,
          createdAt,
        },
      },
      {
        sql: `INSERT INTO Products (ProductID, Name, Price, IsActive, CategoryID, CreatedAt)
               VALUES (@productId, @name, @price, @isActive, @categoryId, @createdAt)`,
        params: {
          productId: "product-001",
          name: "Example Product",
          price: 1999,
          isActive: true,
          categoryId: null,
          createdAt,
        },
      },
      {
        sql: `INSERT INTO Books (BookID, Title, Author, PublishedYear, JSONData)
               VALUES (@bookId, @title, @author, @publishedYear,
                       @jsonData)` ,
        params: {
          bookId: "book-001",
          title: "Example Book",
          author: "Jane Doe",
          publishedYear: 2024,
          jsonData: '{"genre":"fiction","pages":320}',
        },
      },
    ]);
    await transaction.commit();
  });
}

async function main(): Promise<void> {
  const projectId = process.env.SPANNER_PROJECT ?? "e2e-project";
  const instanceId = process.env.SPANNER_INSTANCE ?? "e2e-instance";
  const databaseId = process.env.SPANNER_DATABASE ?? "e2e-database";
  const emulatorHost = process.env.SPANNER_EMULATOR_HOST ?? "127.0.0.1:9010";

  const spannerAssert = createSpannerAssert({
    connection: {
      projectId,
      instanceId,
      databaseId,
      emulatorHost,
    },
  });

  const spanner = new Spanner({
    projectId,
  });

  const instance = spanner.instance(instanceId);
  const database = instance.database(databaseId);

  try {
    console.info("Seeding sample data...");
    await seedSamples(database);
    console.info("Running expectation assertions...");
    await spannerAssert.assert(path.join(fixturesDir, "expectations", "samples.yaml"));
    console.info("E2E assertion succeeded.");
  } finally {
    console.info("Closing client resources...");
    await database.close();
    await spanner.close();
  }

  console.info("E2E script completed.");
}

main().catch((error) => {
  console.error("E2E assertion failed:", error);
  process.exitCode = 1;
});
