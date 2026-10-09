import type { BattleMove } from "./types.js";

/**
 * Used once the active Pokémon has no PP left. Typeless since generation 5
 * (PokeAPI lists it as Normal), and the user loses a quarter of its max HP.
 */
export const STRUGGLE: BattleMove = {
  id: 165,
  identifier: "struggle",
  nameFr: "Lutte",
  nameEn: "Struggle",
  type: null,
  power: 50,
  accuracy: null,
  priority: 0,
  damageClass: "physical",
  critRate: 0,
  pp: 0,
  maxPp: 0,
};
