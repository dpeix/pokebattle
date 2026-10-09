import { afterEach, describe, expect, it } from "vitest";
import { requireEnv } from "../src/env.js";

describe("requireEnv", () => {
  const name = "POKEBATTLE_TEST_VARIABLE";

  afterEach(() => {
    delete process.env[name];
  });

  it("returns the value of a defined variable", () => {
    process.env[name] = "value";

    expect(requireEnv(name)).toBe("value");
  });

  it("throws when the variable is missing", () => {
    expect(() => requireEnv(name)).toThrow(name);
  });

  it("throws when the variable is empty", () => {
    process.env[name] = "";

    expect(() => requireEnv(name)).toThrow(name);
  });
});
