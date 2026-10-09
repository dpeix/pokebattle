import { existsSync } from "node:fs";

let dotEnvLoaded = false;

/**
 * Reads a variable from the environment, after loading the local `.env`
 * (optional outside development) on first use: the dev server does not
 * load it into `process.env`. Read on first use rather than at import, so
 * that the build does not need the variables.
 */
export function requireEnv(name: string): string {
  if (!dotEnvLoaded) {
    dotEnvLoaded = true;
    if (existsSync(".env")) {
      process.loadEnvFile(".env");
    }
  }
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name} (see .env.example in apps/web)`,
    );
  }
  return value;
}
