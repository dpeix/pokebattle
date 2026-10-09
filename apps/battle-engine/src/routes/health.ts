import type { HealthResponse } from "@pokebattle/shared";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

const SERVICE_NAME = "battle-engine";

const healthResponseSchema = {
  type: "object",
  required: ["status", "service", "database"],
  properties: {
    status: { type: "string", enum: ["ok", "error"] },
    service: { type: "string" },
    database: { type: "string", enum: ["up", "down"] },
  },
} as const;

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Reply: HealthResponse }>(
    "/health",
    {
      schema: {
        response: { 200: healthResponseSchema, 503: healthResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        await app.db.execute(sql`select 1`);
        return { status: "ok", service: SERVICE_NAME, database: "up" };
      } catch (error) {
        request.log.error({ err: error }, "database health check failed");
        return reply
          .code(503)
          .send({ status: "error", service: SERVICE_NAME, database: "down" });
      }
    },
  );
}
