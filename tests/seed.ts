import { Spanner } from "@google-cloud/spanner";

import { config } from "./playwright/config.ts";

export async function seed() {
  const spanner = new Spanner({
    projectId: config.projectID,
    servicePath: config.emulatorHost.split(":")[0],
    port: 9010,
  });
  const instance = spanner.instance(config.instanceID);
  const database = instance.database(config.databaseID);
  await seedSamples(database);
}

export async function seedSamples(
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
        sql: "DELETE FROM ArrayTests WHERE TRUE",
      },
      {
        sql: "DELETE FROM JsonTests WHERE TRUE",
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
      {
        sql: `INSERT INTO ArrayTests (TestID, Tags, Scores, Flags)
               VALUES (@testId, @tags, @scores, @flags)`,
        params: {
          testId: "array-001",
          tags: ["javascript", "typescript", "node"],
          scores: [100, 200, 300],
          flags: [true, false, true],
        },
        types: {
          testId: { type: "string" },
          tags: { type: "array", child: { type: "string" } },
          scores: { type: "array", child: { type: "int64" } },
          flags: { type: "array", child: { type: "bool" } },
        },
      },
      {
        sql: `INSERT INTO ArrayTests (TestID, Tags, Scores, Flags)
               VALUES (@testId, @tags, @scores, @flags)`,
        params: {
          testId: "array-002",
          tags: ["react", "vue"],
          scores: [95, 87],
          flags: [true, true],
        },
        types: {
          testId: { type: "string" },
          tags: { type: "array", child: { type: "string" } },
          scores: { type: "array", child: { type: "int64" } },
          flags: { type: "array", child: { type: "bool" } },
        },
      },
      {
        sql: `INSERT INTO ArrayTests (TestID, Tags, Scores, Flags)
               VALUES (@testId, @tags, @scores, @flags)`,
        params: {
          testId: "array-003",
          tags: [],
          scores: [],
          flags: [],
        },
        types: {
          testId: { type: "string" },
          tags: { type: "array", child: { type: "string" } },
          scores: { type: "array", child: { type: "int64" } },
          flags: { type: "array", child: { type: "bool" } },
        },
      },
      // JSON test data: Simple object
      {
        sql: `INSERT INTO JsonTests (TestID, Metadata, Config, Items)
               VALUES (@testId, @metadata, @config, @items)`,
        params: {
          testId: "json-001",
          metadata: { genre: "Fiction", rating: 4.5, inStock: true },
          config: { enabled: true, maxRetries: 3 },
          items: null,
        },
        types: {
          testId: { type: "string" },
          metadata: { type: "json" },
          config: { type: "json" },
          items: { type: "json" },
        },
      },
      // JSON test data: Nested structure
      {
        sql: `INSERT INTO JsonTests (TestID, Metadata, Config, Items)
               VALUES (@testId, @metadata, @config, @items)`,
        params: {
          testId: "json-002",
          metadata: {
            author: { name: "John Doe", email: "john@example.com" },
            tags: ["tech", "tutorial"],
          },
          config: {
            settings: { theme: "dark", notifications: { email: true, push: false } },
          },
          items: null,
        },
        types: {
          testId: { type: "string" },
          metadata: { type: "json" },
          config: { type: "json" },
          items: { type: "json" },
        },
      },
      // JSON test data: Arrays (for order-insensitive testing)
      // Note: Top-level JSON arrays must be passed as strings to avoid ARRAY<JSON> interpretation
      {
        sql: `INSERT INTO JsonTests (TestID, Metadata, Config, Items)
               VALUES (@testId, @metadata, @config, @items)`,
        params: {
          testId: "json-003",
          metadata: null,
          config: null,
          items: JSON.stringify([
            { id: 1, name: "Item A" },
            { id: 2, name: "Item B" },
            { id: 3, name: "Item C" },
          ]),
        },
        types: {
          testId: { type: "string" },
          metadata: { type: "json" },
          config: { type: "json" },
          items: { type: "json" },
        },
      },
      // JSON test data: Complex mixed structure
      {
        sql: `INSERT INTO JsonTests (TestID, Metadata, Config, Items)
               VALUES (@testId, @metadata, @config, @items)`,
        params: {
          testId: "json-004",
          metadata: {
            version: "1.0",
            features: ["feature1", "feature2", "feature3"],
            stats: { views: 1000, likes: 50 },
          },
          config: { options: ["opt1", "opt2"] },
          items: JSON.stringify([1, 2, 3, 4, 5]),
        },
        types: {
          testId: { type: "string" },
          metadata: { type: "json" },
          config: { type: "json" },
          items: { type: "json" },
        },
      },
      // JSON test data: Edge cases (empty objects/arrays)
      {
        sql: `INSERT INTO JsonTests (TestID, Metadata, Config, Items)
               VALUES (@testId, @metadata, @config, @items)`,
        params: {
          testId: "json-005",
          metadata: {},
          config: { empty: [] },
          items: JSON.stringify([]),
        },
        types: {
          testId: { type: "string" },
          metadata: { type: "json" },
          config: { type: "json" },
          items: { type: "json" },
        },
      },
    ]);
    await transaction.commit();
  });
}
