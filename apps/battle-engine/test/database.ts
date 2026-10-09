import { fileURLToPath } from "node:url";
import { TransactionRollbackError } from "drizzle-orm";
import type { Database, DbClient } from "../src/db/client.js";

/** A subset of the PokeAPI CSV files, see test/fixtures/pokeapi. */
export const FIXTURES = fileURLToPath(
  new URL("fixtures/pokeapi", import.meta.url),
);

/**
 * Runs `test` in a transaction that is always rolled back, so the tests
 * never touch the data imported in the development database.
 */
export async function inRolledBackTransaction(
  db: Database,
  test: (tx: DbClient) => Promise<void>,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await test(tx);
      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) {
      throw error;
    }
  }
}
