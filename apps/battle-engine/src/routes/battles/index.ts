import type {
  BattleAction,
  BattleView,
  CreateBattleRequest,
} from "@pokebattle/shared";
import type { FastifyInstance } from "fastify";
import { BattleRuleError } from "../../battle/engine.js";
import { sendError } from "../../http.js";
import {
  battleActionBodySchema,
  battleIdParamsSchema,
  battleViewSchema,
  createBattleBodySchema,
  invalidTeamSchema,
} from "../../schemas/battle.js";
import { errorSchema } from "../../schemas/common.js";
import {
  BattleConflictError,
  BattleNotFoundError,
  createBattle,
  getBattle,
  playAction,
} from "../../services/battles.js";

/** Battles of the player's team against a bot with a random team. */
export default async function battleRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post<{ Body: CreateBattleRequest; Reply: BattleView }>(
    "/",
    {
      schema: {
        body: createBattleBodySchema,
        response: { 201: battleViewSchema, 400: invalidTeamSchema },
      },
    },
    async (request, reply) => {
      const created = await createBattle(app.db, request.body.team);
      if ("issues" in created) {
        return sendError(reply, 400, "The team is not valid", {
          issues: created.issues,
        });
      }
      return reply.code(201).send(created.view);
    },
  );

  app.get<{ Params: { id: string }; Reply: BattleView }>(
    "/:id",
    {
      schema: {
        params: battleIdParamsSchema,
        response: { 200: battleViewSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const view = await getBattle(app.db, request.params.id);
      return view ?? sendError(reply, 404, "Battle not found");
    },
  );

  app.post<{ Params: { id: string }; Body: BattleAction; Reply: BattleView }>(
    "/:id/actions",
    {
      schema: {
        params: battleIdParamsSchema,
        body: battleActionBodySchema,
        response: {
          200: battleViewSchema,
          400: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await playAction(app.db, request.params.id, request.body);
      } catch (error) {
        if (error instanceof BattleNotFoundError) {
          return sendError(reply, 404, "Battle not found");
        }
        if (error instanceof BattleConflictError) {
          return sendError(reply, 409, "The battle was updated meanwhile");
        }
        if (error instanceof BattleRuleError) {
          return sendError(
            reply,
            error.code === "battle-finished" ? 409 : 400,
            error.message,
          );
        }
        throw error;
      }
    },
  );
}
