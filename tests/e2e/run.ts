import path from "node:path";

import { Spanner } from "@google-cloud/spanner";

import { createSpannerAssert } from "../../src/index.ts";

const fixturesDir = "tests/e2e/fixtures";

async function seedSamples(
  database: import("@google-cloud/spanner").Database
): Promise<void> {
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

async function main(): Promise<void> {
  const projectId = process.env.SPANNER_PROJECT ?? "e2e-project";
  const instanceId = process.env.SPANNER_INSTANCE ?? "e2e-instance";
  const databaseId = process.env.SPANNER_DATABASE ?? "e2e-database";
  const emulatorHost = process.env.SPANNER_EMULATOR_HOST ?? "127.0.0.1:9010";

  const spanner = new Spanner({
    projectId,
    servicePath: emulatorHost.split(":")[0],
    port: Number.parseInt(emulatorHost.split(":")[1] || "9010"),
  });

  const instance = spanner.instance(instanceId);
  const database = instance.database(databaseId);

  const spannerAssert = createSpannerAssert({
    connection: {
      projectId,
      instanceId,
      databaseId,
      emulatorHost,
    },
    clientDependencies: {
      database,
    },
  });

  try {
    console.log("Seeding sample data...");
    await seedSamples(database);

    console.log("Running expectation assertions...");
    await spannerAssert.assert(
      path.join(fixturesDir, "expectations", "samples.yaml")
    );

    console.log("✅ All assertions passed!");
  } catch (error) {
    console.error("❌ E2E test failed:");
    console.error(error);
    throw error;
  } finally {
    console.log("Closing client resources...");
    await database.close();
    spanner.close();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
