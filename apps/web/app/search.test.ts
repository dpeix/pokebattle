import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeSearch, searchPokemon } from "./search";

describe("normalizeSearch", () => {
  it("ignores case, accents and surrounding spaces", () => {
    expect(normalizeSearch("  Évoli ")).toBe("evoli");
    expect(normalizeSearch("Pokémon")).toBe("pokemon");
  });
});

describe("matchesSearch", () => {
  it("matches every text when the query is blank", () => {
    expect(matchesSearch("", ["Tonnerre"])).toBe(true);
    expect(matchesSearch("   ", ["Tonnerre"])).toBe(true);
  });

  it("matches a part of any text, ignoring case and accents", () => {
    expect(matchesSearch("flamme", ["Lance-Flammes", "Feu"])).toBe(true);
    expect(matchesSearch("FEU", ["Lance-Flammes", "Feu"])).toBe(true);
    expect(matchesSearch("electrik", ["Tonnerre", "Électrik"])).toBe(true);
    expect(matchesSearch("eau", ["Lance-Flammes", "Feu"])).toBe(false);
  });
});

describe("searchPokemon", () => {
  const pokemon = [
    { id: 4, name: "Salamèche" },
    { id: 6, name: "Dracaufeu" },
    { id: 25, name: "Pikachu" },
    { id: 133, name: "Évoli" },
    { id: 147, name: "Minidraco" },
    { id: 149, name: "Dracolosse" },
    { id: 250, name: "Ho-Oh" },
  ];

  it("finds nothing for a blank query", () => {
    expect(searchPokemon(pokemon, "", 10)).toEqual([]);
    expect(searchPokemon(pokemon, "  ", 10)).toEqual([]);
  });

  it("matches a part of the name, ignoring case and accents", () => {
    expect(searchPokemon(pokemon, "EVO", 10)).toEqual([
      { id: 133, name: "Évoli" },
    ]);
    expect(searchPokemon(pokemon, "meche", 10)).toEqual([
      { id: 4, name: "Salamèche" },
    ]);
  });

  it("lists the names starting with the query first", () => {
    expect(searchPokemon(pokemon, "draco", 10).map(({ id }) => id)).toEqual([
      149, 147,
    ]);
    expect(searchPokemon(pokemon, "dra", 10).map(({ id }) => id)).toEqual([
      6, 149, 147,
    ]);
  });

  it("finds a Pokémon by its number, with or without #", () => {
    expect(searchPokemon(pokemon, "25", 10).map(({ id }) => id)).toEqual([25]);
    expect(searchPokemon(pokemon, "#25", 10).map(({ id }) => id)).toEqual([25]);
  });

  it("returns at most the given number of results", () => {
    expect(searchPokemon(pokemon, "o", 2)).toHaveLength(2);
  });
});
