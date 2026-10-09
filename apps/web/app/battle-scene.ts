// Replay of the battle log on the battle screen: after an action, the new
// events are shown one message at a time, each with the field as it was at
// that moment. Display only: the outcome comes from the battle engine.
import type {
  BattleEvent,
  BattleSide,
  BattleView,
  Named,
} from "@pokebattle/shared";
import { describeEvent } from "./battle-log";

export interface Fighter {
  pokemon: Named;
  pokemonId: number;
  hpPercent: number;
  fainted: boolean;
}

/** The Pokémon on the field; null before a side sends one out. */
export type Scene = Record<BattleSide, Fighter | null>;

export const EMPTY_SCENE: Scene = { player: null, opponent: null };

/** Animation of the Pokémon on `side` during a step. */
export interface Cue {
  side: BattleSide;
  kind: "enter" | "attack" | "hit" | "faint";
}

export interface PlaybackStep {
  text: string;
  scene: Scene;
  cue: Cue | null;
}

function names({ identifier, nameFr, nameEn }: Named): Named {
  return { identifier, nameFr, nameEn };
}

export function sceneOf(view: BattleView): Scene {
  const player = view.player.team[view.player.active];
  const opponent = view.opponent.active;
  return {
    player:
      player === undefined
        ? null
        : {
            pokemon: names(player),
            pokemonId: player.pokemonId,
            // Rounded up like the engine's, so it only reaches 0 on a faint.
            hpPercent: Math.ceil((player.hp / player.stats.hp) * 100),
            fainted: player.hp === 0,
          },
    opponent: {
      pokemon: names(opponent),
      pokemonId: opponent.pokemonId,
      hpPercent: opponent.hpPercent,
      fainted: opponent.hpPercent === 0,
    },
  };
}

function withFighter(
  scene: Scene,
  side: BattleSide,
  update: Partial<Fighter>,
): Scene {
  const fighter = scene[side];
  return fighter === null
    ? scene
    : { ...scene, [side]: { ...fighter, ...update } };
}

function applyEvent(
  scene: Scene,
  event: BattleEvent,
): { scene: Scene; cue: Cue | null } {
  switch (event.type) {
    case "switch":
      return {
        scene: {
          ...scene,
          [event.side]: {
            pokemon: event.pokemon,
            pokemonId: event.pokemonId,
            hpPercent: event.hpPercent,
            fainted: false,
          },
        },
        cue: { side: event.side, kind: "enter" },
      };
    case "move":
      return { scene, cue: { side: event.side, kind: "attack" } };
    case "damage":
    case "recoil":
      return {
        scene: withFighter(scene, event.side, { hpPercent: event.hpPercent }),
        cue: { side: event.side, kind: "hit" },
      };
    case "faint":
      return {
        scene: withFighter(scene, event.side, { hpPercent: 0, fainted: true }),
        cue: { side: event.side, kind: "faint" },
      };
    default:
      return { scene, cue: null };
  }
}

/** One step per message; the turn headers only belong to the log. */
export function playbackSteps(
  from: Scene,
  events: BattleEvent[],
): PlaybackStep[] {
  const steps: PlaybackStep[] = [];
  let scene = from;
  for (const event of events) {
    if (event.type === "turn-start") {
      continue;
    }
    const applied = applyEvent(scene, event);
    scene = applied.scene;
    steps.push({ text: describeEvent(event), scene, cue: applied.cue });
  }
  return steps;
}

export interface Playback {
  /** The view the screen catches up to. */
  latest: BattleView;
  /** The view before `steps`, shown by the team panels while they play. */
  previous: BattleView;
  steps: PlaybackStep[];
  /** Step on screen; `steps.length` once they have all been shown. */
  index: number;
}

/**
 * A new battle opens with its Pokémon being sent out; one under way (the
 * page was reloaded) shows its current state without replaying anything.
 */
export function startPlayback(battle: BattleView): Playback {
  return {
    latest: battle,
    previous: battle,
    steps: battle.turn === 0 ? playbackSteps(EMPTY_SCENE, battle.log) : [],
    index: 0,
  };
}

/** Queues the events `battle` adds to the log of the latest view. */
export function receiveView(playback: Playback, battle: BattleView): Playback {
  const known = playback.latest.log.length;
  if (battle.log.length <= known) {
    return { ...playback, latest: battle };
  }
  return {
    latest: battle,
    previous: playback.latest,
    steps: playbackSteps(sceneOf(playback.latest), battle.log.slice(known)),
    index: 0,
  };
}

export function advancePlayback(playback: Playback): Playback {
  return isPlaying(playback)
    ? { ...playback, index: playback.index + 1 }
    : playback;
}

export function isPlaying(playback: Playback): boolean {
  return playback.index < playback.steps.length;
}

export function currentStep(playback: Playback): PlaybackStep | undefined {
  return playback.steps[playback.index];
}

export function shownScene(playback: Playback): Scene {
  return currentStep(playback)?.scene ?? sceneOf(playback.latest);
}
