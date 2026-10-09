import type { BattleMoveView, BattleView } from "@pokebattle/shared";
import { activeBattler, hpPercent, names } from "./engine.js";
import type { BattleMove, BattleState } from "./types.js";

/**
 * The player's view of the battle. Only the opponent's active Pokémon is
 * shown, with its HP as a percentage, as in the games.
 */
export function toBattleView(id: string, state: BattleState): BattleView {
  const playerActive = activeBattler(state.player);
  const opponentActive = activeBattler(state.opponent);
  return {
    id,
    turn: state.turn,
    phase: state.phase,
    winner: state.winner,
    player: {
      active: state.player.active,
      team: state.player.team.map((battler, slot) => ({
        ...names(battler),
        slot,
        pokemonId: battler.pokemonId,
        types: battler.types.map(names),
        hp: battler.hp,
        stats: battler.stats,
        moves: battler.moves.map(moveView),
      })),
      mustStruggle: playerActive.moves.every((move) => move.pp === 0),
    },
    opponent: {
      active: {
        ...names(opponentActive),
        pokemonId: opponentActive.pokemonId,
        types: opponentActive.types.map(names),
        hpPercent: hpPercent(opponentActive),
      },
      remaining: state.opponent.team.filter((battler) => battler.hp > 0).length,
      teamSize: state.opponent.team.length,
    },
    log: state.log,
  };
}

function moveView(move: BattleMove): BattleMoveView {
  return {
    ...names(move),
    id: move.id,
    // Typeless moves (Struggle) are never among a Pokémon's known moves.
    type:
      move.type === null
        ? { identifier: "typeless", nameFr: null, nameEn: null }
        : names(move.type),
    power: move.power,
    accuracy: move.accuracy,
    priority: move.priority,
    damageClass: move.damageClass,
    pp: move.pp,
    maxPp: move.maxPp,
  };
}
