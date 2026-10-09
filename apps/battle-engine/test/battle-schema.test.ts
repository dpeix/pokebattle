import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { createBattleState } from "../src/battle/engine.js";
import { toBattleView } from "../src/battle/view.js";
import { battleViewSchema } from "../src/schemas/battle.js";
import { CHARIZARD, PIKACHU } from "./battle-helpers.js";

// Fastify serializes replies with the response schema, which drops any
// property it does not declare.
describe("battleViewSchema", () => {
  it("keeps every field of the battle view", async () => {
    const view = toBattleView(
      "battle-id",
      createBattleState([PIKACHU], [CHARIZARD, PIKACHU], 1),
    );
    const app = Fastify();
    app.get(
      "/",
      { schema: { response: { 200: battleViewSchema } } },
      () => view,
    );

    const response = await app.inject({ method: "GET", url: "/" });
    await app.close();

    expect(response.json()).toEqual(view);
  });
});
