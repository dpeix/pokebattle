import { type KeyboardEvent, useId, useState } from "react";
import { searchPokemon } from "~/search";

const MAX_SUGGESTIONS = 10;

/** Search field that suggests Pokémon by name or number (ARIA combobox). */
export function PokemonSearch({
  pokemon,
  disabled,
  onSelect,
}: {
  pokemon: { id: number; name: string }[];
  disabled: boolean;
  onSelect: (pokemonId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const results = searchPokemon(pokemon, query, MAX_SUGGESTIONS);
  const expanded = open && results.length > 0;

  function select(pokemonId: number) {
    onSelect(pokemonId);
    // Cleared but still focused, to add the next Pokémon right away.
    setQuery("");
    setActive(0);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setOpen(true);
        setActive((current) =>
          Math.max(0, Math.min(current + 1, results.length - 1)),
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((current) => Math.max(current - 1, 0));
        break;
      case "Enter": {
        // The field sits in the team form: Enter must not submit it.
        event.preventDefault();
        const choice = expanded ? results[active] : undefined;
        if (choice !== undefined) {
          select(choice.id);
        }
        break;
      }
      case "Escape":
        setOpen(false);
        break;
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-label="Ajouter un Pokémon"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={
          disabled ? "Équipe complète" : "Ajouter un Pokémon (nom ou numéro)…"
        }
        disabled={disabled}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        className="w-full rounded border border-gray-300 bg-white p-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
      />
      <div
        id={listId}
        role="listbox"
        aria-label="Pokémon trouvés"
        hidden={!expanded}
        className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-gray-300 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
      >
        {results.map((entry, index) => (
          <div
            key={entry.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            // Focus stays in the field, which points here with aria-activedescendant.
            tabIndex={-1}
            // mousedown, not click: the field keeps the focus.
            onMouseDown={(event) => {
              event.preventDefault();
              select(entry.id);
            }}
            onMouseEnter={() => setActive(index)}
            className={`cursor-pointer px-3 py-1.5 ${
              index === active ? "bg-blue-600 text-white" : ""
            }`}
          >
            <span
              className={
                index === active
                  ? "text-blue-100"
                  : "text-gray-500 dark:text-gray-400"
              }
            >
              #{entry.id}
            </span>{" "}
            {entry.name}
          </div>
        ))}
      </div>
      {open && query.trim() !== "" && results.length === 0 && (
        <p className="absolute z-10 mt-1 w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-gray-500 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          Aucun Pokémon trouvé
        </p>
      )}
    </div>
  );
}
