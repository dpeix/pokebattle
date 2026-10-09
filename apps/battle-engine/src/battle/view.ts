import type {
  BattleMoveView,
  BattleView,
  OpponentPokemonView,
} from "@pokebattle/shared";
import { activeBattler, hpPercent, names } from "./engine.js";
import type { BattleMove, Battler, BattleState } from "./types.js";

/**
 * The player's view of the battle. Of the opponent's team, only the
 * Pokémon already sent out are shown, with their HP as a percentage, as in
 * the games.
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
      active: opponentView(opponentActive),
      revealed: revealedSlots(state).flatMap((slot) => {
        const battler = state.opponent.team[slot];
        return battler === undefined ? [] : [opponentView(battler)];
      }),
      remaining: state.opponent.team.filter((battler) => battler.hp > 0).length,
      teamSize: state.opponent.team.length,
    },
    log: state.log,
  };
}

function opponentView(battler: Battler): OpponentPokemonView {
  return {
    ...names(battler),
    pokemonId: battler.pokemonId,
    types: battler.types.map(names),
    hpPercent: hpPercent(battler),
  };
}

/** Slots of the opponent's Pokémon sent out so far, in order of appearance. */
function revealedSlots(state: BattleState): number[] {
  const slots = new Set<number>();
  for (const event of state.log) {
    // Battles stored before switch events had a slot only reveal the
    // active Pokémon, added below.
    if (
      event.type === "switch" &&
      event.side === "opponent" &&
      Number.isInteger(event.slot)
    ) {
      slots.add(event.slot);
    }
  }
  slots.add(state.opponent.active);
  return [...slots];
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
