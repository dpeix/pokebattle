// State of a battle, as stored in the `battles` table (JSON). It holds a
// copy of the reference data each Pokémon needs, so that importing PokeAPI
// again never changes a battle in progress.
import type {
  BattleEvent,
  BattlePhase,
  BattleStats,
  BattleWinner,
  Named,
} from "@pokebattle/shared";

export interface BattleType extends Named {
  id: number;
}

export interface BattleMove extends Named {
  id: number;
  /** Null for a typeless move (Struggle): neutral against every type. */
  type: BattleType | null;
  power: number;
  /** Null when the move never misses. */
  accuracy: number | null;
  priority: number;
  damageClass: "physical" | "special";
  /** Critical hit stage (PokeAPI `crit_rate`), 0 for most moves. */
  critRate: number;
  pp: number;
  maxPp: number;
}

export interface Battler extends Named {
  pokemonId: number;
  types: BattleType[];
  stats: BattleStats;
  hp: number;
  moves: BattleMove[];
}

export interface BattleSideState {
  /** Slot of the active Pokémon in `team`. */
  active: number;
  team: Battler[];
}

export interface BattleState {
  turn: number;
  phase: BattlePhase;
  winner: BattleWinner | null;
  player: BattleSideState;
  opponent: BattleSideState;
  log: BattleEvent[];
  /** State of the battle's random generator, see random.ts. */
  random: number;
}

/** A move before the battle: `pp` is its maximum. */
export type MoveInput = Omit<BattleMove, "maxPp">;

/** A team member before the battle, with its base stats. */
export interface BattlerInput extends Named {
  pokemonId: number;
  types: BattleType[];
  baseStats: BattleStats;
  moves: MoveInput[];
}

/** Damage factor of an attacking type against a defending type (0 to 2). */
export type TypeChart = (
  attackingTypeId: number,
  defendingTypeId: number,
) => number;
