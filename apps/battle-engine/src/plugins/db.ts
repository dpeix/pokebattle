import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { createDb, type Database } from "../db/client.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}

export interface DbPluginOptions {
  databaseUrl: string;
}

export const dbPlugin = fp<DbPluginOptions>(
  async (app: FastifyInstance, { databaseUrl }) => {
    const db = createDb(databaseUrl);

    // pg reports idle connections dropped by the server (e.g. a database
    // restart) as an "error" event; unhandled, it would crash the process.
    // The pool discards the broken client and reconnects on the next query.
    db.$client.on("error", (error) => {
      app.log.error({ err: error }, "idle database connection error");
    });

    app.decorate("db", db);
    app.addHook("onClose", async () => {
      await db.$client.end();
    });
  },
  { name: "db" },
);
