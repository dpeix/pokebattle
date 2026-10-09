import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "../src/db/client.js";
import { loadDotEnv, requireEnv } from "../src/env.js";

// Brings the test database up to date with the Drizzle migrations, so the
// suite also runs against a fresh database (such as the CI one).
export default async function setup(): Promise<void> {
  loadDotEnv();
  const db = createDb(requireEnv("DATABASE_URL"));
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
  } finally {
    await db.$client.end();
  }
}
