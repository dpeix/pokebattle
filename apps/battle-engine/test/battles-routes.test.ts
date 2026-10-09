import type { InvalidTeamResponse } from "@pokebattle/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { requireEnv } from "../src/env.js";

// The CI database holds no PokeAPI data: a whole battle is covered by
// battles.test.ts, these tests cover the HTTP contract.
// Requires the database container: `pnpm db:up` with a filled-in .env.
describe("/battles", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(() => {
    app = buildApp({ databaseUrl: requireEnv("DATABASE_URL") });
  });

  afterAll(async () => {
    await app.close();
  });

  const member = { pokemonId: 25, moveIds: [85] };
  const UNKNOWN_BATTLE = "00000000-0000-4000-8000-000000000000";

  describe("POST /battles", () => {
    it.each([
      ["no team", {}],
      ["five members", { team: Array(5).fill(member) }],
      ["seven members", { team: Array(7).fill(member) }],
      [
        "a member without moves",
        { team: [...Array(5).fill(member), { pokemonId: 25, moveIds: [] }] },
      ],
      [
        "a member with five moves",
        {
          team: [
            ...Array(5).fill(member),
            { pokemonId: 25, moveIds: [1, 2, 3, 4, 5] },
          ],
        },
      ],
      [
        "a move picked twice",
        {
          team: [
            ...Array(5).fill(member),
            { pokemonId: 25, moveIds: [85, 85] },
          ],
        },
      ],
    ])("rejects %s", async (_, payload) => {
      const response = await app.inject({
        method: "POST",
        url: "/battles",
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it("lists the Pokémon that cannot be used", async () => {
      const unknown = { pokemonId: 999_999, moveIds: [85] };

      const response = await app.inject({
        method: "POST",
        url: "/battles",
        payload: { team: [...Array(5).fill(member), unknown] },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<InvalidTeamResponse>();
      expect(body).toMatchObject({ statusCode: 400, error: "Bad Request" });
      // Pikachu is refused as well when the database holds no data (CI).
      expect(body.issues).toContainEqual({
        slot: 5,
        reason: "pokemon-not-allowed",
        pokemonId: 999_999,
      });
    });
  });

  describe("GET /battles/:id", () => {
    it("rejects an id that is not a UUID", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/battles/123",
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 404 for an unknown battle", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/battles/${UNKNOWN_BATTLE}`,
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        statusCode: 404,
        error: "Not Found",
        message: "Battle not found",
      });
    });
  });

  describe("POST /battles/:id/actions", () => {
    it.each([
      ["an unknown action", { type: "run" }],
      ["a move without its id", { type: "move" }],
      ["a switch without its slot", { type: "switch" }],
      ["a negative slot", { type: "switch", slot: -1 }],
    ])("rejects %s", async (_, payload) => {
      const response = await app.inject({
        method: "POST",
        url: `/battles/${UNKNOWN_BATTLE}/actions`,
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 404 for an unknown battle", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/battles/${UNKNOWN_BATTLE}/actions`,
        payload: { type: "struggle" },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
