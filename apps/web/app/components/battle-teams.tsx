import type {
  BattlePokemonView,
  BattleStats,
  OpponentPokemonView,
} from "@pokebattle/shared";
import { useState } from "react";
import { Form } from "react-router";
import { displayName } from "~/battle-log";
import { Pokeball } from "~/components/pokeball";
import { HpBar, TypeList } from "~/components/pokemon";
import { PokemonSprite } from "~/components/sprite";

const STAT_LABELS: [keyof BattleStats, string][] = [
  ["hp", "PV"],
  ["attack", "Attaque"],
  ["defense", "Défense"],
  ["specialAttack", "Att. Spé."],
  ["specialDefense", "Déf. Spé."],
  ["speed", "Vitesse"],
];

function hpPercent(member: BattlePokemonView): number {
  return Math.ceil((member.hp / member.stats.hp) * 100);
}

/** The player's team: a click shows a Pokémon's details and lets it be sent out. */
export function PlayerTeam({
  team,
  active,
  canSwitch,
  highlight,
}: {
  team: BattlePokemonView[];
  active: number;
  /** The battle waits for an action and nothing is playing or being sent. */
  canSwitch: boolean;
  /** The active Pokémon fainted: the player must pick its replacement. */
  highlight: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const detail = team.find((member) => member.slot === selected);

  return (
    <section
      aria-label="Votre équipe"
      className={`rounded-lg border-2 p-3 ${
        highlight
          ? "border-blue-600 ring-4 ring-blue-600/30"
          : "border-gray-300 dark:border-gray-700"
      }`}
    >
      <h2 className="mb-2 font-semibold">Votre équipe</h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
        {team.map((member) => (
          <li key={member.slot}>
            <button
              type="button"
              aria-pressed={member.slot === selected}
              onClick={() =>
                setSelected(member.slot === selected ? null : member.slot)
              }
              className={`flex w-full items-center gap-2 rounded border p-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-900 ${
                member.slot === selected
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-950"
                  : "border-gray-300 dark:border-gray-700"
              } ${member.hp === 0 ? "opacity-50 grayscale" : ""}`}
            >
              <PokemonSprite
                pokemonId={member.pokemonId}
                view="front"
                className="h-10 w-10 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-1 text-sm">
                  <span className="truncate font-medium">
                    {displayName(member)}
                  </span>
                  {member.slot === active && member.hp > 0 && (
                    <span className="shrink-0 text-xs text-blue-600 dark:text-blue-400">
                      Au combat
                    </span>
                  )}
                  {member.hp === 0 && (
                    <span className="shrink-0 text-xs text-red-600">K.O.</span>
                  )}
                </span>
                <HpBar percent={hpPercent(member)} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {detail !== undefined && (
        <PokemonDetail
          member={detail}
          isActive={detail.slot === active}
          canSwitch={canSwitch}
        />
      )}
    </section>
  );
}

function PokemonDetail({
  member,
  isActive,
  canSwitch,
}: {
  member: BattlePokemonView;
  isActive: boolean;
  canSwitch: boolean;
}) {
  const fainted = member.hp === 0;
  return (
    <div className="mt-3 rounded border border-gray-300 p-3 text-sm dark:border-gray-700">
      <div className="flex items-center gap-3">
        <PokemonSprite
          pokemonId={member.pokemonId}
          view="front"
          className="h-16 w-16 shrink-0"
        />
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{displayName(member)}</h3>
          <TypeList types={member.types} />
          <p className="mt-1 tabular-nums">
            {member.hp}/{member.stats.hp} PV
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-0.5">
        {STAT_LABELS.map(([stat, label]) => (
          <div key={stat} className="flex justify-between">
            <dt className="text-gray-600 dark:text-gray-400">{label}</dt>
            <dd className="tabular-nums">{member.stats[stat]}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-3 space-y-1">
        {member.moves.map((move) => (
          <li key={move.id} className="flex justify-between gap-2">
            <span className="truncate">{displayName(move)}</span>
            <span className="shrink-0 text-xs text-gray-500">
              {displayName(move.type)} · {move.power} · {move.pp}/{move.maxPp}{" "}
              PP
            </span>
          </li>
        ))}
      </ul>

      <Form method="post" className="mt-3">
        <input type="hidden" name="intent" value="switch" />
        <button
          type="submit"
          name="slot"
          value={member.slot}
          disabled={!canSwitch || isActive || fainted}
          className="w-full rounded bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isActive ? "Déjà au combat" : fainted ? "K.O." : "Envoyer au combat"}
        </button>
      </Form>
    </div>
  );
}

/** The opponent's team: the Pokémon sent out so far, the others hidden. */
export function OpponentTeam({
  revealed,
  teamSize,
}: {
  revealed: OpponentPokemonView[];
  teamSize: number;
}) {
  const hidden = Math.max(teamSize - revealed.length, 0);
  return (
    <section
      aria-label="Équipe adverse"
      className="rounded-lg border-2 border-gray-300 p-3 dark:border-gray-700"
    >
      <h2 className="mb-2 font-semibold">Équipe adverse</h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
        {revealed.map((pokemon, index) => (
          <li
            // Revealed Pokémon keep their place: the index is stable.
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
            key={index}
            className={`flex items-center gap-2 rounded border border-gray-300 p-1.5 dark:border-gray-700 ${
              pokemon.hpPercent === 0 ? "opacity-50 grayscale" : ""
            }`}
          >
            <PokemonSprite
              pokemonId={pokemon.pokemonId}
              view="front"
              className="h-10 w-10 shrink-0"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-1 text-sm">
                <span className="truncate font-medium">
                  {displayName(pokemon)}
                </span>
                {pokemon.hpPercent === 0 && (
                  <span className="shrink-0 text-xs text-red-600">K.O.</span>
                )}
              </span>
              <HpBar percent={pokemon.hpPercent} />
            </span>
          </li>
        ))}
        {Array.from({ length: hidden }, (_, index) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: interchangeable placeholders
            key={`hidden-${index}`}
            className="flex items-center gap-2 rounded border border-dashed border-gray-300 p-1.5 dark:border-gray-700"
          >
            <Pokeball
              className="h-10 w-10 shrink-0 p-1.5"
              label="Pokémon inconnu"
            />
            <span className="text-sm text-gray-500">???</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
