import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Returns the content of a PokeAPI CSV file, by name without extension. */
export type CsvSource = (file: string) => Promise<string>;

// PokeAPI commit the import reads its CSV files from (master on 2026-10-07).
// Pinned so that an import is reproducible; bump it to get newer data.
export const POKEAPI_REF = "2fe95532d27a9bf340575253aff50868319d8182";

// pokemon_moves.csv weighs about 10 MB.
const DOWNLOAD_TIMEOUT_MS = 120_000;

/** Downloads the CSV files from the PokeAPI GitHub repository. */
export function githubSource(ref = POKEAPI_REF): CsvSource {
  return async (file) => {
    const url = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${ref}/data/v2/csv/${file}.csv`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to download ${url}: HTTP ${response.status} ${response.statusText}`,
      );
    }
    return response.text();
  };
}

/** Reads the CSV files from a local directory, such as a PokeAPI checkout's data/v2/csv. */
export function directorySource(directory: string): CsvSource {
  return (file) => readFile(join(directory, `${file}.csv`), "utf8");
}
