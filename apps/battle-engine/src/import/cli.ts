// Imports the PokeAPI battle data into the battle engine database:
//   pnpm db:import             downloads the CSV files of the pinned PokeAPI commit
//   pnpm db:import --dir <dir> reads them from a local directory instead
import { parseArgs } from "node:util";
import { createDb } from "../db/client.js";
import { loadDotEnv, requireEnv } from "../env.js";
import { importPokeapi } from "./pokeapi.js";
import { directorySource, githubSource, POKEAPI_REF } from "./source.js";

loadDotEnv();

const { values } = parseArgs({ options: { dir: { type: "string" } } });
const source = values.dir
  ? directorySource(values.dir)
  : githubSource(POKEAPI_REF);
console.log(
  values.dir
    ? `Importing PokeAPI CSV files from ${values.dir}`
    : `Importing PokeAPI CSV files of commit ${POKEAPI_REF}`,
);

const db = createDb(requireEnv("DATABASE_URL"));
try {
  const started = performance.now();
  const counts = await importPokeapi(db, source);
  console.table(counts);
  console.log(
    `Import done in ${((performance.now() - started) / 1000).toFixed(1)} s`,
  );
} catch (error) {
  console.error("Import failed, the database is unchanged:", error);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
