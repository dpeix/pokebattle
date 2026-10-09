import {
  damageClassSchema,
  namedProperties,
  namedSchema,
  nullableInteger,
  statsSchema,
} from "./common.js";

const pokemonSummaryProperties = {
  id: { type: "integer" },
  ...namedProperties,
  types: { type: "array", items: namedSchema },
  baseStats: statsSchema,
} as const;

const pokemonSummaryRequired = [
  "id",
  "identifier",
  "nameFr",
  "nameEn",
  "types",
  "baseStats",
] as const;

export const pokemonSummaryListSchema = {
  type: "array",
  items: {
    type: "object",
    required: pokemonSummaryRequired,
    properties: pokemonSummaryProperties,
  },
} as const;

const learnableMoveSchema = {
  type: "object",
  required: [
    "id",
    "identifier",
    "nameFr",
    "nameEn",
    "type",
    "power",
    "accuracy",
    "pp",
    "priority",
    "damageClass",
  ],
  properties: {
    id: { type: "integer" },
    ...namedProperties,
    type: namedSchema,
    power: { type: "integer" },
    accuracy: nullableInteger,
    pp: { type: "integer" },
    priority: { type: "integer" },
    damageClass: damageClassSchema,
  },
} as const;

export const pokemonDetailSchema = {
  type: "object",
  required: [...pokemonSummaryRequired, "moves"],
  properties: {
    ...pokemonSummaryProperties,
    moves: { type: "array", items: learnableMoveSchema },
  },
} as const;
