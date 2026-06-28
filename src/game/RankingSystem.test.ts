import { describe, expect, it } from "vitest";
import { createRunSummary, validateRunSubmission } from "./RankingSystem";

describe("RankingSystem readiness helpers", () => {
  it("creates a submit-ready run summary without platform secrets", () => {
    const summary = createRunSummary({
      runToken: "local-1",
      seed: 42,
      difficulty: "rookie",
      survivalMs: 90000,
      score: 12345,
      kills: 80,
      maxCombo: 12,
      lastSaveCount: 3,
      remainingEnergy: 42,
      solarLanceCount: 2,
      gravitySlowCount: 1,
    });

    expect(summary).toMatchObject({
      runToken: "local-1",
      score: 12345,
      skillUse: { solar_lance: 2, gravity_slow: 1 },
    });
    expect(JSON.stringify(summary)).not.toContain("SUPABASE");
  });

  it("rejects impossible score submissions before backend handoff", () => {
    expect(validateRunSubmission({ score: -1, survivalMs: 1000, remainingEnergy: 20 })).toEqual({
      ok: false,
      reason: "score_negative",
    });
    expect(validateRunSubmission({ score: 100, survivalMs: 1000, remainingEnergy: 101 })).toEqual({
      ok: false,
      reason: "energy_out_of_range",
    });
  });
});
