// Contracts of the battle engine's `/battles` endpoints. A battle opposes
// the player's team to a bot; every view is the player's point of view, so
// the bot's hidden information (bench, moves, exact HP) never leaves the
// engine.

/** Names of a Pokémon, type or move; `identifier` is the fallback name. */
export interface Named {
  identifier: string;
  nameFr: string | null;
  nameEn: string | null;
}

/** Pokémon per team, for the player and the bot alike. */
export const TEAM_SIZE = 6;
export const MAX_MOVES_PER_POKEMON = 4;

export interface TeamMemberInput {
  pokemonId: number;
  /** 1 to `MAX_MOVES_PER_POKEMON` distinct damaging moves it can learn. */
  moveIds: number[];
}

/** Body of `POST /battles`: exactly `TEAM_SIZE` members. */
export interface CreateBattleRequest {
  team: TeamMemberInput[];
}

/**
 * Why a team member was refused: the Pokémon is not selectable (see
 * `GET /pokemon`), or it cannot learn `moveId` as a damaging move.
 */
export type TeamIssue =
  | { slot: number; reason: "pokemon-not-allowed"; pokemonId: number }
  | { slot: number; reason: "move-not-allowed"; moveId: number };

/** 400 reply of `POST /battles` for a well-formed but invalid team. */
export interface InvalidTeamResponse {
  statusCode: 400;
  error: string;
  message: string;
  issues: TeamIssue[];
}

export type BattleSide = "player" | "opponent";

/**
 * - `choose-action`: the player attacks or switches; the bot then plays.
 * - `choose-switch`: the player's active Pokémon fainted and must be replaced.
 * - `finished`: one side has no Pokémon left.
 */
export type BattlePhase = "choose-action" | "choose-switch" | "finished";

/** `draw` when both last Pokémon faint during the same turn. */
export type BattleWinner = BattleSide | "draw";

/**
 * `struggle` is only allowed once the active Pokémon has no PP left
 * (`BattleView.player.mustStruggle`).
 */
export type BattleAction =
  | { type: "move"; moveId: number }
  | { type: "switch"; slot: number }
  | { type: "struggle" };

export interface BattleStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface BattleMoveView extends Named {
  id: number;
  type: Named;
  power: number;
  /** Null when the move never misses. */
  accuracy: number | null;
  priority: number;
  damageClass: "physical" | "special";
  pp: number;
  maxPp: number;
}

export interface BattlePokemonView extends Named {
  slot: number;
  pokemonId: number;
  types: Named[];
  hp: number;
  stats: BattleStats;
  moves: BattleMoveView[];
}

export interface OpponentPokemonView extends Named {
  pokemonId: number;
  types: Named[];
  /** Rounded up, so it only reaches 0 once the Pokémon has fainted. */
  hpPercent: number;
}

export type BattleEvent =
  | { type: "turn-start"; turn: number }
  | { type: "switch"; side: BattleSide; pokemon: Named }
  | { type: "move"; side: BattleSide; pokemon: Named; move: Named }
  | { type: "miss"; side: BattleSide; pokemon: Named }
  /** The target (`side`) is immune to the move's type. */
  | { type: "immune"; side: BattleSide; pokemon: Named }
  | {
      type: "damage";
      /** The side of the Pokémon that took the damage. */
      side: BattleSide;
      pokemon: Named;
      hpPercent: number;
      /** Product of the type factors: 0.25, 0.5, 1, 2 or 4. */
      effectiveness: number;
      critical: boolean;
    }
  | { type: "recoil"; side: BattleSide; pokemon: Named; hpPercent: number }
  | { type: "faint"; side: BattleSide; pokemon: Named }
  | { type: "end"; winner: BattleWinner };

export interface BattleView {
  id: string;
  /** 0 before the first turn. */
  turn: number;
  phase: BattlePhase;
  winner: BattleWinner | null;
  player: {
    /** Slot of the active Pokémon in `team`. */
    active: number;
    team: BattlePokemonView[];
    /** The active Pokémon has no PP left: its only move is `struggle`. */
    mustStruggle: boolean;
  };
  opponent: {
    active: OpponentPokemonView;
    /** Pokémon not fainted yet, the active one included. */
    remaining: number;
    teamSize: number;
  };
  log: BattleEvent[];
}
