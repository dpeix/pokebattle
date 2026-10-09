import { defineConfig } from "vitest/config";

// Separate from vite.config.ts: the React Router plugin builds the app and
// is not needed by the unit tests.
export default defineConfig({
  test: {
    include: ["app/**/*.test.ts"],
  },
});
