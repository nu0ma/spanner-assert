import { Spanner } from "@google-cloud/spanner";

export async function seed() {
  const spanner = new Spanner({
    projectId: "e2e-project",
    servicePath: "127.0.0.1",
    port: 9010,
  });
  const instance = spanner.instance("e2e-instance");
  const database = instance.database("e2e-database");
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
