import { buildApp } from "./app.js";
import { loadDotEnv, requireEnv } from "./env.js";

loadDotEnv();

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

const app = buildApp({
  databaseUrl: requireEnv("DATABASE_URL"),
  fastify: { logger: true },
});

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
