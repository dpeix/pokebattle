// Turn resolution of a single battle between the player and the bot. Pure:
// the caller loads and stores the state, and every draw goes through the
// battle's seeded random generator.
import type { BattleAction, BattleSide, Named } from "@pokebattle/shared";
import { chooseBotMove, chooseBotReplacement } from "./bot.js";
import { calculateDamage } from "./damage.js";
import { createRandom, type Random } from "./random.js";
import { computeStats } from "./stats.js";
import { STRUGGLE } from "./struggle.js";
import type {
  BattleMove,
  Battler,
  BattlerInput,
  BattleSideState,
  BattleState,
  TypeChart,
} from "./types.js";

export type BattleRuleCode = "invalid-action" | "battle-finished";

/** An action the rules do not allow in the battle's current state. */
export class BattleRuleError extends Error {
  constructor(
    readonly code: BattleRuleCode,
    message: string,
  ) {
    super(message);
    this.name = "BattleRuleError";
  }
}

function invalidAction(message: string): BattleRuleError {
  return new BattleRuleError("invalid-action", message);
}

export function createBattler(input: BattlerInput): Battler {
  const stats = computeStats(input.baseStats);
  return {
    pokemonId: input.pokemonId,
    identifier: input.identifier,
    nameFr: input.nameFr,
    nameEn: input.nameEn,
    types: input.types,
    stats,
    hp: stats.hp,
    moves: input.moves.map((move) => ({ ...move, maxPp: move.pp })),
  };
}

export function names({ identifier, nameFr, nameEn }: Named): Named {
  return { identifier, nameFr, nameEn };
}

export function activeBattler(side: BattleSideState): Battler {
  const battler = side.team[side.active];
  if (battler === undefined) {
    throw new Error(`no Pokémon in active slot ${side.active}`);
  }
  return battler;
}

function opposite(side: BattleSide): BattleSide {
  return side === "player" ? "opponent" : "player";
}

function switchIn(state: BattleState, side: BattleSide, slot: number): void {
  state[side].active = slot;
  const battler = activeBattler(state[side]);
  state.log.push({
    type: "switch",
    side,
    slot,
    pokemonId: battler.pokemonId,
    pokemon: names(battler),
    hpPercent: hpPercent(battler),
  });
}

export function createBattleState(
  playerTeam: BattlerInput[],
  opponentTeam: BattlerInput[],
  seed: number,
): BattleState {
  if (playerTeam.length === 0 || opponentTeam.length === 0) {
    throw new Error("both teams need at least one Pokémon");
  }
  const state: BattleState = {
    turn: 0,
    phase: "choose-action",
    winner: null,
    player: { active: 0, team: playerTeam.map(createBattler) },
    opponent: { active: 0, team: opponentTeam.map(createBattler) },
    log: [],
    random: seed,
  };
  switchIn(state, "player", 0);
  switchIn(state, "opponent", 0);
  return state;
}

/** The slot the player may switch to: healthy and not already active. */
function validSwitchSlot(side: BattleSideState, slot: number): number {
  const battler = side.team[slot];
  if (battler === undefined) {
    throw invalidAction(`no Pokémon in slot ${slot}`);
  }
  if (slot === side.active) {
    throw invalidAction(`the Pokémon in slot ${slot} is already active`);
  }
  if (battler.hp === 0) {
    throw invalidAction(`the Pokémon in slot ${slot} has fainted`);
  }
  return slot;
}

type PlayerChoice =
  | { type: "switch"; slot: number }
  | { type: "move"; move: BattleMove };

function playerChoice(state: BattleState, action: BattleAction): PlayerChoice {
  if (action.type === "switch") {
    return { type: "switch", slot: validSwitchSlot(state.player, action.slot) };
  }
  const active = activeBattler(state.player);
  const hasPp = active.moves.some((move) => move.pp > 0);
  if (action.type === "struggle") {
    if (hasPp) {
      throw invalidAction("Struggle is only allowed once every PP is used");
    }
    return { type: "move", move: STRUGGLE };
  }
  const move = active.moves.find((known) => known.id === action.moveId);
  if (move === undefined) {
    throw invalidAction(
      `the active Pokémon does not know move ${action.moveId}`,
    );
  }
  if (move.pp === 0) {
    throw invalidAction(`move ${action.moveId} has no PP left`);
  }
  return { type: "move", move };
}

interface Attack {
  side: BattleSide;
  move: BattleMove;
}

/** Higher priority first, then higher speed; a speed tie is drawn. */
function attackOrder(
  state: BattleState,
  attacks: Attack[],
  random: Random,
): Attack[] {
  const [first, second] = attacks;
  if (first === undefined || second === undefined) {
    return attacks;
  }
  if (first.move.priority !== second.move.priority) {
    return first.move.priority > second.move.priority
      ? [first, second]
      : [second, first];
  }
  const firstSpeed = activeBattler(state[first.side]).stats.speed;
  const secondSpeed = activeBattler(state[second.side]).stats.speed;
  if (firstSpeed !== secondSpeed) {
    return firstSpeed > secondSpeed ? [first, second] : [second, first];
  }
  return random.next() < 0.5 ? [first, second] : [second, first];
}

/** Rounded up, so it only reaches 0 once the Pokémon has fainted. */
export function hpPercent(battler: Battler): number {
  return Math.ceil((battler.hp / battler.stats.hp) * 100);
}

function loseHp(battler: Battler, amount: number): void {
  battler.hp = Math.max(0, battler.hp - amount);
}

function faintIfKnockedOut(
  state: BattleState,
  side: BattleSide,
  battler: Battler,
): void {
  if (battler.hp === 0) {
    state.log.push({ type: "faint", side, pokemon: names(battler) });
  }
}

function attack(
  state: BattleState,
  { side, move }: Attack,
  typeChart: TypeChart,
  random: Random,
): void {
  const attacker = activeBattler(state[side]);
  const targetSide = opposite(side);
  const target = activeBattler(state[targetSide]);
  // A Pokémon knocked out earlier in the turn neither attacks nor is attacked.
  if (attacker.hp === 0 || target.hp === 0) {
    return;
  }
  if (move !== STRUGGLE) {
    move.pp -= 1;
  }
  state.log.push({
    type: "move",
    side,
    pokemon: names(attacker),
    move: names(move),
  });

  const result = calculateDamage(attacker, target, move, typeChart, random);
  if (!result.hit) {
    state.log.push({ type: "miss", side, pokemon: names(attacker) });
  } else if (result.effectiveness === 0) {
    state.log.push({
      type: "immune",
      side: targetSide,
      pokemon: names(target),
    });
  } else {
    loseHp(target, result.damage);
    state.log.push({
      type: "damage",
      side: targetSide,
      pokemon: names(target),
      hpPercent: hpPercent(target),
      effectiveness: result.effectiveness,
      critical: result.critical,
    });
    faintIfKnockedOut(state, targetSide, target);
  }

  if (move === STRUGGLE) {
    loseHp(attacker, Math.max(1, Math.floor(attacker.stats.hp / 4)));
    state.log.push({
      type: "recoil",
      side,
      pokemon: names(attacker),
      hpPercent: hpPercent(attacker),
    });
    faintIfKnockedOut(state, side, attacker);
  }
}

function hasHealthyPokemon(side: BattleSideState): boolean {
  return side.team.some((battler) => battler.hp > 0);
}

function endTurn(state: BattleState, random: Random): void {
  const playerAlive = hasHealthyPokemon(state.player);
  const opponentAlive = hasHealthyPokemon(state.opponent);
  if (!playerAlive || !opponentAlive) {
    state.phase = "finished";
    state.winner = playerAlive ? "player" : opponentAlive ? "opponent" : "draw";
    state.log.push({ type: "end", winner: state.winner });
    return;
  }
  if (activeBattler(state.opponent).hp === 0) {
    switchIn(state, "opponent", chooseBotReplacement(state.opponent, random));
  }
  state.phase =
    activeBattler(state.player).hp === 0 ? "choose-switch" : "choose-action";
}

/**
 * Applies the player's action and returns the new state; `state` is left
 * untouched. In `choose-action`, the bot plays and a whole turn is resolved;
 * in `choose-switch`, only the player's replacement is sent out.
 *
 * @throws BattleRuleError when the action is not allowed.
 */
export function applyAction(
  state: BattleState,
  action: BattleAction,
  typeChart: TypeChart,
  random: Random = createRandom(state.random),
): BattleState {
  if (state.phase === "finished") {
    throw new BattleRuleError("battle-finished", "the battle is over");
  }
  const next = structuredClone(state);

  if (next.phase === "choose-switch") {
    if (action.type !== "switch") {
      throw invalidAction("the fainted Pokémon must be replaced first");
    }
    switchIn(next, "player", validSwitchSlot(next.player, action.slot));
    next.phase = "choose-action";
  } else {
    const choice = playerChoice(next, action);
    const botMove = chooseBotMove(activeBattler(next.opponent), random);
    next.turn += 1;
    next.log.push({ type: "turn-start", turn: next.turn });
    const attacks: Attack[] = [];
    if (choice.type === "switch") {
      switchIn(next, "player", choice.slot);
    } else {
      attacks.push({ side: "player", move: choice.move });
    }
    attacks.push({ side: "opponent", move: botMove });
    for (const planned of attackOrder(next, attacks, random)) {
      attack(next, planned, typeChart, random);
    }
    endTurn(next, random);
  }

  next.random = random.state();
  return next;
}
