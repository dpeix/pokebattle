import type { BattleEvent } from "@pokebattle/shared";
import { describe, expect, it } from "vitest";
import {
  applyAction,
  BattleRuleError,
  createBattleState,
} from "../src/battle/engine.js";
import type { BattlerInput, BattleState } from "../src/battle/types.js";
import { toBattleView } from "../src/battle/view.js";
import {
  battler,
  CHARIZARD,
  constantRandom,
  move,
  PIKACHU,
  QUICK_ATTACK,
  TACKLE,
  typeChart,
} from "./battle-helpers.js";

const FAST = battler({ identifier: "fast", baseStats: { speed: 100 } });
const SLOW = battler({ identifier: "slow", baseStats: { speed: 10 } });
const FRAGILE = battler({
  identifier: "fragile",
  baseStats: { hp: 1, defense: 5, speed: 10 },
});
const STRONG = battler({
  identifier: "strong",
  baseStats: { attack: 255, speed: 200 },
});

function newBattle(player: BattlerInput[], opponent: BattlerInput[]) {
  return createBattleState(player, opponent, 1);
}

/** Events logged by the last action. */
function newEvents(before: BattleState, after: BattleState): BattleEvent[] {
  return after.log.slice(before.log.length);
}

function movers(events: BattleEvent[]): string[] {
  return events.flatMap((event) =>
    event.type === "move" ? [`${event.side}:${event.move.identifier}`] : [],
  );
}

function ruleError(run: () => unknown): BattleRuleError {
  try {
    run();
  } catch (error) {
    if (error instanceof BattleRuleError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected a BattleRuleError");
}

describe("createBattleState", () => {
  it("sends out the first Pokémon of each team at full health", () => {
    const state = newBattle([PIKACHU, CHARIZARD], [CHARIZARD]);

    expect(state).toMatchObject({
      turn: 0,
      phase: "choose-action",
      winner: null,
      player: { active: 0 },
      opponent: { active: 0 },
    });
    expect(state.player.team[0]).toMatchObject({
      identifier: "pikachu",
      hp: 110,
      stats: { hp: 110, speed: 110 },
    });
    expect(state.player.team[0]?.moves[0]).toMatchObject({
      identifier: "thunderbolt",
      pp: 15,
      maxPp: 15,
    });
    expect(state.log).toEqual([
      {
        type: "switch",
        side: "player",
        slot: 0,
        pokemonId: 25,
        hpPercent: 100,
        pokemon: { identifier: "pikachu", nameFr: null, nameEn: null },
      },
      {
        type: "switch",
        side: "opponent",
        slot: 0,
        pokemonId: 6,
        hpPercent: 100,
        pokemon: { identifier: "charizard", nameFr: null, nameEn: null },
      },
    ]);
  });
});

describe("applyAction: turn order", () => {
  it("lets the faster Pokémon attack first", () => {
    const state = newBattle([SLOW], [FAST]);

    const after = applyAction(
      state,
      { type: "move", moveId: TACKLE.id },
      typeChart,
      constantRandom(0.99),
    );

    expect(after.turn).toBe(1);
    expect(newEvents(state, after)[0]).toEqual({ type: "turn-start", turn: 1 });
    expect(movers(newEvents(state, after))).toEqual([
      "opponent:tackle",
      "player:tackle",
    ]);
  });

  it("lets a higher priority move go before a faster Pokémon", () => {
    const state = newBattle(
      [FAST],
      [
        battler({
          identifier: "slow",
          baseStats: { speed: 10 },
          moves: [QUICK_ATTACK],
        }),
      ],
    );

    const after = applyAction(
      state,
      { type: "move", moveId: TACKLE.id },
      typeChart,
      constantRandom(0.99),
    );

    expect(movers(newEvents(state, after))).toEqual([
      "opponent:quick-attack",
      "player:tackle",
    ]);
  });

  it("breaks a speed tie with a random draw", () => {
    const state = newBattle([SLOW], [SLOW]);
    const action = { type: "move", moveId: TACKLE.id } as const;

    const playerFirst = applyAction(
      state,
      action,
      typeChart,
      constantRandom(0),
    );
    const opponentFirst = applyAction(
      state,
      action,
      typeChart,
      constantRandom(0.99),
    );

    expect(movers(newEvents(state, playerFirst))[0]).toBe("player:tackle");
    expect(movers(newEvents(state, opponentFirst))[0]).toBe("opponent:tackle");
  });

  it("switches before any move and the new Pokémon takes the hit", () => {
    const state = newBattle([SLOW, FAST], [FAST]);

    const after = applyAction(
      state,
      { type: "switch", slot: 1 },
      typeChart,
      constantRandom(0.99),
    );

    expect(after.player.active).toBe(1);
    expect(newEvents(state, after).slice(1, 3)).toMatchObject([
      { type: "switch", side: "player", pokemon: { identifier: "fast" } },
      { type: "move", side: "opponent" },
    ]);
    expect(after.player.team[0]?.hp).toBe(after.player.team[0]?.stats.hp);
    expect(after.player.team[1]?.hp).toBeLessThan(
      after.player.team[1]?.stats.hp ?? 0,
    );
  });

  it("logs the slot and HP of the Pokémon sent out", () => {
    const state = newBattle([SLOW, PIKACHU], [FAST]);
    const pikachu = state.player.team[1];
    if (pikachu === undefined) {
      throw new Error("missing Pokémon");
    }
    pikachu.hp = 55;

    const after = applyAction(
      state,
      { type: "switch", slot: 1 },
      typeChart,
      constantRandom(0.99),
    );

    expect(newEvents(state, after)[1]).toEqual({
      type: "switch",
      side: "player",
      slot: 1,
      pokemonId: 25,
      hpPercent: 50,
      pokemon: { identifier: "pikachu", nameFr: null, nameEn: null },
    });
  });

  it("uses one PP per move, for both sides", () => {
    const state = newBattle([PIKACHU], [CHARIZARD]);

    const after = applyAction(
      state,
      { type: "move", moveId: QUICK_ATTACK.id },
      typeChart,
      constantRandom(0.99),
    );

    expect(after.player.team[0]?.moves[1]?.pp).toBe(QUICK_ATTACK.pp - 1);
    // The bot picks its last move with PP left on a 0.99 draw: Tackle.
    expect(after.opponent.team[0]?.moves[1]?.pp).toBe(TACKLE.pp - 1);
  });

  it("does not modify the given state", () => {
    const state = newBattle([PIKACHU], [CHARIZARD]);
    const copy = structuredClone(state);

    applyAction(state, { type: "move", moveId: QUICK_ATTACK.id }, typeChart);

    expect(state).toEqual(copy);
  });

  it("draws from the random state stored in the battle", () => {
    const state = newBattle([PIKACHU], [CHARIZARD]);
    const action = { type: "move", moveId: QUICK_ATTACK.id } as const;

    const first = applyAction(state, action, typeChart);
    const second = applyAction(state, action, typeChart);

    expect(second).toEqual(first);
    expect(first.random).not.toBe(state.random);
  });
});

describe("applyAction: fainting", () => {
  it("stops a fainted Pokémon from attacking and asks the player to switch", () => {
    const state = newBattle([FRAGILE, SLOW], [STRONG]);

    const after = applyAction(
      state,
      { type: "move", moveId: TACKLE.id },
      typeChart,
      constantRandom(0.99),
    );

    expect(after.player.team[0]?.hp).toBe(0);
    expect(movers(newEvents(state, after))).toEqual(["opponent:tackle"]);
    expect(newEvents(state, after).at(-1)).toMatchObject({
      type: "faint",
      side: "player",
    });
    expect(after.phase).toBe("choose-switch");
  });

  it("only accepts a switch to a healthy Pokémon after a faint, without a new turn", () => {
    const state = applyAction(
      newBattle([FRAGILE, SLOW], [STRONG]),
      { type: "move", moveId: TACKLE.id },
      typeChart,
      constantRandom(0.99),
    );

    expect(
      ruleError(() =>
        applyAction(state, { type: "move", moveId: TACKLE.id }, typeChart),
      ).code,
    ).toBe("invalid-action");
    expect(
      ruleError(() =>
        applyAction(state, { type: "switch", slot: 0 }, typeChart),
      ).code,
    ).toBe("invalid-action");

    const after = applyAction(state, { type: "switch", slot: 1 }, typeChart);

    expect(after).toMatchObject({
      turn: 1,
      phase: "choose-action",
      player: { active: 1 },
    });
    expect(newEvents(state, after)).toMatchObject([
      { type: "switch", side: "player", pokemon: { identifier: "slow" } },
    ]);
  });

  it("replaces the bot's fainted Pokémon at the end of the turn", () => {
    const state = newBattle([STRONG], [FRAGILE, SLOW]);

    const after = applyAction(
      state,
      { type: "move", moveId: TACKLE.id },
      typeChart,
      constantRandom(0.99),
    );

    expect(after.opponent.active).toBe(1);
    expect(after.phase).toBe("choose-action");
    expect(newEvents(state, after).slice(-2)).toMatchObject([
      { type: "faint", side: "opponent" },
      { type: "switch", side: "opponent", pokemon: { identifier: "slow" } },
    ]);
  });

  it("ends the battle when a side has no Pokémon left", () => {
    const state = newBattle([STRONG], [FRAGILE]);

    const after = applyAction(
      state,
      { type: "move", moveId: TACKLE.id },
      typeChart,
      constantRandom(0.99),
    );

    expect(after).toMatchObject({ phase: "finished", winner: "player" });
    expect(after.log.at(-1)).toEqual({ type: "end", winner: "player" });
    expect(
      ruleError(() =>
        applyAction(after, { type: "move", moveId: TACKLE.id }, typeChart),
      ).code,
    ).toBe("battle-finished");
  });
});

describe("applyAction: Struggle", () => {
  function withoutPp(state: BattleState, side: "player" | "opponent") {
    for (const moveState of state[side].team[0]?.moves ?? []) {
      moveState.pp = 0;
    }
    return state;
  }

  it("is the only move left once every PP is used, with a quarter HP recoil", () => {
    const state = withoutPp(newBattle([FAST], [SLOW]), "player");

    expect(
      ruleError(() =>
        applyAction(state, { type: "move", moveId: TACKLE.id }, typeChart),
      ).code,
    ).toBe("invalid-action");

    const after = applyAction(
      state,
      { type: "struggle" },
      typeChart,
      constantRandom(0.99),
    );

    const events = newEvents(state, after);
    expect(movers(events)[0]).toBe("player:struggle");
    const user = after.player.team[0];
    // The opponent's Tackle hits after the recoil.
    expect(events.slice(1, 5)).toMatchObject([
      { type: "move", side: "player" },
      { type: "damage", side: "opponent" },
      { type: "recoil", side: "player" },
      { type: "move", side: "opponent" },
    ]);
    expect(user?.hp).toBeLessThanOrEqual(
      (user?.stats.hp ?? 0) - Math.floor((user?.stats.hp ?? 0) / 4),
    );
  });

  it("is refused while a move has PP left", () => {
    const state = newBattle([FAST], [SLOW]);

    expect(
      ruleError(() => applyAction(state, { type: "struggle" }, typeChart)).code,
    ).toBe("invalid-action");
  });

  it("is used by the bot once its PP are gone", () => {
    const state = withoutPp(newBattle([SLOW], [FAST]), "opponent");

    const after = applyAction(
      state,
      { type: "move", moveId: TACKLE.id },
      typeChart,
      constantRandom(0.99),
    );

    expect(movers(newEvents(state, after))[0]).toBe("opponent:struggle");
  });

  it("ends in a draw when the recoil knocks out the last Pokémon", () => {
    const state = withoutPp(newBattle([FAST], [SLOW]), "player");
    const [user] = state.player.team;
    const [target] = state.opponent.team;
    if (user === undefined || target === undefined) {
      throw new Error("missing Pokémon");
    }
    user.hp = 1;
    target.hp = 1;

    const after = applyAction(
      state,
      { type: "struggle" },
      typeChart,
      constantRandom(0.99),
    );

    expect(after).toMatchObject({ phase: "finished", winner: "draw" });
  });
});

describe("applyAction: invalid actions", () => {
  const state = newBattle([PIKACHU, CHARIZARD], [CHARIZARD]);

  it.each([
    ["an unknown move", { type: "move", moveId: 999 }],
    ["a switch to the active Pokémon", { type: "switch", slot: 0 }],
    ["a switch to a missing slot", { type: "switch", slot: 6 }],
  ] as const)("rejects %s", (_, action) => {
    expect(ruleError(() => applyAction(state, action, typeChart)).code).toBe(
      "invalid-action",
    );
  });

  it("rejects a move without PP and a switch to a fainted Pokémon", () => {
    const tired = structuredClone(state);
    const [pikachu, charizard] = tired.player.team;
    if (pikachu?.moves[0] === undefined || charizard === undefined) {
      throw new Error("missing Pokémon");
    }
    pikachu.moves[0].pp = 0;
    charizard.hp = 0;

    expect(
      ruleError(() =>
        applyAction(
          tired,
          { type: "move", moveId: pikachu.moves[0]?.id ?? 0 },
          typeChart,
        ),
      ).code,
    ).toBe("invalid-action");
    expect(
      ruleError(() =>
        applyAction(tired, { type: "switch", slot: 1 }, typeChart),
      ).code,
    ).toBe("invalid-action");
  });
});

describe("toBattleView", () => {
  it("shows the player's team but only the opponent's active Pokémon", () => {
    const state = newBattle([PIKACHU], [CHARIZARD, PIKACHU]);
    const [charizard] = state.opponent.team;
    if (charizard === undefined) {
      throw new Error("missing Pokémon");
    }
    charizard.hp = 1;

    const view = toBattleView("battle-id", state);

    expect(view).toMatchObject({
      id: "battle-id",
      turn: 0,
      phase: "choose-action",
      winner: null,
      player: { active: 0, mustStruggle: false },
      opponent: {
        active: { identifier: "charizard", pokemonId: 6, hpPercent: 1 },
        remaining: 2,
        teamSize: 2,
      },
    });
    expect(view.player.team[0]).toMatchObject({
      slot: 0,
      identifier: "pikachu",
      hp: 110,
      stats: { hp: 110 },
      moves: [{ identifier: "thunderbolt", pp: 15, maxPp: 15 }, {}],
    });
    expect(view.opponent.active).not.toHaveProperty("moves");
    expect(view.opponent.active).not.toHaveProperty("hp");
  });

  it("reveals the opponent's active Pokémon only at the start", () => {
    const view = toBattleView(
      "battle-id",
      newBattle([PIKACHU], [CHARIZARD, PIKACHU]),
    );

    expect(view.opponent.revealed).toEqual([view.opponent.active]);
  });

  it("keeps the opponent's fainted Pokémon revealed after its replacement", () => {
    const state = newBattle([STRONG], [FRAGILE, CHARIZARD, SLOW]);
    const after = applyAction(
      state,
      { type: "move", moveId: TACKLE.id },
      typeChart,
      constantRandom(0.99),
    );
    const replacement = after.opponent.team[after.opponent.active];

    const view = toBattleView("battle-id", after);

    expect(view.opponent.revealed).toMatchObject([
      { identifier: "fragile", hpPercent: 0 },
      { identifier: replacement?.identifier, hpPercent: 100 },
    ]);
    expect(view.opponent.revealed[0]).not.toHaveProperty("moves");
  });

  it("reveals the same Pokémon once however often it comes in", () => {
    const state = newBattle([PIKACHU], [CHARIZARD]);
    const [, opponentSwitch] = state.log;
    if (opponentSwitch === undefined) {
      throw new Error("missing event");
    }
    state.log.push(opponentSwitch);

    expect(toBattleView("battle-id", state).opponent.revealed).toHaveLength(1);
  });

  it("reveals only the active Pokémon of a battle logged without slots", () => {
    // Battles stored before the switch events had a slot.
    const state = newBattle([PIKACHU], [CHARIZARD, PIKACHU]);
    state.log = state.log.map((event) =>
      event.type === "switch"
        ? ({
            type: "switch",
            side: event.side,
            pokemon: event.pokemon,
          } as BattleEvent)
        : event,
    );
    state.opponent.active = 1;

    expect(toBattleView("battle-id", state).opponent.revealed).toMatchObject([
      { identifier: "pikachu" },
    ]);
  });

  it("tells when the active Pokémon must struggle", () => {
    const state = newBattle(
      [
        battler({
          identifier: "tired",
          moves: [move({ id: 1, identifier: "pound", pp: 0 })],
        }),
      ],
      [SLOW],
    );

    expect(toBattleView("battle-id", state).player.mustStruggle).toBe(true);
  });
});
