// Drizzle tables of the battle engine database.
//
// The tables below hold the PokeAPI reference data needed by battles; they
// are filled (and entirely replaced) by the import script in src/import/.
// Primary keys are the PokeAPI ids, which are stable across releases.
// Small PokeAPI lookup tables (damage classes, targets, ailments, learn
// methods, item categories) are stored as their text identifier in the
// referencing column. Names and effect texts are nullable: PokeAPI lacks
// some translations, and `identifier` is always present as a fallback.
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";

export const versionGroups = pgTable("version_groups", {
  id: integer("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  generationId: integer("generation_id").notNull(),
  order: integer("order").notNull(),
});

export const types = pgTable("types", {
  id: integer("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  nameFr: text("name_fr"),
  nameEn: text("name_en"),
});

export const typeEfficacy = pgTable(
  "type_efficacy",
  {
    attackingTypeId: integer("attacking_type_id")
      .notNull()
      .references(() => types.id),
    defendingTypeId: integer("defending_type_id")
      .notNull()
      .references(() => types.id),
    // Percentage: 0, 50, 100 or 200.
    damageFactor: integer("damage_factor").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.attackingTypeId, table.defendingTypeId] }),
  ],
);

export const stats = pgTable("stats", {
  id: integer("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  nameFr: text("name_fr"),
  nameEn: text("name_en"),
  // Accuracy and evasion only exist during a battle.
  isBattleOnly: boolean("is_battle_only").notNull(),
});

export const natures = pgTable("natures", {
  id: integer("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  nameFr: text("name_fr"),
  nameEn: text("name_en"),
  // Both null for a neutral nature.
  increasedStatId: integer("increased_stat_id").references(() => stats.id),
  decreasedStatId: integer("decreased_stat_id").references(() => stats.id),
});

export const abilities = pgTable("abilities", {
  id: integer("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  nameFr: text("name_fr"),
  nameEn: text("name_en"),
  generationId: integer("generation_id").notNull(),
  shortEffectFr: text("short_effect_fr"),
  shortEffectEn: text("short_effect_en"),
});

export const moves = pgTable("moves", {
  id: integer("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  nameFr: text("name_fr"),
  nameEn: text("name_en"),
  generationId: integer("generation_id").notNull(),
  typeId: integer("type_id")
    .notNull()
    .references(() => types.id),
  power: integer("power"),
  pp: integer("pp").notNull(),
  accuracy: integer("accuracy"),
  priority: integer("priority").notNull(),
  // physical, special or status
  damageClass: text("damage_class").notNull(),
  target: text("target").notNull(),
  effectChance: integer("effect_chance"),
  // Battle metadata (PokeAPI move_meta), null when PokeAPI has none.
  category: text("category"),
  ailment: text("ailment"),
  minHits: integer("min_hits"),
  maxHits: integer("max_hits"),
  minTurns: integer("min_turns"),
  maxTurns: integer("max_turns"),
  drain: integer("drain"),
  healing: integer("healing"),
  critRate: integer("crit_rate"),
  ailmentChance: integer("ailment_chance"),
  flinchChance: integer("flinch_chance"),
  statChance: integer("stat_chance"),
  // contact, protect, sound, punch...
  flags: text("flags").array().notNull(),
  shortEffectFr: text("short_effect_fr"),
  shortEffectEn: text("short_effect_en"),
});

export const moveStatChanges = pgTable(
  "move_stat_changes",
  {
    moveId: integer("move_id")
      .notNull()
      .references(() => moves.id),
    statId: integer("stat_id")
      .notNull()
      .references(() => stats.id),
    change: integer("change").notNull(),
  },
  (table) => [primaryKey({ columns: [table.moveId, table.statId] })],
);

export const pokemonSpecies = pgTable("pokemon_species", {
  id: integer("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  nameFr: text("name_fr"),
  nameEn: text("name_en"),
  generationId: integer("generation_id").notNull(),
  // Chance of being female in eighths, -1 for genderless.
  genderRate: integer("gender_rate").notNull(),
  isLegendary: boolean("is_legendary").notNull(),
  isMythical: boolean("is_mythical").notNull(),
});

export const pokemon = pgTable("pokemon", {
  id: integer("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  speciesId: integer("species_id")
    .notNull()
    .references(() => pokemonSpecies.id),
  nameFr: text("name_fr"),
  nameEn: text("name_en"),
  // The species' standard form; other rows are megas, regional or alternate forms.
  isDefault: boolean("is_default").notNull(),
  // Forms that only exist during a battle (megas, Primal Reversion...).
  isBattleOnly: boolean("is_battle_only").notNull(),
  isMega: boolean("is_mega").notNull(),
  // Decimetres and hectograms, as in PokeAPI.
  height: integer("height").notNull(),
  weight: integer("weight").notNull(),
  hp: integer("hp").notNull(),
  attack: integer("attack").notNull(),
  defense: integer("defense").notNull(),
  specialAttack: integer("special_attack").notNull(),
  specialDefense: integer("special_defense").notNull(),
  speed: integer("speed").notNull(),
  type1Id: integer("type1_id")
    .notNull()
    .references(() => types.id),
  type2Id: integer("type2_id").references(() => types.id),
});

export const pokemonAbilities = pgTable(
  "pokemon_abilities",
  {
    pokemonId: integer("pokemon_id")
      .notNull()
      .references(() => pokemon.id),
    abilityId: integer("ability_id")
      .notNull()
      .references(() => abilities.id),
    slot: integer("slot").notNull(),
    isHidden: boolean("is_hidden").notNull(),
  },
  (table) => [primaryKey({ columns: [table.pokemonId, table.slot] })],
);

export const pokemonMoves = pgTable(
  "pokemon_moves",
  {
    pokemonId: integer("pokemon_id")
      .notNull()
      .references(() => pokemon.id),
    versionGroupId: integer("version_group_id")
      .notNull()
      .references(() => versionGroups.id),
    moveId: integer("move_id")
      .notNull()
      .references(() => moves.id),
    // level-up, machine, egg, tutor...
    method: text("method").notNull(),
    // 0 when the move is not learnt by level-up.
    level: integer("level").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.pokemonId,
        table.versionGroupId,
        table.moveId,
        table.method,
        table.level,
      ],
    }),
  ],
);

export const items = pgTable("items", {
  id: integer("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  nameFr: text("name_fr"),
  nameEn: text("name_en"),
  category: text("category").notNull(),
  flingPower: integer("fling_power"),
  shortEffectFr: text("short_effect_fr"),
  shortEffectEn: text("short_effect_en"),
});
