import { existsSync } from "node:fs";

/** Loads a local `.env` file into `process.env` when present (it is optional outside development). */
export function loadDotEnv(path = ".env"): void {
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name} (see .env.example in apps/battle-engine)`,
    );
  }
  return value;
}
