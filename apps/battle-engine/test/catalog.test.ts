import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  findLearnableMoves,
  findPokemonDetail,
  listSelectablePokemon,
} from "../src/data/catalog.js";
import { createDb, type Database, type DbClient } from "../src/db/client.js";
import { requireEnv } from "../src/env.js";
import { importPokeapi } from "../src/import/pokeapi.js";
import { directorySource } from "../src/import/source.js";
import { FIXTURES, inRolledBackTransaction } from "./database.js";

// Requires the database container: `pnpm db:up` with a filled-in .env.
describe("catalog", () => {
  let db: Database;

  beforeAll(() => {
    db = createDb(requireEnv("DATABASE_URL"));
  });

  afterAll(async () => {
    await db.$client.end();
  });

  /** Runs `test` on the fixtures, in a transaction that is rolled back. */
  const withFixtures = (test: (tx: DbClient) => Promise<void>) =>
    inRolledBackTransaction(db, async (tx) => {
      await importPokeapi(tx, directorySource(FIXTURES));
      await test(tx);
    });

  it("lists the default forms that can learn a damaging move", async () => {
    await withFixtures(async (tx) => {
      const list = await listSelectablePokemon(tx);

      // Mega Charizard X and Koraidon's Limited Build are not default forms.
      expect(list.map((entry) => entry.identifier)).toEqual([
        "bulbasaur",
        "charizard",
        "pikachu",
        "koraidon",
      ]);
      expect(list[2]).toEqual({
        id: 25,
        identifier: "pikachu",
        nameFr: "Pikachu",
        nameEn: "Pikachu",
        types: [
          { identifier: "electric", nameFr: "Électrik", nameEn: "Electric" },
        ],
        baseStats: {
          hp: 35,
          attack: 55,
          defense: 40,
          specialAttack: 50,
          specialDefense: 50,
          speed: 90,
        },
      });
      expect(list[1]?.types.map((type) => type.identifier)).toEqual([
        "fire",
        "flying",
      ]);
    });
  });

  it("details a Pokémon with its damaging moves from every game, once each", async () => {
    await withFixtures(async (tx) => {
      const charizard = await findPokemonDetail(tx, 6);

      // Swords Dance is a status move; Flamethrower is learnt twice.
      expect(charizard?.moves.map((move) => move.identifier)).toEqual([
        "flamethrower",
        "dragon-claw",
        "tera-blast",
      ]);
      expect(charizard?.moves[0]).toEqual({
        id: 53,
        identifier: "flamethrower",
        nameFr: "Lance-Flammes",
        nameEn: "Flamethrower",
        type: { identifier: "fire", nameFr: "Feu", nameEn: "Fire" },
        power: 90,
        accuracy: 100,
        pp: 15,
        priority: 0,
        damageClass: "special",
      });
    });
  });

  it("finds no detail for an unknown or non-selectable Pokémon", async () => {
    await withFixtures(async (tx) => {
      expect(await findPokemonDetail(tx, 10034)).toBeUndefined();
      expect(await findPokemonDetail(tx, 999_999)).toBeUndefined();
    });
  });

  it("defaults the critical hit stage of moves without battle metadata to 0", async () => {
    await withFixtures(async (tx) => {
      const learnable = await findLearnableMoves(tx, [1]);

      expect(learnable.get(1)).toMatchObject([
        { identifier: "tackle", critRate: 0, type: { id: 1 } },
        { identifier: "tera-blast", critRate: 0 },
      ]);
    });
  });
});
