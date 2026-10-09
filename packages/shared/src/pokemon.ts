// Contracts of the battle engine's `/pokemon` endpoints: the Pokémon and
// moves a player may pick for a team.
import type { BattleStats, Named } from "./battle.js";

export interface PokemonSummary extends Named {
  id: number;
  types: Named[];
  baseStats: BattleStats;
}

/** A damaging move the Pokémon can learn in at least one game. */
export interface LearnableMove extends Named {
  id: number;
  type: Named;
  power: number;
  /** Null when the move never misses. */
  accuracy: number | null;
  pp: number;
  priority: number;
  damageClass: "physical" | "special";
}

export interface PokemonDetail extends PokemonSummary {
  moves: LearnableMove[];
}
