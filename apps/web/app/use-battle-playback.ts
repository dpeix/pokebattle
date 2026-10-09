import type { BattleView } from "@pokebattle/shared";
import { useEffect, useState } from "react";
import {
  advancePlayback,
  isPlaying,
  receiveView,
  startPlayback,
} from "~/battle-scene";

/** Time each message stays on screen, as the games pace their texts. */
export const STEP_MS = 1200;

/**
 * Plays the events each new view of the battle brings, one message every
 * `STEP_MS`; `skip` shows the next message right away.
 */
export function useBattlePlayback(battle: BattleView) {
  const [playback, setPlayback] = useState(() => startPlayback(battle));
  // A new view from the loader: queue its events during the render, as
  // React recommends for state derived from props.
  if (playback.latest !== battle) {
    setPlayback(receiveView(playback, battle));
  }

  useEffect(() => {
    if (!isPlaying(playback)) {
      return;
    }
    const timer = setTimeout(() => setPlayback(advancePlayback), STEP_MS);
    return () => clearTimeout(timer);
  }, [playback]);

  return { playback, skip: () => setPlayback(advancePlayback) };
}
