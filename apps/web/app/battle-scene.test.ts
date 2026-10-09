import type { BattleEvent, BattleView, Named } from "@pokebattle/shared";
import { describe, expect, it } from "vitest";
import {
  advancePlayback,
  EMPTY_SCENE,
  isPlaying,
  playbackSteps,
  receiveView,
  type Scene,
  sceneOf,
  shownScene,
  startPlayback,
} from "./battle-scene";

const pikachu: Named = {
  identifier: "pikachu",
  nameFr: "Pikachu",
  nameEn: null,
};
const charizard: Named = {
  identifier: "charizard",
  nameFr: "Dracaufeu",
  nameEn: null,
};
const tackle: Named = { identifier: "tackle", nameFr: "Charge", nameEn: null };

const playerIn: BattleEvent = {
  type: "switch",
  side: "player",
  slot: 0,
  pokemonId: 25,
  pokemon: pikachu,
  hpPercent: 100,
};
const opponentIn: BattleEvent = {
  type: "switch",
  side: "opponent",
  slot: 0,
  pokemonId: 6,
  pokemon: charizard,
  hpPercent: 100,
};

const START: Scene = {
  player: { pokemon: pikachu, pokemonId: 25, hpPercent: 100, fainted: false },
  opponent: {
    pokemon: charizard,
    pokemonId: 6,
    hpPercent: 100,
    fainted: false,
  },
};

function view(overrides: Partial<BattleView> = {}): BattleView {
  return {
    id: "battle-id",
    turn: 0,
    phase: "choose-action",
    winner: null,
    player: {
      active: 0,
      team: [
        {
          ...pikachu,
          slot: 0,
          pokemonId: 25,
          types: [],
          hp: 55,
          stats: {
            hp: 110,
            attack: 1,
            defense: 1,
            specialAttack: 1,
            specialDefense: 1,
            speed: 1,
          },
          moves: [],
        },
      ],
      mustStruggle: false,
    },
    opponent: {
      active: { ...charizard, pokemonId: 6, types: [], hpPercent: 80 },
      revealed: [],
      remaining: 1,
      teamSize: 1,
    },
    log: [playerIn, opponentIn],
    ...overrides,
  };
}

describe("sceneOf", () => {
  it("shows both active Pokémon with their HP rounded up", () => {
    expect(sceneOf(view())).toEqual({
      player: {
        pokemon: pikachu,
        pokemonId: 25,
        hpPercent: 50,
        fainted: false,
      },
      opponent: {
        pokemon: charizard,
        pokemonId: 6,
        hpPercent: 80,
        fainted: false,
      },
    });
  });
});

describe("playbackSteps", () => {
  it("sends out the Pokémon one message at a time", () => {
    const steps = playbackSteps(EMPTY_SCENE, [playerIn, opponentIn]);

    expect(steps).toEqual([
      {
        text: "Vous envoyez Pikachu !",
        scene: { player: START.player, opponent: null },
        cue: { side: "player", kind: "enter" },
      },
      {
        text: "L'adversaire envoie Dracaufeu !",
        scene: START,
        cue: { side: "opponent", kind: "enter" },
      },
    ]);
  });

  it("skips the turn headers and animates attacks, hits and faints", () => {
    const steps = playbackSteps(START, [
      { type: "turn-start", turn: 1 },
      { type: "move", side: "player", pokemon: pikachu, move: tackle },
      {
        type: "damage",
        side: "opponent",
        pokemon: charizard,
        hpPercent: 40,
        effectiveness: 1,
        critical: false,
      },
      { type: "recoil", side: "player", pokemon: pikachu, hpPercent: 90 },
      { type: "move", side: "opponent", pokemon: charizard, move: tackle },
      { type: "miss", side: "opponent", pokemon: charizard },
      { type: "faint", side: "opponent", pokemon: charizard },
      { type: "end", winner: "player" },
    ]);

    expect(steps.map((step) => step.cue)).toEqual([
      { side: "player", kind: "attack" },
      { side: "opponent", kind: "hit" },
      { side: "player", kind: "hit" },
      { side: "opponent", kind: "attack" },
      null,
      { side: "opponent", kind: "faint" },
      null,
    ]);
    expect(steps[1]?.scene.opponent?.hpPercent).toBe(40);
    expect(steps[2]?.scene.player?.hpPercent).toBe(90);
    expect(steps[5]?.scene.opponent).toMatchObject({
      hpPercent: 0,
      fainted: true,
    });
    expect(steps.at(-1)?.text).toBe("Vous avez gagné !");
  });

  it("does not change the scene it starts from", () => {
    const start = structuredClone(START);

    playbackSteps(start, [{ type: "faint", side: "player", pokemon: pikachu }]);

    expect(start).toEqual(START);
  });
});

describe("playback", () => {
  it("plays the opening switches of a new battle from an empty field", () => {
    const playback = startPlayback(view());

    expect(isPlaying(playback)).toBe(true);
    expect(shownScene(playback)).toEqual({
      player: START.player,
      opponent: null,
    });
  });

  it("plays nothing when the battle is already under way", () => {
    const battle = view({ turn: 2 });
    const playback = startPlayback(battle);

    expect(isPlaying(playback)).toBe(false);
    expect(shownScene(playback)).toEqual(sceneOf(battle));
  });

  it("plays the events of a new view, then shows that view", () => {
    const before = view({ turn: 1 });
    const after = view({
      turn: 2,
      log: [
        ...before.log,
        { type: "turn-start", turn: 2 },
        { type: "move", side: "player", pokemon: pikachu, move: tackle },
      ],
    });

    let playback = receiveView(startPlayback(before), after);

    expect(isPlaying(playback)).toBe(true);
    expect(playback.previous).toBe(before);
    expect(playback.steps).toHaveLength(1);
    expect(playback.steps[0]?.text).toBe("Pikachu utilise Charge !");

    playback = advancePlayback(playback);

    expect(isPlaying(playback)).toBe(false);
    expect(shownScene(playback)).toEqual(sceneOf(after));
    expect(advancePlayback(playback)).toBe(playback);
  });

  it("keeps playing nothing when a view brings no new event", () => {
    const battle = view({ turn: 1 });
    const playback = receiveView(startPlayback(battle), { ...battle });

    expect(isPlaying(playback)).toBe(false);
  });
});
