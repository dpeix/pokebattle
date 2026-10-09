import { fileURLToPath } from "node:url";
import { count, eq, TransactionRollbackError } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database, type DbClient } from "../src/db/client.js";
import { moves, pokemon, pokemonMoves, types } from "../src/db/schema.js";
import { requireEnv } from "../src/env.js";
import { loadPokeapiData } from "../src/import/load.js";
import { importPokeapi, readPokeapiCsv } from "../src/import/pokeapi.js";
import { type CsvSource, directorySource } from "../src/import/source.js";
import { transformPokeapi } from "../src/import/transform.js";

const FIXTURES = fileURLToPath(new URL("fixtures/pokeapi", import.meta.url));

// Requires the database container: `pnpm db:up` with a filled-in .env.
describe("importPokeapi", () => {
  let db: Database;

  beforeAll(() => {
    db = createDb(requireEnv("DATABASE_URL"));
  });

  afterAll(async () => {
    await db.$client.end();
  });

  /**
   * Runs `test` in a transaction that is always rolled back, so the tests
   * never touch the data imported in the development database.
   */
  async function inRolledBackTransaction(
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

  async function countRows(tx: DbClient, table: PgTable) {
    const [row] = await tx.select({ value: count() }).from(table);
    return row?.value;
  }

  it("imports the CSV data into the database", async () => {
    await inRolledBackTransaction(async (tx) => {
      const counts = await importPokeapi(tx, directorySource(FIXTURES));

      expect(counts).toMatchObject({ pokemon: 6, moves: 6, pokemonMoves: 29 });
      const [pikachu] = await tx
        .select()
        .from(pokemon)
        .where(eq(pokemon.identifier, "pikachu"));
      expect(pikachu).toMatchObject({ nameFr: "Pikachu", speed: 90 });
      const [thunderbolt] = await tx
        .select({ flags: moves.flags })
        .from(moves)
        .where(eq(moves.identifier, "thunderbolt"));
      expect(thunderbolt?.flags).toEqual(["protect", "mirror"]);
    });
  });

  it("replaces the previous import when run again", async () => {
    await inRolledBackTransaction(async (tx) => {
      const source = directorySource(FIXTURES);
      const first = await importPokeapi(tx, source);
      await tx.insert(types).values({ id: 999, identifier: "obsolete" });

      const second = await importPokeapi(tx, source);

      expect(second).toEqual(first);
      expect(await countRows(tx, types)).toBe(8);
      expect(await countRows(tx, pokemonMoves)).toBe(29);
    });
  });

  it("writes nothing when a CSV file cannot be read", async () => {
    await inRolledBackTransaction(async (tx) => {
      await importPokeapi(tx, directorySource(FIXTURES));
      const fixtures = directorySource(FIXTURES);
      const missingItems: CsvSource = (file) =>
        file === "items"
          ? Promise.reject(new Error("items.csv unavailable"))
          : fixtures(file);

      await expect(importPokeapi(tx, missingItems)).rejects.toThrow(
        "items.csv unavailable",
      );

      expect(await countRows(tx, pokemon)).toBe(6);
    });
  });

  it("keeps the previous import when loading fails midway", async () => {
    await inRolledBackTransaction(async (tx) => {
      const csv = await readPokeapiCsv(directorySource(FIXTURES));
      const data = transformPokeapi(csv);
      await loadPokeapiData(tx, data);
      // Learnsets are inserted last: an unknown move fails the foreign key
      // after every other table has been emptied and refilled.
      const broken = {
        ...data,
        pokemonMoves: [
          ...data.pokemonMoves,
          {
            pokemonId: 25,
            versionGroupId: 25,
            moveId: 9999,
            method: "machine",
            level: 0,
          },
        ],
      };

      await expect(loadPokeapiData(tx, broken)).rejects.toThrow();

      expect(await countRows(tx, pokemonMoves)).toBe(29);
    });
  });
});
