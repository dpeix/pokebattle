// Text search of the team builder, over data the page already has.

/** Players type "evoli" or "EVOLI" for "Évoli": compare without case or accents. */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** A blank query matches everything, so an empty filter hides nothing. */
export function matchesSearch(query: string, texts: string[]): boolean {
  const needle = normalizeSearch(query);
  return texts.some((text) => normalizeSearch(text).includes(needle));
}

/**
 * The Pokémon whose number is the query ("25" or "#25"), or whose name
 * contains it: names starting with it first, then in the list's order.
 */
export function searchPokemon<T extends { id: number; name: string }>(
  pokemon: T[],
  query: string,
  limit: number,
): T[] {
  const needle = normalizeSearch(query);
  if (needle === "") {
    return [];
  }
  const number = /^#?(\d+)$/.exec(needle);
  if (number !== null) {
    const id = Number(number[1]);
    return pokemon.filter((entry) => entry.id === id).slice(0, limit);
  }
  const starting: T[] = [];
  const containing: T[] = [];
  for (const entry of pokemon) {
    const name = normalizeSearch(entry.name);
    if (name.startsWith(needle)) {
      starting.push(entry);
    } else if (name.includes(needle)) {
      containing.push(entry);
    }
  }
  return [...starting, ...containing].slice(0, limit);
}
