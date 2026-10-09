import type {
  BattleAction,
  BattleEvent,
  BattlePokemonView,
  BattleView,
} from "@pokebattle/shared";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import {
  BattleEngineError,
  createBattle,
  getBattle,
  playAction,
} from "~/battle-engine.server";
import { describeEvent, displayName } from "~/battle-log";
import { currentStep, isPlaying, type Scene, shownScene } from "~/battle-scene";
import { BattleArena } from "~/components/battle-arena";
import {
  commitSession,
  getSession,
  type PokebattleSession,
} from "~/session.server";
import { useBattlePlayback } from "~/use-battle-playback";
import type { Route } from "./+types/battle";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Combat — Pokebattle" }];
}

/** The battle was purged or never existed: back to the team builder. */
async function forgetBattle(session: PokebattleSession) {
  session.unset("battleId");
  return redirect("/team", { headers: await commitSession(session) });
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  const battleId = session.get("battleId");
  if (battleId === undefined) {
    throw redirect("/team");
  }
  try {
    return { battle: await getBattle(battleId) };
  } catch (error) {
    if (error instanceof BattleEngineError && error.status === 404) {
      throw await forgetBattle(session);
    }
    throw error;
  }
}

function formAction(form: FormData): BattleAction | null {
  switch (form.get("intent")) {
    case "move":
      return { type: "move", moveId: Number(form.get("moveId")) };
    case "switch":
      return { type: "switch", slot: Number(form.get("slot")) };
    case "struggle":
      return { type: "struggle" };
    default:
      return null;
  }
}

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request);
  const form = await request.formData();

  if (form.get("intent") === "rematch") {
    const team = session.get("team");
    if (team === undefined) {
      return redirect("/team");
    }
    try {
      const battle = await createBattle(team);
      session.set("battleId", battle.id);
      return redirect("/battle", { headers: await commitSession(session) });
    } catch (error) {
      // The team no longer passes (e.g. after a new PokeAPI import): the
      // player edits it, and submitting it shows what is refused.
      if (error instanceof BattleEngineError && error.status === 400) {
        return redirect("/team");
      }
      throw error;
    }
  }

  const battleId = session.get("battleId");
  const battleAction = formAction(form);
  if (battleId === undefined) {
    return redirect("/team");
  }
  if (battleAction === null) {
    return data({ error: "Action inconnue." }, { status: 400 });
  }
  try {
    await playAction(battleId, battleAction);
    return null;
  } catch (error) {
    if (!(error instanceof BattleEngineError)) {
      throw error;
    }
    if (error.status === 404) {
      return forgetBattle(session);
    }
    if (error.status === 409) {
      return data(
        { error: "Le combat a changé entre-temps : l'écran est à jour." },
        { status: 409 },
      );
    }
    if (error.status === 400) {
      return data(
        { error: "Cette action n'est pas possible." },
        { status: 400 },
      );
    }
    throw error;
  }
}

export default function Battle({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  // A rematch is a new battle: its screen starts over, with its opening.
  return (
    <BattleScreen
      key={loaderData.battle.id}
      battle={loaderData.battle}
      error={actionData?.error}
    />
  );
}

function BattleScreen({
  battle,
  error,
}: {
  battle: BattleView;
  error: string | undefined;
}) {
  const { playback, skip } = useBattlePlayback(battle);
  const playing = isPlaying(playback);
  const step = currentStep(playback);
  const scene = shownScene(playback);
  const busy = useNavigation().state !== "idle";

  return (
    <main className="container mx-auto max-w-3xl p-4 pt-8">
      <div className="flex items-center justify-between">
        <Link to="/team" className="text-sm text-blue-600 hover:underline">
          ← Mon équipe
        </Link>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {battle.turn === 0 ? "Début du combat" : `Tour ${battle.turn}`}
        </span>
      </div>

      <section className="mt-4" aria-label="Terrain">
        <BattleArena
          scene={scene}
          cue={step?.cue ?? null}
          step={playback.index}
          playerHp={playerHp(battle, scene, playing)}
        />
      </section>

      {error !== undefined && !playing && (
        <p className="mt-4 rounded bg-red-100 p-3 text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <section className="mt-4">
        {step === undefined ? (
          <Commands battle={battle} busy={busy} />
        ) : (
          <button
            type="button"
            onClick={skip}
            className="flex min-h-24 w-full items-start justify-between gap-4 rounded-lg border-4 border-gray-800 bg-white p-4 text-left text-lg dark:border-gray-600 dark:bg-gray-900"
          >
            <span aria-live="polite">{step.text}</span>
            <span
              aria-hidden="true"
              className="self-end text-sm text-red-500 motion-safe:animate-bounce"
            >
              ▼
            </span>
            <span className="sr-only">Message suivant</span>
          </button>
        )}
      </section>

      <details className="mt-6">
        <summary className="cursor-pointer font-semibold">
          Journal du combat
        </summary>
        <BattleLog log={battle.log} />
      </details>
    </main>
  );
}

/**
 * The player's HP in numbers: exact once the messages are shown; while
 * they play, worked out from the percentage the events give.
 */
function playerHp(
  battle: BattleView,
  scene: Scene,
  playing: boolean,
): { hp: number; max: number } | null {
  const fighter = scene.player;
  // Pokémon of the same species have the same stats (level 50, same IVs).
  const member = battle.player.team.find(
    (candidate) => candidate.pokemonId === fighter?.pokemonId,
  );
  if (fighter === null || member === undefined) {
    return null;
  }
  const max = member.stats.hp;
  if (!playing) {
    return { hp: battle.player.team[battle.player.active]?.hp ?? 0, max };
  }
  return { hp: Math.ceil((max * fighter.hpPercent) / 100), max };
}

function ActionButton({
  intent,
  name,
  value,
  disabled,
  children,
}: {
  intent: string;
  name?: string;
  value?: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value={intent} />
      <button
        type="submit"
        name={name}
        value={value}
        disabled={disabled}
        className="w-full rounded border border-gray-300 px-3 py-2 text-left hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
      >
        {children}
      </button>
    </Form>
  );
}

function Bench({ battle, busy }: { battle: BattleView; busy: boolean }) {
  const bench = battle.player.team.filter(
    (member) => member.slot !== battle.player.active,
  );
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {bench.map((member: BattlePokemonView) => (
        <ActionButton
          key={member.slot}
          intent="switch"
          name="slot"
          value={member.slot}
          disabled={busy || member.hp === 0}
        >
          <span className="font-medium">{displayName(member)}</span>{" "}
          <span className="text-xs text-gray-500">
            {member.hp === 0 ? "K.O." : `${member.hp}/${member.stats.hp} PV`}
          </span>
        </ActionButton>
      ))}
    </div>
  );
}

function Commands({ battle, busy }: { battle: BattleView; busy: boolean }) {
  if (battle.phase === "finished") {
    return (
      <div className="rounded bg-gray-100 p-4 dark:bg-gray-900">
        <p className="text-lg font-semibold">
          {battle.winner === "player"
            ? "Victoire !"
            : battle.winner === "opponent"
              ? "Défaite…"
              : "Match nul !"}
        </p>
        <div className="mt-3 flex gap-3">
          <Form method="post">
            <input type="hidden" name="intent" value="rematch" />
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Rejouer avec cette équipe
            </button>
          </Form>
          <Link
            to="/team"
            className="rounded border border-blue-600 px-4 py-2 font-medium text-blue-600"
          >
            Modifier l'équipe
          </Link>
        </div>
      </div>
    );
  }

  if (battle.phase === "choose-switch") {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border-4 border-gray-800 bg-white p-4 text-lg dark:border-gray-600 dark:bg-gray-900">
          Choisissez le Pokémon à envoyer.
        </p>
        <Bench battle={battle} busy={busy} />
      </div>
    );
  }

  const active = battle.player.team[battle.player.active];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-lg border-4 border-gray-800 bg-white p-4 sm:grid-cols-[1fr_2fr] dark:border-gray-600 dark:bg-gray-900">
        <p className="text-lg">
          Que doit faire {active === undefined ? "" : displayName(active)} ?
        </p>
        {battle.player.mustStruggle ? (
          <ActionButton intent="struggle" disabled={busy}>
            Lutte <span className="text-xs text-gray-500">(plus de PP)</span>
          </ActionButton>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {active?.moves.map((move) => (
              <ActionButton
                key={move.id}
                intent="move"
                name="moveId"
                value={move.id}
                disabled={busy || move.pp === 0}
              >
                <span className="block font-medium">{displayName(move)}</span>
                <span className="text-xs text-gray-500">
                  {displayName(move.type)} · {move.power} · {move.pp}/
                  {move.maxPp} PP
                </span>
              </ActionButton>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="mb-2 font-semibold">Changer de Pokémon</h3>
        <Bench battle={battle} busy={busy} />
      </div>
    </div>
  );
}

/** The log split by turn, latest turn first. */
function turnsOf(log: BattleEvent[]): BattleEvent[][] {
  const turns: BattleEvent[][] = [[]];
  for (const event of log) {
    if (event.type === "turn-start") {
      turns.push([]);
    }
    turns.at(-1)?.push(event);
  }
  return turns.filter((turn) => turn.length > 0).reverse();
}

function BattleLog({ log }: { log: BattleEvent[] }) {
  return (
    <section className="mt-2">
      <ol className="max-h-80 space-y-3 overflow-y-auto rounded border border-gray-300 p-3 text-sm dark:border-gray-700">
        {turnsOf(log).map((turn, index) => (
          <li
            key={turn[0]?.type === "turn-start" ? turn[0].turn : 0}
            className={index === 0 ? "" : "text-gray-500"}
          >
            {turn.map((event, at) => (
              <p
                // biome-ignore lint/suspicious/noArrayIndexKey: append-only log
                key={at}
                className={event.type === "turn-start" ? "font-semibold" : ""}
              >
                {describeEvent(event)}
              </p>
            ))}
          </li>
        ))}
      </ol>
    </section>
  );
}
