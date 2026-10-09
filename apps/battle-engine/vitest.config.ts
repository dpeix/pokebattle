import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // @fastify/autoload loads plugins and routes with Node's native import(),
    // outside Vite: tsx lets those .ts files resolve their ".js" imports.
    execArgv: ["--import", "tsx"],
    globalSetup: ["test/global-setup.ts"],
    setupFiles: ["test/setup.ts"],
    // Database tests import the fixtures in a transaction, whose TRUNCATE
    // locks the tables until the rollback: run in parallel, test files
    // deadlock on those locks.
    fileParallelism: false,
  },
});
