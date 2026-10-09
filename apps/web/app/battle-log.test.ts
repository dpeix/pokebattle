import type { BattleEvent, Named } from "@pokebattle/shared";
import { describe, expect, it } from "vitest";
import { describeEvent, displayName } from "./battle-log";

const pikachu: Named = {
  identifier: "pikachu",
  nameFr: "Pikachu",
  nameEn: "Pikachu",
};
const charizard: Named = {
  identifier: "charizard",
  nameFr: "Dracaufeu",
  nameEn: "Charizard",
};
const thunderbolt: Named = {
  identifier: "thunderbolt",
  nameFr: "Tonnerre",
  nameEn: "Thunderbolt",
};

describe("displayName", () => {
  it("prefers the French name, then the English one, then the identifier", () => {
    expect(displayName(charizard)).toBe("Dracaufeu");
    expect(displayName({ ...charizard, nameFr: null })).toBe("Charizard");
    expect(
      displayName({ identifier: "tera-blast", nameFr: null, nameEn: null }),
    ).toBe("tera-blast");
  });
});

describe("describeEvent", () => {
  it.each<[BattleEvent, string]>([
    [{ type: "turn-start", turn: 3 }, "Tour 3"],
    [
      {
        type: "switch",
        side: "player",
        slot: 0,
        pokemonId: 25,
        pokemon: pikachu,
        hpPercent: 100,
      },
      "Vous envoyez Pikachu !",
    ],
    [
      {
        type: "switch",
        side: "opponent",
        slot: 0,
        pokemonId: 6,
        pokemon: charizard,
        hpPercent: 100,
      },
      "L'adversaire envoie Dracaufeu !",
    ],
    [
      { type: "move", side: "player", pokemon: pikachu, move: thunderbolt },
      "Pikachu utilise Tonnerre !",
    ],
    [
      { type: "move", side: "opponent", pokemon: charizard, move: thunderbolt },
      "Dracaufeu adverse utilise Tonnerre !",
    ],
    [
      { type: "miss", side: "player", pokemon: pikachu },
      "L'attaque de Pikachu échoue !",
    ],
    [
      { type: "immune", side: "opponent", pokemon: charizard },
      "Ça n'affecte pas Dracaufeu adverse…",
    ],
    [
      {
        type: "damage",
        side: "opponent",
        pokemon: charizard,
        hpPercent: 40,
        effectiveness: 2,
        critical: true,
      },
      "Coup critique ! C'est super efficace ! Dracaufeu adverse : 40 % PV.",
    ],
    [
      {
        type: "damage",
        side: "player",
        pokemon: pikachu,
        hpPercent: 75,
        effectiveness: 0.5,
        critical: false,
      },
      "Ce n'est pas très efficace… Pikachu : 75 % PV.",
    ],
    [
      {
        type: "damage",
        side: "player",
        pokemon: pikachu,
        hpPercent: 10,
        effectiveness: 1,
        critical: false,
      },
      "Pikachu : 10 % PV.",
    ],
    [
      { type: "recoil", side: "player", pokemon: pikachu, hpPercent: 50 },
      "Pikachu subit le contrecoup : 50 % PV.",
    ],
    [
      { type: "faint", side: "opponent", pokemon: charizard },
      "Dracaufeu adverse est K.O. !",
    ],
    [{ type: "end", winner: "player" }, "Vous avez gagné !"],
    [{ type: "end", winner: "opponent" }, "Vous avez perdu…"],
    [{ type: "end", winner: "draw" }, "Match nul !"],
  ])("describes %o", (event, text) => {
    expect(describeEvent(event)).toBe(text);
  });
});
