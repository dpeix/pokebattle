import { getTableColumns, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { DbClient, Transaction } from "../db/client.js";
import {
  abilities,
  items,
  moveStatChanges,
  moves,
  natures,
  pokemon,
  pokemonAbilities,
  pokemonMoves,
  pokemonSpecies,
  stats,
  typeEfficacy,
  types,
  versionGroups,
} from "../db/schema.js";
import type { PokeapiData } from "./transform.js";

export type ImportCounts = Record<keyof PokeapiData, number>;

// PostgreSQL accepts at most 65535 parameters in one statement.
const MAX_PARAMETERS = 65_535;

async function insertInBatches<TTable extends PgTable>(
  tx: Transaction,
  table: TTable,
  rows: TTable["$inferInsert"][],
): Promise<void> {
  const batchSize = Math.floor(
    MAX_PARAMETERS / Object.keys(getTableColumns(table)).length,
  );
  for (let start = 0; start < rows.length; start += batchSize) {
    await tx.insert(table).values(rows.slice(start, start + batchSize));
  }
}

/**
 * Replaces the content of the imported tables with `data`, in a single
 * transaction: on failure, the previous import is left untouched.
 */
export async function loadPokeapiData(
  db: DbClient,
  data: PokeapiData,
): Promise<ImportCounts> {
  await db.transaction(async (tx) => {
    // Without CASCADE: should a future table reference this data, the
    // import fails instead of silently deleting that table's rows.
    await tx.execute(
      sql`truncate table ${pokemonMoves}, ${pokemonAbilities}, ${pokemon}, ${pokemonSpecies}, ${moveStatChanges}, ${moves}, ${abilities}, ${natures}, ${stats}, ${typeEfficacy}, ${types}, ${versionGroups}, ${items}`,
    );
    // Referenced tables first.
    await insertInBatches(tx, versionGroups, data.versionGroups);
    await insertInBatches(tx, types, data.types);
    await insertInBatches(tx, typeEfficacy, data.typeEfficacy);
    await insertInBatches(tx, stats, data.stats);
    await insertInBatches(tx, natures, data.natures);
    await insertInBatches(tx, abilities, data.abilities);
    await insertInBatches(tx, moves, data.moves);
    await insertInBatches(tx, moveStatChanges, data.moveStatChanges);
    await insertInBatches(tx, pokemonSpecies, data.pokemonSpecies);
    await insertInBatches(tx, pokemon, data.pokemon);
    await insertInBatches(tx, pokemonAbilities, data.pokemonAbilities);
    await insertInBatches(tx, items, data.items);
    await insertInBatches(tx, pokemonMoves, data.pokemonMoves);
  });

  return Object.fromEntries(
    Object.entries(data).map(([table, rows]) => [table, rows.length]),
  ) as ImportCounts;
}
