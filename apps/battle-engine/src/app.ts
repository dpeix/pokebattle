import Fastify, { type FastifyServerOptions } from "fastify";
import { dbPlugin } from "./plugins/db.js";
import { healthRoutes } from "./routes/health.js";

export interface AppOptions {
  databaseUrl: string;
  fastify?: FastifyServerOptions;
}

export function buildApp({ databaseUrl, fastify }: AppOptions) {
  const app = Fastify(fastify);

  app.register(dbPlugin, { databaseUrl });
  app.register(healthRoutes);

  return app;
}
