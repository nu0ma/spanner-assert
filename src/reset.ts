import type { Database } from "@google-cloud/spanner";
import { consola } from "consola";

import { SpannerAssertionError } from "./errors.ts";
import { quoteIdentifier } from "./fetch.ts";

/**
 * Reset (delete all data from) the specified tables in the database.
 *
 * @param database - Spanner Database instance
 * @param tableNames - Array of table names to reset
 * @throws {SpannerAssertionError} If table names contain invalid characters or reset fails
 */
export async function resetDatabase(
  database: Database,
  tableNames: string[]
): Promise<void> {
  if (tableNames.length === 0) {
    consola.warn("No tables specified for reset");
    return;
  }

  // Validate all table names first
  const quotedTableNames = tableNames.map((tableName) => {
    try {
      return quoteIdentifier(tableName);
    } catch (error) {
      consola.error(`Invalid table name: ${tableName}`);
      throw error;
    }
  });

  // Build DELETE statements
  const deleteStatements = quotedTableNames.map((quotedName) => ({
    sql: `DELETE FROM ${quotedName} WHERE TRUE`,
  }));

  // Execute all DELETEs in a single transaction
  try {
    await database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate(deleteStatements);
      await transaction.commit();
    });

    consola.success(`Reset ${tableNames.length} table(s): ${tableNames.join(", ")}`);
  } catch (error) {
    consola.error("Failed to reset tables", error);
    throw new SpannerAssertionError("Failed to reset database tables", {
      tables: tableNames,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
