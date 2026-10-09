import type { TeamMemberInput } from "@pokebattle/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BattleRuleError } from "../src/battle/engine.js";
import { findBattle, updateBattle } from "../src/data/battles.js";
import { loadTypeChart } from "../src/data/catalog.js";
import { createDb, type Database, type DbClient } from "../src/db/client.js";
import { requireEnv } from "../src/env.js";
import { importPokeapi } from "../src/import/pokeapi.js";
import { directorySource } from "../src/import/source.js";
import {
  BattleNotFoundError,
  createBattle,
  getBattle,
  playAction,
} from "../src/services/battles.js";
import { FIXTURES, inRolledBackTransaction } from "./database.js";

// Damaging moves each fixture Pokémon can learn.
const LEARNABLE: Record<number, number[]> = {
  1: [33, 851],
  6: [53, 337, 851],
  25: [85, 851],
  1007: [53, 337, 851],
};

const VALID_TEAM: TeamMemberInput[] = [
  { pokemonId: 25, moveIds: [85, 851] },
  { pokemonId: 6, moveIds: [53, 337, 851] },
  { pokemonId: 1, moveIds: [33] },
  { pokemonId: 1007, moveIds: [337, 53] },
  { pokemonId: 25, moveIds: [85] },
  { pokemonId: 6, moveIds: [851] },
];

const UNKNOWN_BATTLE = "00000000-0000-4000-8000-000000000000";

// Requires the database container: `pnpm db:up` with a filled-in .env.
describe("battles", () => {
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

  async function newBattleId(tx: DbClient, seed = 42): Promise<string> {
    const created = await createBattle(tx, VALID_TEAM, seed);
    if (!("view" in created)) {
      throw new Error("the team should be valid");
    }
    return created.view.id;
  }

  describe("createBattle", () => {
    it("stores a battle between the player's team and a random bot team", async () => {
      await withFixtures(async (tx) => {
        const created = await createBattle(tx, VALID_TEAM, 42);

        if (!("view" in created)) {
          throw new Error("the team should be valid");
        }
        const { view } = created;
        expect(view).toMatchObject({
          turn: 0,
          phase: "choose-action",
          winner: null,
          player: { active: 0 },
          opponent: { remaining: 6, teamSize: 6 },
        });
        expect(view.player.team.map((member) => member.identifier)).toEqual([
          "pikachu",
          "charizard",
          "bulbasaur",
          "koraidon",
          "pikachu",
          "charizard",
        ]);
        // The player's moves keep the order they were picked in.
        expect(view.player.team[3]?.moves.map((move) => move.id)).toEqual([
          337, 53,
        ]);
        expect(await getBattle(tx, view.id)).toEqual(view);
      });
    });

    it("gives the bot six Pokémon with 1 to 4 moves they can learn", async () => {
      await withFixtures(async (tx) => {
        const stored = await findBattle(tx, await newBattleId(tx));

        const team = stored?.state.opponent.team ?? [];
        expect(team).toHaveLength(6);
        for (const member of team) {
          const learnable = LEARNABLE[member.pokemonId] ?? [];
          expect(member.moves.length).toBeGreaterThanOrEqual(1);
          expect(member.moves.length).toBeLessThanOrEqual(4);
          for (const move of member.moves) {
            expect(learnable).toContain(move.id);
          }
          expect(new Set(member.moves.map((move) => move.id)).size).toBe(
            member.moves.length,
          );
        }
      });
    });

    it("draws the same bot team from the same seed", async () => {
      await withFixtures(async (tx) => {
        const first = await findBattle(tx, await newBattleId(tx, 7));
        const second = await findBattle(tx, await newBattleId(tx, 7));

        expect(second?.state).toEqual(first?.state);
      });
    });

    it("lists every invalid member and stores nothing", async () => {
      await withFixtures(async (tx) => {
        const team: TeamMemberInput[] = [
          ...VALID_TEAM.slice(0, 3),
          // Mega Charizard X is not a default form.
          { pokemonId: 10034, moveIds: [53] },
          // Swords Dance is a status move; Bulbasaur cannot learn Thunderbolt.
          { pokemonId: 6, moveIds: [53, 14] },
          { pokemonId: 1, moveIds: [33, 85] },
        ];

        expect(await createBattle(tx, team, 42)).toEqual({
          issues: [
            { slot: 3, reason: "pokemon-not-allowed", pokemonId: 10034 },
            { slot: 4, reason: "move-not-allowed", moveId: 14 },
            { slot: 5, reason: "move-not-allowed", moveId: 85 },
          ],
        });
      });
    });
  });

  describe("playAction", () => {
    it("plays a turn and stores the new state", async () => {
      await withFixtures(async (tx) => {
        const id = await newBattleId(tx);

        const view = await playAction(tx, id, { type: "move", moveId: 85 });

        expect(view.turn).toBe(1);
        expect(view.player.team[0]?.moves[0]?.pp).toBe(14);
        expect(await getBattle(tx, id)).toEqual(view);
        expect((await findBattle(tx, id))?.version).toBe(1);
      });
    });

    it("rejects an action the rules forbid, keeping the battle unchanged", async () => {
      await withFixtures(async (tx) => {
        const id = await newBattleId(tx);
        const before = await findBattle(tx, id);

        await expect(
          playAction(tx, id, { type: "switch", slot: 0 }),
        ).rejects.toBeInstanceOf(BattleRuleError);

        expect(await findBattle(tx, id)).toEqual(before);
      });
    });

    it("fails for an unknown battle", async () => {
      await withFixtures(async (tx) => {
        await expect(
          playAction(tx, UNKNOWN_BATTLE, { type: "move", moveId: 85 }),
        ).rejects.toBeInstanceOf(BattleNotFoundError);
        expect(await getBattle(tx, UNKNOWN_BATTLE)).toBeUndefined();
      });
    });
  });

  describe("updateBattle", () => {
    it("refuses an update based on an outdated version", async () => {
      await withFixtures(async (tx) => {
        const id = await newBattleId(tx);
        const stored = await findBattle(tx, id);
        if (stored === undefined) {
          throw new Error("missing battle");
        }

        expect(await updateBattle(tx, id, stored.state, stored.version)).toBe(
          true,
        );
        expect(await updateBattle(tx, id, stored.state, stored.version)).toBe(
          false,
        );
      });
    });
  });

  describe("loadTypeChart", () => {
    it("gives the imported factors, neutral when PokeAPI lists none", async () => {
      await withFixtures(async (tx) => {
        const typeChart = await loadTypeChart(tx);

        expect(typeChart(10, 12)).toBe(2);
        expect(typeChart(13, 13)).toBe(0.5);
        expect(typeChart(1, 1)).toBe(1);
        expect(typeChart(999, 1)).toBe(1);
      });
    });
  });
});
