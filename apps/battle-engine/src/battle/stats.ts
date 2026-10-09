import type { BattleStats } from "@pokebattle/shared";

// Every Pokémon fights at level 50 with perfect IVs, no EVs and a neutral
// nature, so only base stats tell them apart.
export const LEVEL = 50;
const IV = 31;
const EV = 0;

function statCore(base: number): number {
  return Math.floor(((2 * base + IV + Math.floor(EV / 4)) * LEVEL) / 100);
}

export function computeStats(base: BattleStats): BattleStats {
  return {
    hp: statCore(base.hp) + LEVEL + 10,
    attack: statCore(base.attack) + 5,
    defense: statCore(base.defense) + 5,
    specialAttack: statCore(base.specialAttack) + 5,
    specialDefense: statCore(base.specialDefense) + 5,
    speed: statCore(base.speed) + 5,
  };
}
