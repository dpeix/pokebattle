// Downloads the sprites of the selectable Pokémon into public/sprites, served
// by the web app: `pnpm sprites:sync` (`make sprites`), with the battle
// engine running and its PokeAPI data imported. Files already there are
// kept, so it can run again to fetch only what is missing.
import { existsSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

// PokeAPI/sprites commit the sprites are read from (master on 2026-10-09).
// Pinned so that the sprites do not change unnoticed; bump it to get new ones.
const SPRITES_REF = "35fdbe9bdec8f519f882c3edc3c0185f08af4d86";
const BASE_URL = `https://raw.githubusercontent.com/PokeAPI/sprites/${SPRITES_REF}/sprites/pokemon`;
const OUT_DIR = "public/sprites";
const CONCURRENCY = 8;
const TIMEOUT_MS = 30_000;

type View = "front" | "back";

// Animated Showdown sprites first, the still ones when a Pokémon has none.
const SOURCES: Record<View, (id: number) => { path: string; ext: string }[]> = {
  front: (id) => [
    { path: `other/showdown/${id}.gif`, ext: "gif" },
    { path: `${id}.png`, ext: "png" },
  ],
  back: (id) => [
    { path: `other/showdown/back/${id}.gif`, ext: "gif" },
    { path: `back/${id}.png`, ext: "png" },
  ],
};

async function selectableIds(): Promise<number[]> {
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  }
  const engineUrl = process.env.BATTLE_ENGINE_URL;
  if (!engineUrl) {
    throw new Error("Missing BATTLE_ENGINE_URL (see .env.example in apps/web)");
  }
  const response = await fetch(new URL("/pokemon", engineUrl), {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GET /pokemon failed: HTTP ${response.status}`);
  }
  const pokemon = (await response.json()) as { id: number }[];
  return pokemon.map(({ id }) => id);
}

type Outcome = "downloaded" | "kept" | "missing";

async function syncSprite(id: number, view: View): Promise<Outcome> {
  const sources = SOURCES[view](id);
  const target = (ext: string) => join(OUT_DIR, view, `${id}.${ext}`);
  if (sources.some(({ ext }) => existsSync(target(ext)))) {
    return "kept";
  }
  for (const { path, ext } of sources) {
    const url = `${BASE_URL}/${path}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 404) {
      continue;
    }
    if (!response.ok) {
      throw new Error(`${url}: HTTP ${response.status}`);
    }
    // Written aside then renamed: an interrupted run leaves no partial
    // file that the next run would keep.
    const file = target(ext);
    await writeFile(`${file}.part`, Buffer.from(await response.arrayBuffer()));
    await rename(`${file}.part`, file);
    return "downloaded";
  }
  return "missing";
}

async function main() {
  const ids = await selectableIds();
  await Promise.all(
    (["front", "back"] as const).map((view) =>
      mkdir(join(OUT_DIR, view), { recursive: true }),
    ),
  );
  const queue = ids.flatMap((id) =>
    (["front", "back"] as const).map((view) => ({ id, view })),
  );
  const counts: Record<Outcome, number> = {
    downloaded: 0,
    kept: 0,
    missing: 0,
  };
  const missing: string[] = [];
  const failures: string[] = [];

  async function worker() {
    for (let job = queue.shift(); job !== undefined; job = queue.shift()) {
      try {
        const outcome = await syncSprite(job.id, job.view);
        counts[outcome] += 1;
        if (outcome === "missing") {
          missing.push(`${job.view}/${job.id}`);
        }
      } catch (error) {
        failures.push(`${job.view}/${job.id}: ${(error as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(
    `Sprites of ${ids.length} Pokémon: ${counts.downloaded} downloaded, ${counts.kept} already there, ${counts.missing} not in PokeAPI.`,
  );
  if (missing.length > 0) {
    console.log(`Not in PokeAPI: ${missing.join(", ")}`);
  }
  if (failures.length > 0) {
    console.error(`Failed (run again to retry):\n${failures.join("\n")}`);
    process.exitCode = 1;
  }
}

await main();
