import type { PokemonSummary } from "@pokebattle/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { requireEnv } from "../src/env.js";

// The CI database holds no PokeAPI data: the data itself is covered by
// catalog.test.ts, these tests cover the HTTP contract.
// Requires the database container: `pnpm db:up` with a filled-in .env.
describe("/pokemon", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(() => {
    app = buildApp({ databaseUrl: requireEnv("DATABASE_URL") });
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists the selectable Pokémon", async () => {
    const response = await app.inject({ method: "GET", url: "/pokemon" });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json<PokemonSummary[]>())).toBe(true);
  });

  it.each(["abc", "0", "-1"])("rejects the id %s", async (id) => {
    const response = await app.inject({ method: "GET", url: `/pokemon/${id}` });

    expect(response.statusCode).toBe(400);
  });

  it("returns 404 for an unknown Pokémon", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/pokemon/999999",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ statusCode: 404 });
  });
});
