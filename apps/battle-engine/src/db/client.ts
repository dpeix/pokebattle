import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export function createDb(databaseUrl: string) {
  // Without a timeout, an unreachable host would hang requests (e.g. /health) indefinitely.
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
  });
  return drizzle({ client: pool, schema });
}

export type Database = ReturnType<typeof createDb>;

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** The database, or an open transaction (the tests run inside one). */
export type DbClient = Database | Transaction;
