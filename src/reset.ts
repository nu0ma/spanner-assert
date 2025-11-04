import type { Database } from "@google-cloud/spanner";

import { SpannerAssertionError } from "./errors.ts";
import { quoteIdentifier } from "./fetch.ts";

/**
 * Resets (deletes all data from) the specified tables in the database.
 *
 * @param database - The Spanner database instance
 * @param tableNames - Array of table names to reset
 * @throws {SpannerAssertionError} If no tables are specified
 */
export async function resetTables(
  database: Database,
  tableNames: string[]
): Promise<void> {
  if (tableNames.length === 0) {
    throw new SpannerAssertionError("No tables specified for reset", {
      tableNames,
    });
  }

  await database.runTransactionAsync(async (transaction) => {
    const deleteStatements = tableNames.map((tableName) => ({
      sql: `DELETE FROM ${quoteIdentifier(tableName)} WHERE TRUE`,
    }));

    await transaction.batchUpdate(deleteStatements);
    await transaction.commit();
  });
}
