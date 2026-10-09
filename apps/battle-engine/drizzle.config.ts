import { defineConfig } from "drizzle-kit";
import { loadDotEnv, requireEnv } from "./src/env.js";

loadDotEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: requireEnv("DATABASE_URL") },
});
