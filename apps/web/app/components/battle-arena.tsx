import type { BattleSide } from "@pokebattle/shared";
import { displayName } from "~/battle-log";
import type { Cue, Fighter, Scene } from "~/battle-scene";
import { HpBar } from "~/components/pokemon";
import { PokemonSprite } from "~/components/sprite";

// Every Pokémon fights at level 50 (battle engine, stats.ts).
const LEVEL = 50;

const CUE_ANIMATIONS: Record<BattleSide, Record<Cue["kind"], string>> = {
  player: {
    enter: "motion-safe:animate-battle-enter",
    attack: "motion-safe:animate-battle-attack-player",
    hit: "motion-safe:animate-battle-hit",
    faint: "motion-safe:animate-battle-faint",
  },
  opponent: {
    enter: "motion-safe:animate-battle-enter",
    attack: "motion-safe:animate-battle-attack-opponent",
    hit: "motion-safe:animate-battle-hit",
    faint: "motion-safe:animate-battle-faint",
  },
};

/** The field as in the games: the opponent at the back, the player in front. */
export function BattleArena({
  scene,
  cue,
  step,
  playerHp,
}: {
  scene: Scene;
  cue: Cue | null;
  /** Number of the step on screen, to replay an animation on every step. */
  step: number;
  playerHp: { hp: number; max: number } | null;
}) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-lg border-4 border-gray-800 bg-gradient-to-b from-sky-300 via-sky-100 to-lime-200 sm:aspect-[16/10] dark:border-gray-600 dark:from-sky-950 dark:via-slate-800 dark:to-emerald-950">
      <div className="absolute top-[40%] right-[4%] h-[12%] w-[42%] rounded-[50%] bg-lime-700/30 dark:bg-emerald-400/15" />
      <div className="absolute bottom-[3%] left-[1%] h-[14%] w-[50%] rounded-[50%] bg-lime-700/30 dark:bg-emerald-400/15" />

      <FighterSprite
        side="opponent"
        fighter={scene.opponent}
        cue={cue}
        step={step}
        className="top-[6%] right-[8%] h-[42%] w-[34%]"
      />
      <FighterSprite
        side="player"
        fighter={scene.player}
        cue={cue}
        step={step}
        className="bottom-[6%] left-[6%] h-[50%] w-[40%]"
      />

      {scene.opponent !== null && (
        <InfoBox
          // A new box per Pokémon: its HP bar must not slide from the
          // previous Pokémon's HP.
          key={scene.opponent.pokemonId}
          fighter={scene.opponent}
          hp={null}
          className="top-[5%] left-[3%]"
        />
      )}
      {scene.player !== null && (
        <InfoBox
          key={scene.player.pokemonId}
          fighter={scene.player}
          hp={playerHp}
          className="right-[3%] bottom-[5%]"
        />
      )}
    </div>
  );
}

function FighterSprite({
  side,
  fighter,
  cue,
  step,
  className,
}: {
  side: BattleSide;
  fighter: Fighter | null;
  cue: Cue | null;
  step: number;
  className: string;
}) {
  const animation = cue?.side === side ? CUE_ANIMATIONS[side][cue.kind] : "";
  // A fainted Pokémon stays on the field only for its fainting animation.
  if (fighter === null || (fighter.fainted && cue?.kind !== "faint")) {
    return null;
  }
  return (
    <div className={`absolute flex items-end justify-center ${className}`}>
      <div
        // A new key restarts the animation, even the same one twice in a row.
        key={animation === "" ? "still" : step}
        className={`flex h-full w-full items-end justify-center ${animation}`}
      >
        <PokemonSprite
          pokemonId={fighter.pokemonId}
          view={side === "player" ? "back" : "front"}
          className={
            side === "player"
              ? "max-h-full [zoom:1.4] sm:[zoom:2.2]"
              : "max-h-full [zoom:1.2] sm:[zoom:1.8]"
          }
        />
      </div>
    </div>
  );
}

function InfoBox({
  fighter,
  hp,
  className,
}: {
  fighter: Fighter;
  hp: { hp: number; max: number } | null;
  className: string;
}) {
  return (
    <div
      className={`absolute w-[46%] rounded-lg border-2 border-gray-800 bg-amber-50/95 px-2 py-1 text-gray-900 shadow-md sm:px-3 sm:py-1.5 dark:border-gray-600 dark:bg-gray-900/95 dark:text-gray-100 ${className}`}
    >
      <div className="flex items-baseline justify-between gap-2 text-xs font-semibold sm:text-sm">
        <span className="truncate">{displayName(fighter.pokemon)}</span>
        <span className="shrink-0">N.{LEVEL}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1">
        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
          PV
        </span>
        <HpBar percent={fighter.hpPercent} />
      </div>
      {hp !== null && (
        <p className="text-right text-xs tabular-nums">
          {hp.hp}/{hp.max}
        </p>
      )}
    </div>
  );
}
