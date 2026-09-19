import { describe, expect, it } from "vitest";
import type { ProgressSnapshot } from "../../game/ProgressStore";
import { mergeProgress } from "./ProgressMerge";

function snapshot(overrides: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    version: 4,
    profile: { totalRuns: 2, totalKills: 10, totalBossKills: 0, totalScore: 100 },
    records: { freeDefense: { plays: 2, bestScore: 100, bestSurvivalMs: 1000, bestCombo: 2, bestKills: 5, bestBossKills: 0 } },
    unlocks: { modes: ["story", "freeDefense"], skills: ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield"], bosses: [], storyStages: [1] },
    collection: { bossCodex: [], specialObjectCodex: [], titles: [] },
    story: { clearedStageIds: [] },
    daily: { completedModifierIds: [], clearCount: 0 },
    freeDefense: { dailyPlayDate: null, dailyPlayCount: 0 },
    onboarding: { version: 1, step: "not_started", startedAt: null, completedAt: null, lastUpdatedAt: null },
    retention: { stageMedals: {}, daily: { firstClearAwards: [], clearDayKeys: [] }, claimedWeeklyKeys: [] },
    ...overrides,
  };
}

describe("mergeProgress", () => {
  it("unions unlocks and keeps maximum records across devices", () => {
    const local = snapshot();
    const remote = snapshot({
      unlocks: { modes: ["story", "freeDefense", "bossRush"], skills: ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield", "nova_pulse"], bosses: ["ringed_destroyer"], storyStages: [1, 2] },
      records: { freeDefense: { plays: 1, bestScore: 900, bestSurvivalMs: 2000, bestCombo: 6, bestKills: 9, bestBossKills: 1 } },
    });

    const merged = mergeProgress(local, remote);
    expect(merged.unlocks.modes).toEqual(expect.arrayContaining(["bossRush"]));
    expect(merged.unlocks.skills).toEqual(expect.arrayContaining(["nova_pulse"]));
    expect(merged.records.freeDefense).toMatchObject({ bestScore: 900, bestSurvivalMs: 2000, bestBossKills: 1 });
  });
});
