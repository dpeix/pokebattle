import type { HealthResponse } from "@pokebattle/shared";
import type { FastifyInstance } from "fastify";

const SERVICE_NAME = "battle-engine";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Reply: HealthResponse }>(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            required: ["status", "service"],
            properties: {
              status: { type: "string", const: "ok" },
              service: { type: "string" },
            },
          },
        },
      },
    },
    async () => ({ status: "ok", service: SERVICE_NAME }),
  );
}
