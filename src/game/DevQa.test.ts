import { describe, expect, it } from "vitest";
import { readDevNumberParam, readDevStringParam } from "./DevQa";

describe("readDevNumberParam", () => {
  it("returns undefined when the query param is missing", () => {
    expect(readDevNumberParam("?qaGauge=100", "seed", { min: 0, max: 999 })).toBeUndefined();
  });

  it("rejects non-finite values", () => {
    expect(readDevNumberParam("?qaGauge=abc", "qaGauge", { min: 0, max: 100 })).toBeUndefined();
    expect(readDevNumberParam("?qaGauge=Infinity", "qaGauge", { min: 0, max: 100 })).toBeUndefined();
  });

  it("clamps values to the allowed range", () => {
    expect(readDevNumberParam("?qaGauge=150", "qaGauge", { min: 0, max: 100 })).toBe(100);
    expect(readDevNumberParam("?qaGauge=-5", "qaGauge", { min: 0, max: 100 })).toBe(0);
  });

  it("can force integers for deterministic seeds", () => {
    expect(readDevNumberParam("?seed=42.9", "seed", { min: 0, max: 1000, integer: true })).toBe(42);
  });
});

describe("readDevStringParam", () => {
  it("returns only allowed string values", () => {
    expect(readDevStringParam("?qaPreset=lastSave", "qaPreset", ["lastSave", "directional"] as const)).toBe("lastSave");
    expect(readDevStringParam("?qaPreset=unknown", "qaPreset", ["lastSave", "directional"] as const)).toBeUndefined();
  });
});
