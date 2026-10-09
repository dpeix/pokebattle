import type { HealthResponse } from "@pokebattle/shared";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { requireEnv } from "../src/env.js";

// Nothing listens on port 1, so connections are refused immediately.
const UNREACHABLE_DATABASE_URL = "postgres://user:password@127.0.0.1:1/battle";

describe("GET /health", () => {
  let app: ReturnType<typeof buildApp> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("reports the service and database as up", async () => {
    // Requires the database container: `pnpm db:up` with a filled-in .env.
    app = buildApp({ databaseUrl: requireEnv("DATABASE_URL") });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json<HealthResponse>()).toEqual({
      status: "ok",
      service: "battle-engine",
      database: "up",
    });
  });

  it("returns 503 when the database is unreachable", async () => {
    app = buildApp({ databaseUrl: UNREACHABLE_DATABASE_URL });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(503);
    expect(response.json<HealthResponse>()).toEqual({
      status: "error",
      service: "battle-engine",
      database: "down",
    });
  });

  it("returns 404 for an unknown route", async () => {
    app = buildApp({ databaseUrl: UNREACHABLE_DATABASE_URL });

    const response = await app.inject({ method: "GET", url: "/unknown" });

    expect(response.statusCode).toBe(404);
  });
});

describe("database lifecycle", () => {
  it("closes the connection pool when the app closes", async () => {
    const app = buildApp({ databaseUrl: UNREACHABLE_DATABASE_URL });
    await app.ready();

    await app.close();

    expect(app.db.$client.ended).toBe(true);
  });

  it("survives an idle connection being dropped by the server", async () => {
    const app = buildApp({ databaseUrl: UNREACHABLE_DATABASE_URL });
    await app.ready();

    // pg emits "error" on the pool when the server terminates an idle
    // connection (e.g. database restart); unhandled, it crashes the process.
    const emitIdleError = () =>
      app.db.$client.emit(
        "error",
        new Error("terminating connection due to administrator command"),
      );

    expect(emitIdleError).not.toThrow();
    await app.close();
  });
});
