// Turns the PokeAPI CSV files into the rows of the battle engine tables.
// Pure functions: reading the files and writing to the database live in
// pokeapi.ts and load.ts.
import type {
  abilities,
  items,
  moveStatChanges,
  moves,
  natures,
  pokemon,
  pokemonAbilities,
  pokemonMoves,
  pokemonSpecies,
  stats,
  typeEfficacy,
  types,
  versionGroups,
} from "../db/schema.js";

export const POKEAPI_CSV_FILES = [
  "version_groups",
  "types",
  "type_names",
  "type_efficacy",
  "stats",
  "stat_names",
  "natures",
  "nature_names",
  "abilities",
  "ability_names",
  "ability_prose",
  "moves",
  "move_names",
  "move_meta",
  "move_meta_stat_changes",
  "move_damage_classes",
  "move_targets",
  "move_meta_ailments",
  "move_meta_categories",
  "move_flags",
  "move_flag_map",
  "move_effect_prose",
  "pokemon_species",
  "pokemon_species_names",
  "pokemon",
  "pokemon_forms",
  "pokemon_form_names",
  "pokemon_stats",
  "pokemon_types",
  "pokemon_abilities",
  "pokemon_moves",
  "pokemon_move_methods",
  "items",
  "item_names",
  "item_prose",
  "item_categories",
] as const;

export type PokeapiCsvFile = (typeof POKEAPI_CSV_FILES)[number];
export type CsvRow = Record<string, string>;
export type PokeapiCsv = Record<PokeapiCsvFile, CsvRow[]>;

export interface PokeapiData {
  versionGroups: (typeof versionGroups.$inferInsert)[];
  types: (typeof types.$inferInsert)[];
  typeEfficacy: (typeof typeEfficacy.$inferInsert)[];
  stats: (typeof stats.$inferInsert)[];
  natures: (typeof natures.$inferInsert)[];
  abilities: (typeof abilities.$inferInsert)[];
  moves: (typeof moves.$inferInsert)[];
  moveStatChanges: (typeof moveStatChanges.$inferInsert)[];
  pokemonSpecies: (typeof pokemonSpecies.$inferInsert)[];
  pokemon: (typeof pokemon.$inferInsert)[];
  pokemonAbilities: (typeof pokemonAbilities.$inferInsert)[];
  pokemonMoves: (typeof pokemonMoves.$inferInsert)[];
  items: (typeof items.$inferInsert)[];
}

// PokeAPI `local_language_id` values.
const FRENCH = "5";
const ENGLISH = "9";

// From 10001, PokeAPI numbers entries that do not exist in the main series
// games: the "unknown" and "shadow" types and the Colosseum/XD shadow moves.
// (Pokemon forms are numbered from 10001 too, but they are kept.)
const FIRST_NON_STANDARD_ID = 10001;

// Item categories that can be held in battle. Battle effects are not
// structured in PokeAPI, only described in the effect text.
const HELD_ITEM_CATEGORIES = new Set([
  // Berries, except the baking-only ones and the Legends: Arceus catching bonus
  "effort-drop",
  "medicine",
  "other",
  "in-a-pinch",
  "picky-healing",
  "type-protection",
  // Held items
  "held-items",
  "choice",
  "effort-training",
  "bad-held-items",
  "plates",
  "species-specific",
  "type-enhancement",
  "jewels",
  "mega-stones",
  "memories",
]);

interface Translation {
  fr: string | null;
  en: string | null;
}

/** Typed access to the columns of one CSV file, failing on unexpected values. */
function columns(file: PokeapiCsvFile) {
  const fail = (row: CsvRow, column: string, problem: string) =>
    new Error(
      `${file}.csv: ${problem} in column "${column}" of ${JSON.stringify(row)}`,
    );

  function text(row: CsvRow, column: string): string {
    const value = row[column];
    if (value === undefined) {
      throw new Error(`${file}.csv: missing column "${column}"`);
    }
    return value;
  }

  function optionalInt(row: CsvRow, column: string): number | null {
    const value = text(row, column);
    if (value === "") {
      return null;
    }
    if (!/^-?\d+$/.test(value)) {
      throw fail(row, column, `invalid integer "${value}"`);
    }
    return Number(value);
  }

  function int(row: CsvRow, column: string): number {
    const value = optionalInt(row, column);
    if (value === null) {
      throw fail(row, column, "empty value");
    }
    return value;
  }

  function bool(row: CsvRow, column: string): boolean {
    const value = text(row, column);
    if (value !== "0" && value !== "1") {
      throw fail(row, column, `invalid boolean "${value}"`);
    }
    return value === "1";
  }

  return { text, optionalInt, int, bool };
}

/** French and English values of a translation file, by entity id. */
function translations(
  csv: PokeapiCsv,
  file: PokeapiCsvFile,
  idColumn: string,
  valueColumn: string,
): (id: number) => Translation {
  const read = columns(file);
  const byId = new Map<number, Translation>();
  for (const row of csv[file]) {
    const language = read.text(row, "local_language_id");
    const value = read.text(row, valueColumn);
    if ((language !== FRENCH && language !== ENGLISH) || value === "") {
      continue;
    }
    const id = read.int(row, idColumn);
    const translation = byId.get(id) ?? { fr: null, en: null };
    translation[language === FRENCH ? "fr" : "en"] = value;
    byId.set(id, translation);
  }
  return (id) => byId.get(id) ?? { fr: null, en: null };
}

/** Identifier of a lookup table row (damage class, target...), by id. */
function identifiers(
  csv: PokeapiCsv,
  file: PokeapiCsvFile,
): (id: number) => string {
  const read = columns(file);
  const byId = new Map(
    csv[file].map((row) => [read.int(row, "id"), read.text(row, "identifier")]),
  );
  return (id) => {
    const identifier = byId.get(id);
    if (identifier === undefined) {
      throw new Error(`${file}.csv has no row with id ${id}`);
    }
    return identifier;
  };
}

function groupBy<T>(rows: T[], key: (row: T) => number): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const row of rows) {
    const group = groups.get(key(row));
    if (group) {
      group.push(row);
    } else {
      groups.set(key(row), [row]);
    }
  }
  return groups;
}

function transformTypes(csv: PokeapiCsv) {
  const read = columns("types");
  const names = translations(csv, "type_names", "type_id", "name");
  const kept = csv.types
    .map((row) => ({
      id: read.int(row, "id"),
      identifier: read.text(row, "identifier"),
    }))
    .filter(({ id }) => id < FIRST_NON_STANDARD_ID)
    .map((type) => {
      const name = names(type.id);
      return { ...type, nameFr: name.fr, nameEn: name.en };
    });

  const keptIds = new Set(kept.map((type) => type.id));
  const efficacy = columns("type_efficacy");
  const chart = csv.type_efficacy
    .map((row) => ({
      attackingTypeId: efficacy.int(row, "damage_type_id"),
      defendingTypeId: efficacy.int(row, "target_type_id"),
      damageFactor: efficacy.int(row, "damage_factor"),
    }))
    .filter(
      (row) =>
        keptIds.has(row.attackingTypeId) && keptIds.has(row.defendingTypeId),
    );

  return { types: kept, typeEfficacy: chart };
}

function transformStats(csv: PokeapiCsv): PokeapiData["stats"] {
  const read = columns("stats");
  const names = translations(csv, "stat_names", "stat_id", "name");
  return csv.stats.map((row) => {
    const id = read.int(row, "id");
    const name = names(id);
    return {
      id,
      identifier: read.text(row, "identifier"),
      nameFr: name.fr,
      nameEn: name.en,
      isBattleOnly: read.bool(row, "is_battle_only"),
    };
  });
}

function transformNatures(csv: PokeapiCsv): PokeapiData["natures"] {
  const read = columns("natures");
  const names = translations(csv, "nature_names", "nature_id", "name");
  return csv.natures.map((row) => {
    const id = read.int(row, "id");
    const name = names(id);
    const increasedStatId = read.int(row, "increased_stat_id");
    const decreasedStatId = read.int(row, "decreased_stat_id");
    // PokeAPI gives neutral natures the same increased and decreased stat.
    const isNeutral = increasedStatId === decreasedStatId;
    return {
      id,
      identifier: read.text(row, "identifier"),
      nameFr: name.fr,
      nameEn: name.en,
      increasedStatId: isNeutral ? null : increasedStatId,
      decreasedStatId: isNeutral ? null : decreasedStatId,
    };
  });
}

function transformAbilities(csv: PokeapiCsv): PokeapiData["abilities"] {
  const read = columns("abilities");
  const names = translations(csv, "ability_names", "ability_id", "name");
  const effects = translations(
    csv,
    "ability_prose",
    "ability_id",
    "short_effect",
  );
  return csv.abilities
    .filter((row) => read.bool(row, "is_main_series"))
    .map((row) => {
      const id = read.int(row, "id");
      const name = names(id);
      const effect = effects(id);
      return {
        id,
        identifier: read.text(row, "identifier"),
        nameFr: name.fr,
        nameEn: name.en,
        generationId: read.int(row, "generation_id"),
        shortEffectFr: effect.fr,
        shortEffectEn: effect.en,
      };
    });
}

function transformMoves(csv: PokeapiCsv) {
  const read = columns("moves");
  const names = translations(csv, "move_names", "move_id", "name");
  const effects = translations(
    csv,
    "move_effect_prose",
    "move_effect_id",
    "short_effect",
  );
  const damageClasses = identifiers(csv, "move_damage_classes");
  const targets = identifiers(csv, "move_targets");
  const categories = identifiers(csv, "move_meta_categories");
  const ailments = identifiers(csv, "move_meta_ailments");
  const flagNames = identifiers(csv, "move_flags");

  const meta = columns("move_meta");
  const metaByMove = new Map(
    csv.move_meta.map((row) => [meta.int(row, "move_id"), row]),
  );
  const flagMap = columns("move_flag_map");
  const flagsByMove = groupBy(csv.move_flag_map, (row) =>
    flagMap.int(row, "move_id"),
  );

  const kept = csv.moves
    .filter((row) => read.int(row, "id") < FIRST_NON_STANDARD_ID)
    .map((row) => {
      const id = read.int(row, "id");
      const name = names(id);
      const effectId = read.optionalInt(row, "effect_id");
      const effect =
        effectId === null ? { fr: null, en: null } : effects(effectId);
      // Recent moves have no battle metadata in PokeAPI yet.
      const moveMeta = metaByMove.get(id);
      const metaInt = (column: string) =>
        moveMeta ? meta.optionalInt(moveMeta, column) : null;
      return {
        id,
        identifier: read.text(row, "identifier"),
        nameFr: name.fr,
        nameEn: name.en,
        generationId: read.int(row, "generation_id"),
        typeId: read.int(row, "type_id"),
        power: read.optionalInt(row, "power"),
        pp: read.int(row, "pp"),
        accuracy: read.optionalInt(row, "accuracy"),
        priority: read.int(row, "priority"),
        damageClass: damageClasses(read.int(row, "damage_class_id")),
        target: targets(read.int(row, "target_id")),
        effectChance: read.optionalInt(row, "effect_chance"),
        category: moveMeta
          ? categories(meta.int(moveMeta, "meta_category_id"))
          : null,
        ailment: moveMeta
          ? ailments(meta.int(moveMeta, "meta_ailment_id"))
          : null,
        minHits: metaInt("min_hits"),
        maxHits: metaInt("max_hits"),
        minTurns: metaInt("min_turns"),
        maxTurns: metaInt("max_turns"),
        drain: metaInt("drain"),
        healing: metaInt("healing"),
        critRate: metaInt("crit_rate"),
        ailmentChance: metaInt("ailment_chance"),
        flinchChance: metaInt("flinch_chance"),
        statChance: metaInt("stat_chance"),
        flags: (flagsByMove.get(id) ?? []).map((flag) =>
          flagNames(flagMap.int(flag, "move_flag_id")),
        ),
        shortEffectFr: effect.fr,
        shortEffectEn: effect.en,
      };
    });

  const keptIds = new Set(kept.map((move) => move.id));
  const change = columns("move_meta_stat_changes");
  const statChanges = csv.move_meta_stat_changes
    .map((row) => ({
      moveId: change.int(row, "move_id"),
      statId: change.int(row, "stat_id"),
      change: change.int(row, "change"),
    }))
    .filter((row) => keptIds.has(row.moveId));

  return { moves: kept, moveStatChanges: statChanges };
}

function transformSpecies(csv: PokeapiCsv): PokeapiData["pokemonSpecies"] {
  const read = columns("pokemon_species");
  const names = translations(
    csv,
    "pokemon_species_names",
    "pokemon_species_id",
    "name",
  );
  return csv.pokemon_species.map((row) => {
    const id = read.int(row, "id");
    const name = names(id);
    return {
      id,
      identifier: read.text(row, "identifier"),
      nameFr: name.fr,
      nameEn: name.en,
      generationId: read.int(row, "generation_id"),
      genderRate: read.int(row, "gender_rate"),
      isLegendary: read.bool(row, "is_legendary"),
      isMythical: read.bool(row, "is_mythical"),
    };
  });
}

function transformPokemon(csv: PokeapiCsv): PokeapiData["pokemon"] {
  const read = columns("pokemon");
  const speciesNames = translations(
    csv,
    "pokemon_species_names",
    "pokemon_species_id",
    "name",
  );
  const formNames = translations(
    csv,
    "pokemon_form_names",
    "pokemon_form_id",
    "pokemon_name",
  );
  const statNames = identifiers(csv, "stats");

  const form = columns("pokemon_forms");
  const formsByPokemon = groupBy(csv.pokemon_forms, (row) =>
    form.int(row, "pokemon_id"),
  );
  const stat = columns("pokemon_stats");
  const statsByPokemon = groupBy(csv.pokemon_stats, (row) =>
    stat.int(row, "pokemon_id"),
  );
  const type = columns("pokemon_types");
  const typesByPokemon = groupBy(csv.pokemon_types, (row) =>
    type.int(row, "pokemon_id"),
  );

  return csv.pokemon.map((row) => {
    const id = read.int(row, "id");
    const identifier = read.text(row, "identifier");
    const speciesId = read.int(row, "species_id");
    const isDefault = read.bool(row, "is_default");

    // A pokemon has one default form, except a few form-only variants
    // (such as koraidon-limited-build) whose only form is not flagged.
    const forms = formsByPokemon.get(id) ?? [];
    const mainForm =
      forms.find((candidate) => form.bool(candidate, "is_default")) ??
      forms.toSorted(
        (a, b) => form.int(a, "form_order") - form.int(b, "form_order"),
      )[0];
    if (!mainForm) {
      throw new Error(`pokemon ${identifier} has no row in pokemon_forms.csv`);
    }

    // Default pokemon are named after their species ("Pikachu"); other
    // forms have a full name of their own ("Méga-Dracaufeu X"), falling back
    // to the species name when PokeAPI has none.
    const speciesName = speciesNames(speciesId);
    const formName = isDefault
      ? { fr: null, en: null }
      : formNames(form.int(mainForm, "id"));

    const baseStats = new Map(
      (statsByPokemon.get(id) ?? []).map((statRow) => [
        statNames(stat.int(statRow, "stat_id")),
        stat.int(statRow, "base_stat"),
      ]),
    );
    const baseStat = (statIdentifier: string): number => {
      const value = baseStats.get(statIdentifier);
      if (value === undefined) {
        throw new Error(
          `pokemon ${identifier} has no base ${statIdentifier} in pokemon_stats.csv`,
        );
      }
      return value;
    };

    const typeIds = new Map(
      (typesByPokemon.get(id) ?? []).map((typeRow) => [
        type.int(typeRow, "slot"),
        type.int(typeRow, "type_id"),
      ]),
    );
    const type1Id = typeIds.get(1);
    if (type1Id === undefined) {
      throw new Error(
        `pokemon ${identifier} has no type in slot 1 in pokemon_types.csv`,
      );
    }

    return {
      id,
      identifier,
      speciesId,
      nameFr: formName.fr ?? speciesName.fr,
      nameEn: formName.en ?? speciesName.en,
      isDefault,
      isBattleOnly: form.bool(mainForm, "is_battle_only"),
      isMega: form.bool(mainForm, "is_mega"),
      height: read.int(row, "height"),
      weight: read.int(row, "weight"),
      hp: baseStat("hp"),
      attack: baseStat("attack"),
      defense: baseStat("defense"),
      specialAttack: baseStat("special-attack"),
      specialDefense: baseStat("special-defense"),
      speed: baseStat("speed"),
      type1Id,
      type2Id: typeIds.get(2) ?? null,
    };
  });
}

function transformPokemonAbilities(
  csv: PokeapiCsv,
): PokeapiData["pokemonAbilities"] {
  const read = columns("pokemon_abilities");
  return csv.pokemon_abilities.map((row) => ({
    pokemonId: read.int(row, "pokemon_id"),
    abilityId: read.int(row, "ability_id"),
    slot: read.int(row, "slot"),
    isHidden: read.bool(row, "is_hidden"),
  }));
}

function transformPokemonMoves(csv: PokeapiCsv): PokeapiData["pokemonMoves"] {
  const read = columns("pokemon_moves");
  const methods = identifiers(csv, "pokemon_move_methods");
  return csv.pokemon_moves.map((row) => ({
    pokemonId: read.int(row, "pokemon_id"),
    versionGroupId: read.int(row, "version_group_id"),
    moveId: read.int(row, "move_id"),
    method: methods(read.int(row, "pokemon_move_method_id")),
    level: read.int(row, "level"),
  }));
}

function transformItems(csv: PokeapiCsv): PokeapiData["items"] {
  const read = columns("items");
  const names = translations(csv, "item_names", "item_id", "name");
  const effects = translations(csv, "item_prose", "item_id", "short_effect");
  const categories = identifiers(csv, "item_categories");

  const category = columns("item_categories");
  const knownCategories = new Set(
    csv.item_categories.map((row) => category.text(row, "identifier")),
  );
  for (const heldCategory of HELD_ITEM_CATEGORIES) {
    if (!knownCategories.has(heldCategory)) {
      throw new Error(`item_categories.csv has no category ${heldCategory}`);
    }
  }

  const kept: PokeapiData["items"] = [];
  const seenIdentifiers = new Set<string>();
  const byId = csv.items.toSorted(
    (a, b) => read.int(a, "id") - read.int(b, "id"),
  );
  for (const row of byId) {
    const identifier = read.text(row, "identifier");
    const itemCategory = categories(read.int(row, "category_id"));
    // PokeAPI lists roseli-berry twice; the second entry has no name or text.
    if (
      !HELD_ITEM_CATEGORIES.has(itemCategory) ||
      seenIdentifiers.has(identifier)
    ) {
      continue;
    }
    seenIdentifiers.add(identifier);
    const id = read.int(row, "id");
    const name = names(id);
    const effect = effects(id);
    kept.push({
      id,
      identifier,
      nameFr: name.fr,
      nameEn: name.en,
      category: itemCategory,
      flingPower: read.optionalInt(row, "fling_power"),
      shortEffectFr: effect.fr,
      shortEffectEn: effect.en,
    });
  }
  return kept;
}

function transformVersionGroups(csv: PokeapiCsv): PokeapiData["versionGroups"] {
  const read = columns("version_groups");
  return csv.version_groups.map((row) => ({
    id: read.int(row, "id"),
    identifier: read.text(row, "identifier"),
    generationId: read.int(row, "generation_id"),
    order: read.int(row, "order"),
  }));
}

/** Builds the rows of every imported table; throws on unexpected data. */
export function transformPokeapi(csv: PokeapiCsv): PokeapiData {
  return {
    versionGroups: transformVersionGroups(csv),
    ...transformTypes(csv),
    stats: transformStats(csv),
    natures: transformNatures(csv),
    abilities: transformAbilities(csv),
    ...transformMoves(csv),
    pokemonSpecies: transformSpecies(csv),
    pokemon: transformPokemon(csv),
    pokemonAbilities: transformPokemonAbilities(csv),
    pokemonMoves: transformPokemonMoves(csv),
    items: transformItems(csv),
  };
}
