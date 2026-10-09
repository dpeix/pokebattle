// JSON Schemas shared by the routes. They live outside src/routes/, whose
// files are all loaded as route plugins by @fastify/autoload. Response
// schemas also serialize the replies: properties they omit are not sent.

export const nullableString = { type: ["string", "null"] } as const;
export const nullableInteger = { type: ["integer", "null"] } as const;

export const namedProperties = {
  identifier: { type: "string" },
  nameFr: nullableString,
  nameEn: nullableString,
} as const;

export const namedSchema = {
  type: "object",
  required: ["identifier", "nameFr", "nameEn"],
  properties: namedProperties,
} as const;

export const statsSchema = {
  type: "object",
  required: [
    "hp",
    "attack",
    "defense",
    "specialAttack",
    "specialDefense",
    "speed",
  ],
  properties: {
    hp: { type: "integer" },
    attack: { type: "integer" },
    defense: { type: "integer" },
    specialAttack: { type: "integer" },
    specialDefense: { type: "integer" },
    speed: { type: "integer" },
  },
} as const;

export const damageClassSchema = {
  type: "string",
  enum: ["physical", "special"],
} as const;

/** Positive integer ids, the way PokeAPI numbers its data. */
export const idParamsSchema = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "integer", minimum: 1 } },
} as const;

/** Body of the errors replied by the routes, as Fastify formats its own. */
export const errorSchema = {
  type: "object",
  required: ["statusCode", "error", "message"],
  properties: {
    statusCode: { type: "integer" },
    error: { type: "string" },
    message: { type: "string" },
  },
} as const;
