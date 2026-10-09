import type { HealthResponse } from "@pokebattle/shared";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("GET /health", () => {
  let app: ReturnType<typeof buildApp> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("reports the service as up", async () => {
    app = buildApp();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json<HealthResponse>()).toEqual({
      status: "ok",
      service: "battle-engine",
    });
  });

  it("returns 404 for an unknown route", async () => {
    app = buildApp();

    const response = await app.inject({ method: "GET", url: "/unknown" });

    expect(response.statusCode).toBe(404);
  });
});
