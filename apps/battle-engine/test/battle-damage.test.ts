import { describe, expect, it } from "vitest";
import { calculateDamage } from "../src/battle/damage.js";
import { createBattler } from "../src/battle/engine.js";
import { createRandom } from "../src/battle/random.js";
import { computeStats } from "../src/battle/stats.js";
import type { BattleMove } from "../src/battle/types.js";
import {
  battler,
  CHARIZARD,
  CHARIZARD_BASE,
  constantRandom,
  move,
  PIKACHU,
  PIKACHU_BASE,
  scriptedRandom,
  TACKLE,
  THUNDERBOLT,
  TYPES,
  typeChart,
} from "./battle-helpers.js";

function battleMove(input: ReturnType<typeof move>): BattleMove {
  return { ...input, maxPp: input.pp };
}

describe("computeStats", () => {
  it("computes level 50 stats with 31 IVs, no EVs and a neutral nature", () => {
    expect(computeStats(PIKACHU_BASE)).toEqual({
      hp: 110,
      attack: 75,
      defense: 60,
      specialAttack: 70,
      specialDefense: 70,
      speed: 110,
    });
    expect(computeStats(CHARIZARD_BASE)).toEqual({
      hp: 153,
      attack: 104,
      defense: 98,
      specialAttack: 129,
      specialDefense: 105,
      speed: 120,
    });
  });
});

describe("createRandom", () => {
  it("replays the same draws from the same state", () => {
    const first = createRandom(42);
    const draws = [first.next(), first.int(85, 100), first.next()];

    const replay = createRandom(42);
    expect([replay.next(), replay.int(85, 100), replay.next()]).toEqual(draws);
    expect(createRandom(first.state()).next()).toBe(
      createRandom(replay.state()).next(),
    );
  });

  it("draws integers within the inclusive bounds", () => {
    expect(constantRandom(0).int(85, 100)).toBe(85);
    expect(constantRandom(0.9999).int(85, 100)).toBe(100);
    const random = createRandom(7);
    for (let draw = 0; draw < 1000; draw++) {
      const value = random.int(1, 6);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });
});

describe("calculateDamage", () => {
  const pikachu = createBattler(PIKACHU);
  const charizard = createBattler(CHARIZARD);
  const thunderbolt = battleMove(THUNDERBOLT);

  it("applies STAB and type effectiveness at the maximum roll", () => {
    // Base 28, roll 100 % → 28, STAB → 42, super effective on Flying → 84.
    expect(
      calculateDamage(
        pikachu,
        charizard,
        thunderbolt,
        typeChart,
        constantRandom(0.99),
      ),
    ).toEqual({ hit: true, damage: 84, critical: false, effectiveness: 2 });
  });

  it("applies the minimum roll of 85 %", () => {
    // Draws: accuracy, critical hit, damage roll.
    const random = scriptedRandom([0.5, 0.5, 0]);

    expect(
      calculateDamage(pikachu, charizard, thunderbolt, typeChart, random),
    ).toMatchObject({ damage: 68 });
  });

  it("multiplies critical hits by 1.5", () => {
    const alwaysCritical = battleMove({ ...THUNDERBOLT, critRate: 3 });

    expect(
      calculateDamage(
        pikachu,
        charizard,
        alwaysCritical,
        typeChart,
        constantRandom(0.99),
      ),
    ).toEqual({ hit: true, damage: 126, critical: true, effectiveness: 2 });
  });

  it("uses Attack and Defense for physical moves, without STAB for other types", () => {
    expect(
      calculateDamage(
        charizard,
        pikachu,
        battleMove(TACKLE),
        typeChart,
        constantRandom(0.99),
      ),
    ).toEqual({ hit: true, damage: 32, critical: false, effectiveness: 1 });
  });

  it("deals no damage to an immune target, without drawing", () => {
    const ground = createBattler(
      battler({ identifier: "sandshrew", types: [TYPES.ground] }),
    );

    expect(
      calculateDamage(
        pikachu,
        ground,
        thunderbolt,
        typeChart,
        scriptedRandom([]),
      ),
    ).toEqual({ hit: true, damage: 0, critical: false, effectiveness: 0 });
  });

  it("misses when the accuracy draw fails", () => {
    const inaccurate = battleMove({ ...THUNDERBOLT, accuracy: 50 });

    expect(
      calculateDamage(
        pikachu,
        charizard,
        inaccurate,
        typeChart,
        constantRandom(0.5),
      ),
    ).toEqual({ hit: false });
  });

  it("never misses with a null accuracy", () => {
    const sureHit = battleMove({ ...THUNDERBOLT, accuracy: null });

    expect(
      calculateDamage(
        pikachu,
        charizard,
        sureHit,
        typeChart,
        constantRandom(0.9999),
      ),
    ).toMatchObject({ hit: true });
  });

  it("deals at least 1 damage to a non-immune target", () => {
    const weak = createBattler(
      battler({
        identifier: "weak",
        baseStats: { attack: 5 },
      }),
    );
    const wall = createBattler(
      battler({
        identifier: "wall",
        types: [TYPES.fire, TYPES.water],
        baseStats: { defense: 250 },
      }),
    );
    const ember = battleMove(
      move({ id: 52, identifier: "ember", type: TYPES.fire, power: 10 }),
    );

    expect(
      calculateDamage(
        weak,
        wall,
        ember,
        typeChart,
        scriptedRandom([0.5, 0.5, 0]),
      ),
    ).toEqual({ hit: true, damage: 1, critical: false, effectiveness: 0.25 });
  });

  it("treats a typeless move as neutral against every type", () => {
    const ghost = createBattler(
      battler({ identifier: "gastly", types: [TYPES.ghost] }),
    );
    const typeless = battleMove({ ...TACKLE, type: null });

    expect(
      calculateDamage(
        pikachu,
        ghost,
        typeless,
        typeChart,
        constantRandom(0.99),
      ),
    ).toMatchObject({ hit: true, effectiveness: 1 });
  });
});
