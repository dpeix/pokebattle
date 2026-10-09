import { MAX_MOVES_PER_POKEMON, TEAM_SIZE } from "@pokebattle/shared";
import {
  damageClassSchema,
  errorSchema,
  namedProperties,
  namedSchema,
  nullableInteger,
  statsSchema,
} from "./common.js";

export const battleIdParamsSchema = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string", format: "uuid" } },
} as const;

export const createBattleBodySchema = {
  type: "object",
  required: ["team"],
  properties: {
    team: {
      type: "array",
      minItems: TEAM_SIZE,
      maxItems: TEAM_SIZE,
      items: {
        type: "object",
        required: ["pokemonId", "moveIds"],
        properties: {
          pokemonId: { type: "integer", minimum: 1 },
          moveIds: {
            type: "array",
            minItems: 1,
            maxItems: MAX_MOVES_PER_POKEMON,
            uniqueItems: true,
            items: { type: "integer", minimum: 1 },
          },
        },
      },
    },
  },
} as const;

export const battleActionBodySchema = {
  oneOf: [
    {
      type: "object",
      required: ["type", "moveId"],
      properties: {
        type: { const: "move" },
        moveId: { type: "integer", minimum: 1 },
      },
    },
    {
      type: "object",
      required: ["type", "slot"],
      properties: {
        type: { const: "switch" },
        slot: { type: "integer", minimum: 0 },
      },
    },
    {
      type: "object",
      required: ["type"],
      properties: { type: { const: "struggle" } },
    },
  ],
} as const;

export const invalidTeamSchema = {
  ...errorSchema,
  properties: {
    ...errorSchema.properties,
    // Only in the replies of a well-formed but invalid team.
    issues: {
      type: "array",
      items: {
        type: "object",
        required: ["slot", "reason"],
        properties: {
          slot: { type: "integer" },
          reason: { type: "string" },
          pokemonId: { type: "integer" },
          moveId: { type: "integer" },
        },
      },
    },
  },
} as const;

const moveViewSchema = {
  type: "object",
  required: [
    "id",
    "identifier",
    "nameFr",
    "nameEn",
    "type",
    "power",
    "accuracy",
    "priority",
    "damageClass",
    "pp",
    "maxPp",
  ],
  properties: {
    id: { type: "integer" },
    ...namedProperties,
    type: namedSchema,
    power: { type: "integer" },
    accuracy: nullableInteger,
    priority: { type: "integer" },
    damageClass: damageClassSchema,
    pp: { type: "integer" },
    maxPp: { type: "integer" },
  },
} as const;

const playerPokemonSchema = {
  type: "object",
  required: [
    "slot",
    "pokemonId",
    "identifier",
    "nameFr",
    "nameEn",
    "types",
    "hp",
    "stats",
    "moves",
  ],
  properties: {
    slot: { type: "integer" },
    pokemonId: { type: "integer" },
    ...namedProperties,
    types: { type: "array", items: namedSchema },
    hp: { type: "integer" },
    stats: statsSchema,
    moves: { type: "array", items: moveViewSchema },
  },
} as const;

// Only what the player may see of the bot's team: anything this schema
// leaves out is not serialized.
const opponentPokemonSchema = {
  type: "object",
  required: [
    "pokemonId",
    "identifier",
    "nameFr",
    "nameEn",
    "types",
    "hpPercent",
  ],
  properties: {
    pokemonId: { type: "integer" },
    ...namedProperties,
    types: { type: "array", items: namedSchema },
    hpPercent: { type: "integer" },
  },
} as const;

export const battleViewSchema = {
  type: "object",
  required: ["id", "turn", "phase", "winner", "player", "opponent", "log"],
  properties: {
    id: { type: "string" },
    turn: { type: "integer" },
    phase: {
      type: "string",
      enum: ["choose-action", "choose-switch", "finished"],
    },
    winner: {
      type: ["string", "null"],
      enum: ["player", "opponent", "draw", null],
    },
    player: {
      type: "object",
      required: ["active", "team", "mustStruggle"],
      properties: {
        active: { type: "integer" },
        team: { type: "array", items: playerPokemonSchema },
        mustStruggle: { type: "boolean" },
      },
    },
    opponent: {
      type: "object",
      required: ["active", "remaining", "teamSize"],
      properties: {
        active: opponentPokemonSchema,
        remaining: { type: "integer" },
        teamSize: { type: "integer" },
      },
    },
    // BattleEvent (packages/shared): built by the engine from the player's
    // point of view, serialized as is.
    log: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
  },
} as const;
