import type { PokemonDetail, PokemonSummary } from "@pokebattle/shared";
import type { FastifyInstance } from "fastify";
import {
  findPokemonDetail,
  listSelectablePokemon,
} from "../../data/catalog.js";
import { sendError } from "../../http.js";
import { errorSchema, idParamsSchema } from "../../schemas/common.js";
import {
  pokemonDetailSchema,
  pokemonSummaryListSchema,
} from "../../schemas/pokemon.js";

/** The Pokémon a team may use, and their moves. */
export default async function pokemonRoutes(
  app: FastifyInstance,
): Promise<void> {
  // About a thousand rows of reference data: no pagination needed.
  app.get<{ Reply: PokemonSummary[] }>(
    "/",
    { schema: { response: { 200: pokemonSummaryListSchema } } },
    async () => listSelectablePokemon(app.db),
  );

  app.get<{ Params: { id: number }; Reply: PokemonDetail }>(
    "/:id",
    {
      schema: {
        params: idParamsSchema,
        response: { 200: pokemonDetailSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const detail = await findPokemonDetail(app.db, request.params.id);
      return detail ?? sendError(reply, 404, "Pokémon not found");
    },
  );
}
