import type { BattleStats } from "@pokebattle/shared";
import { type Random, withNext } from "../src/battle/random.js";
import type {
  BattlerInput,
  BattleType,
  MoveInput,
  TypeChart,
} from "../src/battle/types.js";

function type(id: number, identifier: string): BattleType {
  return { id, identifier, nameFr: null, nameEn: null };
}

export const TYPES = {
  normal: type(1, "normal"),
  flying: type(3, "flying"),
  ground: type(5, "ground"),
  ghost: type(8, "ghost"),
  fire: type(10, "fire"),
  water: type(11, "water"),
  electric: type(13, "electric"),
};

// The real factors for the types above; unlisted pairs are neutral.
const FACTORS: Record<string, number> = {
  "1:8": 0,
  "10:10": 0.5,
  "10:11": 0.5,
  "11:10": 2,
  "11:11": 0.5,
  "13:3": 2,
  "13:5": 0,
  "13:11": 2,
  "13:13": 0.5,
};

export const typeChart: TypeChart = (attacking, defending) =>
  FACTORS[`${attacking}:${defending}`] ?? 1;

export function move(
  overrides: Partial<MoveInput> & Pick<MoveInput, "id" | "identifier">,
): MoveInput {
  return {
    nameFr: null,
    nameEn: null,
    type: TYPES.normal,
    power: 40,
    accuracy: 100,
    priority: 0,
    damageClass: "physical",
    critRate: 0,
    pp: 35,
    ...overrides,
  };
}

export const TACKLE = move({ id: 33, identifier: "tackle" });
export const QUICK_ATTACK = move({
  id: 98,
  identifier: "quick-attack",
  priority: 1,
  pp: 30,
});
export const THUNDERBOLT = move({
  id: 85,
  identifier: "thunderbolt",
  type: TYPES.electric,
  power: 90,
  damageClass: "special",
  pp: 15,
});
export const FLAMETHROWER = move({
  id: 53,
  identifier: "flamethrower",
  type: TYPES.fire,
  power: 90,
  damageClass: "special",
  pp: 15,
});

export const PIKACHU_BASE: BattleStats = {
  hp: 35,
  attack: 55,
  defense: 40,
  specialAttack: 50,
  specialDefense: 50,
  speed: 90,
};

export const CHARIZARD_BASE: BattleStats = {
  hp: 78,
  attack: 84,
  defense: 78,
  specialAttack: 109,
  specialDefense: 85,
  speed: 100,
};

const AVERAGE_BASE: BattleStats = {
  hp: 80,
  attack: 80,
  defense: 80,
  specialAttack: 80,
  specialDefense: 80,
  speed: 80,
};

export function battler(
  overrides: Partial<Omit<BattlerInput, "baseStats">> & {
    identifier: string;
    baseStats?: Partial<BattleStats>;
  },
): BattlerInput {
  const { baseStats, ...rest } = overrides;
  return {
    pokemonId: 1,
    nameFr: null,
    nameEn: null,
    types: [TYPES.normal],
    moves: [TACKLE],
    ...rest,
    baseStats: { ...AVERAGE_BASE, ...baseStats },
  };
}

export const PIKACHU = battler({
  pokemonId: 25,
  identifier: "pikachu",
  types: [TYPES.electric],
  baseStats: PIKACHU_BASE,
  moves: [THUNDERBOLT, QUICK_ATTACK],
});

export const CHARIZARD = battler({
  pokemonId: 6,
  identifier: "charizard",
  types: [TYPES.fire, TYPES.flying],
  baseStats: CHARIZARD_BASE,
  moves: [FLAMETHROWER, TACKLE],
});

/** Always draws `value`: 0.99 hits, never crits and rolls the maximum damage. */
export function constantRandom(value: number): Random {
  return withNext(
    () => value,
    () => 0,
  );
}

/** Draws `values` in order, and fails when the code draws more than expected. */
export function scriptedRandom(values: number[]): Random {
  const remaining = [...values];
  return withNext(
    () => {
      const value = remaining.shift();
      if (value === undefined) {
        throw new Error("no scripted random value left");
      }
      return value;
    },
    () => 0,
  );
}
