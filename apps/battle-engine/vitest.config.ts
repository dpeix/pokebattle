import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // @fastify/autoload loads plugins and routes with Node's native import(),
    // outside Vite: tsx lets those .ts files resolve their ".js" imports.
    execArgv: ["--import", "tsx"],
    globalSetup: ["test/global-setup.ts"],
    setupFiles: ["test/setup.ts"],
  },
});
