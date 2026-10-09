import { parse } from "csv-parse/sync";
import type { DbClient } from "../db/client.js";
import type { ImportCounts } from "./load.js";
import { loadPokeapiData } from "./load.js";
import type { CsvSource } from "./source.js";
import {
  type CsvRow,
  POKEAPI_CSV_FILES,
  type PokeapiCsv,
  transformPokeapi,
} from "./transform.js";

function parseCsv(file: string, content: string): CsvRow[] {
  try {
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      // Some PokeAPI rows put a space between a comma and a quoted field.
      ltrim: true,
    });
  } catch (error) {
    throw new Error(`Failed to parse ${file}.csv`, { cause: error });
  }
}

/** Reads and parses every CSV file the import needs. */
export async function readPokeapiCsv(source: CsvSource): Promise<PokeapiCsv> {
  const entries = await Promise.all(
    POKEAPI_CSV_FILES.map(
      async (file) => [file, parseCsv(file, await source(file))] as const,
    ),
  );
  return Object.fromEntries(entries) as PokeapiCsv;
}

/**
 * Imports the PokeAPI battle data, replacing the previous import. Nothing is
 * written unless every file has been read and transformed successfully.
 */
export async function importPokeapi(
  db: DbClient,
  source: CsvSource,
): Promise<ImportCounts> {
  const csv = await readPokeapiCsv(source);
  return loadPokeapiData(db, transformPokeapi(csv));
}
