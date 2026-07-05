import { describe, expect, it } from "vitest";
import {
  DEV_QA_SCENARIO_IDS,
  DEV_QA_SCENARIOS,
  createDefaultDevQaResults,
  normalizeDevQaResults,
  parseDevQaResults,
  readDevModeParam,
  readDevNumberParam,
  readDevStringParam,
} from "./DevQa";
import { DEV_QA_PRESETS } from "./GameScene";

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

  it("keeps boss and special object visual QA presets available in dev", () => {
    expect(readDevStringParam("?qaPreset=boss", "qaPreset", DEV_QA_PRESETS)).toBe("boss");
    expect(readDevStringParam("?qaPreset=blockedBody", "qaPreset", DEV_QA_PRESETS)).toBe("blockedBody");
    expect(readDevStringParam("?qaPreset=special", "qaPreset", DEV_QA_PRESETS)).toBe("special");
  });
});

describe("readDevModeParam", () => {
  it("allows direct QA entry into any released mode", () => {
    expect(readDevModeParam("?qaMode=blitz60", "qaMode")).toBe("blitz60");
    expect(readDevModeParam("?qaMode=bossRush", "qaMode")).toBe("bossRush");
  });

  it("rejects unknown direct QA mode values", () => {
    expect(readDevModeParam("?qaMode=unknown", "qaMode")).toBeUndefined();
  });
});

describe("DEV QA result helpers", () => {
  it("keeps every human carryover QA scenario in the launch registry with pass criteria", () => {
    expect(DEV_QA_SCENARIO_IDS).toEqual(["touchHud", "boss", "special", "blitz"]);
    for (const id of DEV_QA_SCENARIO_IDS) {
      expect(DEV_QA_SCENARIOS[id].id).toBe(id);
      expect(DEV_QA_SCENARIOS[id].label.length).toBeGreaterThan(0);
      expect(DEV_QA_SCENARIOS[id].labelKey).toBe(`devQa.${id === "touchHud" ? "touchHud" : id}`);
      expect(DEV_QA_SCENARIOS[id].passCriteria.length).toBeGreaterThanOrEqual(3);
    }
    expect(DEV_QA_SCENARIOS.boss).toMatchObject({ modeId: "bossRush", preset: "blockedBody" });
    expect(DEV_QA_SCENARIOS.special).toMatchObject({ modeId: "freeDefense", preset: "special" });
    expect(DEV_QA_SCENARIOS.blitz).toMatchObject({ modeId: "blitz60", preset: "dense" });
    expect(DEV_QA_SCENARIOS.touchHud).toMatchObject({ modeId: "freeDefense", preset: "dense" });
  });

  it("creates a pending result for every human carryover scenario", () => {
    expect(createDefaultDevQaResults()).toEqual({
      touchHud: false,
      boss: false,
      special: false,
      blitz: false,
    });
  });

  it("normalizes partial or invalid persisted results", () => {
    expect(normalizeDevQaResults({ touchHud: true, boss: "yes", special: true })).toEqual({
      touchHud: true,
      boss: false,
      special: true,
      blitz: false,
    });
  });

  it("parses persisted QA results without throwing on corrupt storage", () => {
    expect(parseDevQaResults('{"boss":true,"blitz":true}')).toMatchObject({ boss: true, blitz: true });
    expect(parseDevQaResults("{bad-json")).toEqual(createDefaultDevQaResults());
  });
});
