// Client of the battle engine API (BFF: the browser never calls it).
import type {
  BattleAction,
  BattleView,
  PokemonDetail,
  PokemonSummary,
  TeamMemberInput,
} from "@pokebattle/shared";
import { requireEnv } from "./env.server";

/** A non-2xx reply of the battle engine, with its JSON body when it has one. */
export class BattleEngineError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`battle engine replied ${status}`);
    this.name = "BattleEngineError";
  }
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(new URL(path, requireEnv("BATTLE_ENGINE_URL")), {
    method: init.method ?? "GET",
    headers:
      init.body === undefined
        ? { accept: "application/json" }
        : { accept: "application/json", "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    throw new BattleEngineError(
      response.status,
      await response.json().catch(() => null),
    );
  }
  return (await response.json()) as T;
}

export function listPokemon(): Promise<PokemonSummary[]> {
  return request("/pokemon");
}

export function getPokemon(id: number): Promise<PokemonDetail> {
  return request(`/pokemon/${id}`);
}

export function createBattle(team: TeamMemberInput[]): Promise<BattleView> {
  return request("/battles", { method: "POST", body: { team } });
}

export function getBattle(id: string): Promise<BattleView> {
  return request(`/battles/${encodeURIComponent(id)}`);
}

export function playAction(
  id: string,
  action: BattleAction,
): Promise<BattleView> {
  return request(`/battles/${encodeURIComponent(id)}/actions`, {
    method: "POST",
    body: action,
  });
}
