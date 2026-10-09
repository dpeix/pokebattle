import { join } from "node:path";
import autoLoad from "@fastify/autoload";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { DbPluginOptions } from "./plugins/db.js";

export interface AppOptions {
  databaseUrl: string;
  fastify?: FastifyServerOptions;
}

export function buildApp({ databaseUrl, fastify }: AppOptions) {
  const app = Fastify(fastify);

  // Plugins (shared decorators such as `app.db`) load before the routes that
  // use them; a route's URL prefix follows its folder under routes/.
  app.register(autoLoad, {
    dir: join(import.meta.dirname, "plugins"),
    options: { databaseUrl } satisfies DbPluginOptions,
  });
  app.register(autoLoad, { dir: join(import.meta.dirname, "routes") });

  return app;
}
