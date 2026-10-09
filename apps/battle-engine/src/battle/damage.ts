// Damage formula of generation 5 onwards, without abilities, items, stat
// stages or weather.
import type { Random } from "./random.js";
import { LEVEL } from "./stats.js";
import type { BattleMove, Battler, TypeChart } from "./types.js";

export type DamageResult =
  | { hit: false }
  | { hit: true; damage: number; critical: boolean; effectiveness: number };

// Chance of a critical hit by stage (PokeAPI `crit_rate`); stage 3 and
// above always crits.
const CRITICAL_CHANCES = [1 / 24, 1 / 8, 1 / 2];
const CRITICAL_MULTIPLIER = 1.5;
const STAB_MULTIPLIER = 1.5;

export function typeEffectiveness(
  move: BattleMove,
  defender: Battler,
  typeChart: TypeChart,
): number {
  const moveType = move.type;
  if (moveType === null) {
    return 1;
  }
  return defender.types.reduce(
    (factor, type) => factor * typeChart(moveType.id, type.id),
    1,
  );
}

/**
 * Draws, in order and only when needed: accuracy (unless the target is
 * immune or the move never misses), critical hit (below stage 3), then the
 * 85-100 % damage roll.
 */
export function calculateDamage(
  attacker: Battler,
  defender: Battler,
  move: BattleMove,
  typeChart: TypeChart,
  random: Random,
): DamageResult {
  const effectiveness = typeEffectiveness(move, defender, typeChart);
  if (effectiveness === 0) {
    return { hit: true, damage: 0, critical: false, effectiveness };
  }
  if (move.accuracy !== null && random.next() * 100 >= move.accuracy) {
    return { hit: false };
  }
  const criticalChance = CRITICAL_CHANCES[move.critRate];
  const critical =
    criticalChance === undefined || random.next() < criticalChance;

  const [attack, defense] =
    move.damageClass === "physical"
      ? [attacker.stats.attack, defender.stats.defense]
      : [attacker.stats.specialAttack, defender.stats.specialDefense];
  let damage =
    Math.floor(
      Math.floor(
        (Math.floor((2 * LEVEL) / 5 + 2) * move.power * attack) / defense,
      ) / 50,
    ) + 2;
  if (critical) {
    damage = Math.floor(damage * CRITICAL_MULTIPLIER);
  }
  damage = Math.floor((damage * random.int(85, 100)) / 100);
  const stab =
    move.type !== null &&
    attacker.types.some((type) => type.id === move.type?.id);
  if (stab) {
    damage = Math.floor(damage * STAB_MULTIPLIER);
  }
  damage = Math.floor(damage * effectiveness);
  return { hit: true, damage: Math.max(1, damage), critical, effectiveness };
}
