import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { readPokeapiCsv } from "../src/import/pokeapi.js";
import { directorySource } from "../src/import/source.js";
import {
  type PokeapiCsv,
  type PokeapiData,
  transformPokeapi,
} from "../src/import/transform.js";

// Subset of the pinned PokeAPI CSV files: Bulbasaur, Charizard and its
// Mega X form, Pikachu, Koraidon and one of its form-only variants, plus
// the types, moves, abilities and items they need.
const FIXTURES = fileURLToPath(new URL("fixtures/pokeapi", import.meta.url));

function byIdentifier<T extends { identifier: string }>(
  rows: T[],
  identifier: string,
): T {
  const row = rows.find((candidate) => candidate.identifier === identifier);
  if (!row) {
    throw new Error(`no row with identifier ${identifier}`);
  }
  return row;
}

/** Fixture CSV with `edit` applied to a copy of one file's rows. */
function withEditedFile(
  csv: PokeapiCsv,
  file: keyof PokeapiCsv,
  edit: (rows: Record<string, string>[]) => Record<string, string>[],
): PokeapiCsv {
  const rows = csv[file].map((row) => ({ ...row }));
  return { ...csv, [file]: edit(rows) };
}

describe("transformPokeapi", () => {
  let csv: PokeapiCsv;
  let data: PokeapiData;

  beforeAll(async () => {
    csv = await readPokeapiCsv(directorySource(FIXTURES));
    data = transformPokeapi(csv);
  });

  it("keeps the standard types with their French and English names", () => {
    expect(data.types.map((type) => type.identifier).sort()).toEqual([
      "dragon",
      "electric",
      "fighting",
      "fire",
      "flying",
      "grass",
      "normal",
      "poison",
    ]);
    expect(byIdentifier(data.types, "fire")).toEqual({
      id: 10,
      identifier: "fire",
      nameFr: "Feu",
      nameEn: "Fire",
    });
  });

  it("imports the type chart", () => {
    expect(data.typeEfficacy).toHaveLength(64);
    expect(data.typeEfficacy).toContainEqual({
      attackingTypeId: 10,
      defendingTypeId: 12,
      damageFactor: 200,
    });
  });

  it("keeps stats without names as null", () => {
    expect(data.stats).toHaveLength(9);
    expect(byIdentifier(data.stats, "special")).toMatchObject({
      nameFr: null,
      nameEn: null,
    });
    expect(byIdentifier(data.stats, "accuracy").isBattleOnly).toBe(true);
    expect(byIdentifier(data.stats, "speed").isBattleOnly).toBe(false);
  });

  it("stores no stat change for a neutral nature", () => {
    expect(byIdentifier(data.natures, "hardy")).toEqual({
      id: 1,
      identifier: "hardy",
      nameFr: "Hardi",
      nameEn: "Hardy",
      increasedStatId: null,
      decreasedStatId: null,
    });
    expect(byIdentifier(data.natures, "adamant")).toMatchObject({
      increasedStatId: 2,
      decreasedStatId: 4,
    });
  });

  it("keeps main series abilities only, with missing names as null", () => {
    expect(data.abilities.map((ability) => ability.identifier)).not.toContain(
      "mountaineer",
    );
    expect(byIdentifier(data.abilities, "eelevate")).toMatchObject({
      nameFr: null,
      nameEn: "Eelevate",
    });
    expect(byIdentifier(data.abilities, "static").shortEffectEn).toEqual(
      expect.any(String),
    );
  });

  it("imports moves with their battle metadata and flags", () => {
    expect(byIdentifier(data.moves, "thunderbolt")).toEqual({
      id: 85,
      identifier: "thunderbolt",
      nameFr: "Tonnerre",
      nameEn: "Thunderbolt",
      generationId: 1,
      typeId: 13,
      power: 90,
      pp: 15,
      accuracy: 100,
      priority: 0,
      damageClass: "special",
      target: "selected-pokemon",
      effectChance: 10,
      category: "damage-ailment",
      ailment: "paralysis",
      minHits: null,
      maxHits: null,
      minTurns: null,
      maxTurns: null,
      drain: 0,
      healing: 0,
      critRate: 0,
      ailmentChance: 10,
      flinchChance: 0,
      statChance: 0,
      flags: ["protect", "mirror"],
      shortEffectFr: "A une chance de paralyser la cible.",
      shortEffectEn: "Has a chance to paralyze the target.",
    });
  });

  it("keeps empty move values as null", () => {
    expect(byIdentifier(data.moves, "swords-dance")).toMatchObject({
      power: null,
      accuracy: null,
      damageClass: "status",
      flags: ["snatch", "dance"],
    });
  });

  it("keeps moves that PokeAPI has no metadata or effect text for", () => {
    expect(byIdentifier(data.moves, "tera-blast")).toMatchObject({
      power: 80,
      category: null,
      ailment: null,
      drain: null,
      flags: [],
      shortEffectFr: null,
      shortEffectEn: null,
    });
  });

  it("excludes the Colosseum shadow moves", () => {
    expect(data.moves.map((move) => move.identifier)).not.toContain(
      "shadow-rush",
    );
    expect(data.moves).toHaveLength(6);
  });

  it("imports the stat changes of moves", () => {
    expect(data.moveStatChanges).toEqual(
      expect.arrayContaining([
        { moveId: 14, statId: 2, change: 2 },
        { moveId: 851, statId: 2, change: -1 },
        { moveId: 851, statId: 4, change: -1 },
      ]),
    );
    expect(data.moveStatChanges).toHaveLength(3);
  });

  it("imports species", () => {
    expect(byIdentifier(data.pokemonSpecies, "koraidon")).toEqual({
      id: 1007,
      identifier: "koraidon",
      nameFr: "Koraidon",
      nameEn: "Koraidon",
      generationId: 9,
      genderRate: -1,
      isLegendary: true,
      isMythical: false,
    });
  });

  it("imports a pokemon with its base stats and types", () => {
    expect(byIdentifier(data.pokemon, "pikachu")).toEqual({
      id: 25,
      identifier: "pikachu",
      speciesId: 25,
      nameFr: "Pikachu",
      nameEn: "Pikachu",
      isDefault: true,
      isBattleOnly: false,
      isMega: false,
      height: 4,
      weight: 60,
      hp: 35,
      attack: 55,
      defense: 40,
      specialAttack: 50,
      specialDefense: 50,
      speed: 90,
      type1Id: 13,
      type2Id: null,
    });
  });

  it("names a default pokemon after its species", () => {
    expect(byIdentifier(data.pokemon, "bulbasaur")).toMatchObject({
      nameFr: "Bulbizarre",
      nameEn: "Bulbasaur",
      type1Id: 12,
      type2Id: 4,
    });
  });

  it("imports mega evolutions as battle-only forms", () => {
    expect(byIdentifier(data.pokemon, "charizard-mega-x")).toMatchObject({
      speciesId: 6,
      nameFr: "Méga-Dracaufeu X",
      nameEn: "Mega Charizard X",
      isDefault: false,
      isBattleOnly: true,
      isMega: true,
      attack: 130,
      type1Id: 10,
      type2Id: 16,
    });
  });

  it("imports a form that has no default form or English name of its own", () => {
    expect(byIdentifier(data.pokemon, "koraidon-limited-build")).toMatchObject({
      nameFr: "Koraidon Forme Limitée",
      nameEn: "Koraidon",
      isDefault: false,
      isBattleOnly: false,
      isMega: false,
    });
  });

  it("imports pokemon abilities, hidden ones included", () => {
    const bulbasaurAbilities = data.pokemonAbilities.filter(
      (row) => row.pokemonId === 1,
    );
    expect(bulbasaurAbilities).toEqual([
      { pokemonId: 1, abilityId: 65, slot: 1, isHidden: false },
      { pokemonId: 1, abilityId: 34, slot: 3, isHidden: true },
    ]);
  });

  it("imports learnsets of every version group with their method", () => {
    const pikachuMoves = data.pokemonMoves.filter(
      (row) => row.pokemonId === 25,
    );
    expect(pikachuMoves).toEqual([
      {
        pokemonId: 25,
        versionGroupId: 1,
        moveId: 85,
        method: "machine",
        level: 0,
      },
      {
        pokemonId: 25,
        versionGroupId: 25,
        moveId: 85,
        method: "level-up",
        level: 36,
      },
      {
        pokemonId: 25,
        versionGroupId: 25,
        moveId: 85,
        method: "machine",
        level: 0,
      },
      {
        pokemonId: 25,
        versionGroupId: 25,
        moveId: 851,
        method: "machine",
        level: 0,
      },
    ]);
    expect(data.pokemonMoves).toHaveLength(29);
  });

  it("keeps held items and berries only", () => {
    expect(data.items.map((item) => item.identifier).sort()).toEqual([
      "charizardite-x",
      "choice-band",
      "leftovers",
      "roseli-berry",
      "sitrus-berry",
    ]);
    expect(byIdentifier(data.items, "leftovers")).toEqual({
      id: 211,
      identifier: "leftovers",
      nameFr: "Restes",
      nameEn: "Leftovers",
      category: "held-items",
      flingPower: 10,
      shortEffectFr: expect.any(String),
      shortEffectEn: expect.any(String),
    });
  });

  it("keeps the first of two items sharing an identifier", () => {
    expect(byIdentifier(data.items, "roseli-berry")).toMatchObject({
      id: 723,
      nameFr: "Baie Selro",
    });
  });

  it("rejects an invalid integer, naming the file and column", () => {
    const broken = withEditedFile(csv, "pokemon", (rows) =>
      rows.map((row) =>
        row.identifier === "pikachu" ? { ...row, height: "tall" } : row,
      ),
    );

    expect(() => transformPokeapi(broken)).toThrow(/pokemon\.csv.*height/);
  });

  it("rejects a missing column", () => {
    const broken = withEditedFile(csv, "moves", (rows) =>
      rows.map(({ power: _power, ...row }) => row),
    );

    expect(() => transformPokeapi(broken)).toThrow(/moves\.csv.*power/);
  });

  it("rejects a pokemon without all its base stats", () => {
    const broken = withEditedFile(csv, "pokemon_stats", (rows) =>
      rows.filter((row) => !(row.pokemon_id === "25" && row.stat_id === "6")),
    );

    expect(() => transformPokeapi(broken)).toThrow(/pikachu.*speed/);
  });

  it("rejects a reference to an unknown lookup value", () => {
    const broken = withEditedFile(csv, "move_damage_classes", (rows) =>
      rows.filter((row) => row.identifier !== "special"),
    );

    expect(() => transformPokeapi(broken)).toThrow(/move_damage_classes/);
  });
});
