// Storage of the battles: their state is a JSON document, updated with
// optimistic locking on `version`.
import { and, eq, sql } from "drizzle-orm";
import type { BattleState } from "../battle/types.js";
import type { DbClient } from "../db/client.js";
import { battles } from "../db/schema.js";

export interface StoredBattle {
  state: BattleState;
  version: number;
}

/** Returns the new battle's id. */
export async function insertBattle(
  db: DbClient,
  state: BattleState,
): Promise<string> {
  const [row] = await db
    .insert(battles)
    .values({ state })
    .returning({ id: battles.id });
  if (row === undefined) {
    throw new Error("the battle was not inserted");
  }
  return row.id;
}

export async function findBattle(
  db: DbClient,
  id: string,
): Promise<StoredBattle | undefined> {
  const [row] = await db
    .select({ state: battles.state, version: battles.version })
    .from(battles)
    .where(eq(battles.id, id));
  return row;
}

/**
 * Stores `state` if the battle is still at `expectedVersion`; false when
 * another action updated it in the meantime.
 */
export async function updateBattle(
  db: DbClient,
  id: string,
  state: BattleState,
  expectedVersion: number,
): Promise<boolean> {
  const rows = await db
    .update(battles)
    .set({
      state,
      version: sql`${battles.version} + 1`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(battles.id, id), eq(battles.version, expectedVersion)))
    .returning({ id: battles.id });
  return rows.length === 1;
}
