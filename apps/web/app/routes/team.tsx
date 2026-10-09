import {
  type InvalidTeamResponse,
  MAX_MOVES_PER_POKEMON,
  TEAM_SIZE,
  type TeamIssue,
  type TeamMemberInput,
} from "@pokebattle/shared";
import { useEffect, useState } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  useFetcher,
  useNavigation,
} from "react-router";
import {
  BattleEngineError,
  createBattle,
  listPokemon,
} from "~/battle-engine.server";
import { displayName } from "~/battle-log";
import { TypeList } from "~/components/pokemon";
import { commitSession, getSession } from "~/session.server";
import type { Route } from "./+types/team";
import type { loader as pokemonLoader } from "./team.pokemon.$id";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Mon équipe — Pokebattle" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const [pokemon, session] = await Promise.all([
    listPokemon(),
    getSession(request),
  ]);
  return {
    // Only what the selects show: the full list weighs ~300 kB.
    pokemon: pokemon.map((entry) => ({
      id: entry.id,
      name: displayName(entry),
    })),
    team: session.get("team") ?? null,
  };
}

/** The battle engine checks the team: this only decodes the form field. */
function parseTeam(value: FormDataEntryValue | null): TeamMemberInput[] | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const team: unknown = JSON.parse(value);
    return Array.isArray(team) ? (team as TeamMemberInput[]) : null;
  } catch {
    return null;
  }
}

function isInvalidTeamResponse(body: unknown): body is InvalidTeamResponse {
  return (
    typeof body === "object" &&
    body !== null &&
    Array.isArray((body as { issues?: unknown }).issues)
  );
}

export async function action({ request }: Route.ActionArgs) {
  const team = parseTeam((await request.formData()).get("team"));
  if (team === null) {
    return data({ issues: [] as TeamIssue[] }, { status: 400 });
  }
  try {
    const battle = await createBattle(team);
    const session = await getSession(request);
    session.set("team", team);
    session.set("battleId", battle.id);
    return redirect("/battle", { headers: await commitSession(session) });
  } catch (error) {
    if (error instanceof BattleEngineError && error.status === 400) {
      const issues = isInvalidTeamResponse(error.body) ? error.body.issues : [];
      return data({ issues }, { status: 400 });
    }
    throw error;
  }
}

interface Slot {
  pokemonId: number | null;
  moveIds: number[];
}

function initialSlots(team: TeamMemberInput[] | null): Slot[] {
  return Array.from(
    { length: TEAM_SIZE },
    (_, index) => team?.[index] ?? { pokemonId: null, moveIds: [] },
  );
}

function issueText(issue: TeamIssue): string {
  return issue.reason === "pokemon-not-allowed"
    ? "Ce Pokémon n'est pas autorisé."
    : "Une des attaques choisies n'est pas autorisée pour ce Pokémon.";
}

export default function Team({ loaderData, actionData }: Route.ComponentProps) {
  const [slots, setSlots] = useState(() => initialSlots(loaderData.team));
  const navigation = useNavigation();
  const complete = slots.every(
    (slot) => slot.pokemonId !== null && slot.moveIds.length > 0,
  );
  const issues = actionData?.issues;

  function updateSlot(index: number, slot: Slot) {
    setSlots((current) =>
      current.map((existing, at) => (at === index ? slot : existing)),
    );
  }

  return (
    <main className="container mx-auto p-4 pt-8">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        ← Accueil
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Mon équipe</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Choisissez {TEAM_SIZE} Pokémon et jusqu'à {MAX_MOVES_PER_POKEMON}{" "}
        attaques chacun, puis affrontez un adversaire à l'équipe aléatoire. Tous
        les Pokémon combattent au niveau 50.
      </p>

      <Form method="post" className="mt-6">
        <input type="hidden" name="team" value={JSON.stringify(slots)} />
        {issues !== undefined && issues.length === 0 && (
          <p className="mb-4 rounded bg-red-100 p-3 text-red-800 dark:bg-red-950 dark:text-red-200">
            L'équipe doit compter {TEAM_SIZE} Pokémon, avec 1 à{" "}
            {MAX_MOVES_PER_POKEMON} attaques différentes chacun.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot, index) => (
            <SlotEditor
              // Slots never move: the index is a stable key.
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots
              key={index}
              index={index}
              slot={slot}
              pokemon={loaderData.pokemon}
              issues={issues?.filter((issue) => issue.slot === index) ?? []}
              onChange={(next) => updateSlot(index, next)}
            />
          ))}
        </div>
        <button
          type="submit"
          disabled={!complete || navigation.state !== "idle"}
          className="mt-6 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {navigation.state === "submitting" ? "Préparation…" : "Combattre"}
        </button>
      </Form>
    </main>
  );
}

function SlotEditor({
  index,
  slot,
  pokemon,
  issues,
  onChange,
}: {
  index: number;
  slot: Slot;
  pokemon: { id: number; name: string }[];
  issues: TeamIssue[];
  onChange: (slot: Slot) => void;
}) {
  const fetcher = useFetcher<typeof pokemonLoader>();
  const { load } = fetcher;
  useEffect(() => {
    if (slot.pokemonId !== null) {
      load(`/team/pokemon/${slot.pokemonId}`);
    }
  }, [slot.pokemonId, load]);
  const detail = fetcher.data?.id === slot.pokemonId ? fetcher.data : undefined;

  function toggleMove(moveId: number) {
    onChange({
      ...slot,
      moveIds: slot.moveIds.includes(moveId)
        ? slot.moveIds.filter((id) => id !== moveId)
        : [...slot.moveIds, moveId],
    });
  }

  return (
    <fieldset className="rounded border border-gray-300 p-3 dark:border-gray-700">
      <legend className="px-1 text-sm font-medium">Pokémon {index + 1}</legend>
      <select
        aria-label={`Pokémon ${index + 1}`}
        value={slot.pokemonId ?? ""}
        onChange={(event) =>
          onChange({
            pokemonId:
              event.target.value === "" ? null : Number(event.target.value),
            moveIds: [],
          })
        }
        className="w-full rounded border border-gray-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
      >
        <option value="">— Choisir —</option>
        {pokemon.map((entry) => (
          <option key={entry.id} value={entry.id}>
            #{entry.id} {entry.name}
          </option>
        ))}
      </select>

      {detail !== undefined && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-sm">
            <TypeList types={detail.types} />
            <span className="text-gray-600 dark:text-gray-400">
              {slot.moveIds.length}/{MAX_MOVES_PER_POKEMON} attaques
            </span>
          </div>
          <ul className="mt-2 max-h-48 overflow-y-auto text-sm">
            {detail.moves.map((move) => {
              const checked = slot.moveIds.includes(move.id);
              return (
                <li key={move.id}>
                  <label className="flex items-center gap-2 py-0.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={
                        !checked && slot.moveIds.length >= MAX_MOVES_PER_POKEMON
                      }
                      onChange={() => toggleMove(move.id)}
                    />
                    <span className="flex-1">{displayName(move)}</span>
                    <span className="text-xs text-gray-500">
                      {displayName(move.type)} · {move.power} · {move.pp} PP
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {slot.pokemonId !== null && detail === undefined && (
        <p className="mt-2 text-sm text-gray-500">Chargement des attaques…</p>
      )}

      {issues.map((issue) => (
        <p
          key={`${issue.reason}-${"moveId" in issue ? issue.moveId : issue.pokemonId}`}
          className="mt-2 text-sm text-red-600"
        >
          {issueText(issue)}
        </p>
      ))}
    </fieldset>
  );
}
