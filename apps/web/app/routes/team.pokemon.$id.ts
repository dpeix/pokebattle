// Resource route: the moves of a Pokémon, loaded by the team builder when
// a slot's Pokémon changes.
import { data } from "react-router";
import { BattleEngineError, getPokemon } from "~/battle-engine.server";
import type { Route } from "./+types/team.pokemon.$id";

export async function loader({ params }: Route.LoaderArgs) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) {
    throw data(null, { status: 404 });
  }
  try {
    return await getPokemon(id);
  } catch (error) {
    if (error instanceof BattleEngineError && error.status === 404) {
      throw data(null, { status: 404 });
    }
    throw error;
  }
}
