// The opponent's strategy: a random move, and a random replacement when its
// active Pokémon faints. It never switches on its own.
import type { Random } from "./random.js";
import { STRUGGLE } from "./struggle.js";
import type { BattleMove, Battler, BattleSideState } from "./types.js";

export function chooseBotMove(battler: Battler, random: Random): BattleMove {
  const usable = battler.moves.filter((move) => move.pp > 0);
  if (usable.length === 0) {
    return STRUGGLE;
  }
  return usable[random.int(0, usable.length - 1)] ?? STRUGGLE;
}

export function chooseBotReplacement(
  side: BattleSideState,
  random: Random,
): number {
  const healthy = side.team.flatMap((battler, slot) =>
    battler.hp > 0 ? [slot] : [],
  );
  const slot = healthy[random.int(0, healthy.length - 1)];
  if (slot === undefined) {
    throw new Error("the bot has no Pokémon left to send out");
  }
  return slot;
}
