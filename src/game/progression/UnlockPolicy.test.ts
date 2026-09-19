import { describe, expect, it } from "vitest";
import type { ProgressSnapshot } from "../ProgressStore";
import { evaluatePlayerUnlocks, resolveModeAvailability } from "./UnlockPolicy";

function progressWith(clearedStageIds: string[] = [], totalBossKills = 0): ProgressSnapshot {
  return {
    version: 4,
    profile: { totalRuns: 0, totalKills: 0, totalBossKills, totalScore: 0 },
    records: {},
    unlocks: {
      modes: ["story", "freeDefense"],
      skills: ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield"],
      bosses: [],
      storyStages: [1],
    },
    collection: { bossCodex: [], specialObjectCodex: [], titles: [] },
    story: { clearedStageIds: clearedStageIds as never[] },
    daily: { completedModifierIds: [], clearCount: 0 },
    freeDefense: { dailyPlayDate: null, dailyPlayCount: 0 },
    onboarding: { version: 1, step: "not_started", startedAt: null, completedAt: null, lastUpdatedAt: null },
    retention: { stageMedals: {}, daily: { firstClearAwards: [], clearDayKeys: [] }, claimedWeeklyKeys: [] },
  };
}

describe("player unlock policy", () => {
  it("unlocks ranked and nova after Story 8", () => {
    const access = evaluatePlayerUnlocks(progressWith(["story-8"]));

    expect(access.modes).toContain("ranked");
    expect(access.skills).toContain("nova_pulse");
  });

  it("also unlocks ranked and nova after the first boss defeat", () => {
    const access = evaluatePlayerUnlocks(progressWith([], 1));

    expect(access.modes).toContain("ranked");
    expect(access.skills).toContain("nova_pulse");
  });

  it("keeps public ranked service unavailable without identity readiness", () => {
    expect(resolveModeAvailability("ranked", progressWith(["story-8"]), false)).toEqual({
      playerUnlocked: true,
      serviceReady: false,
      startKind: "local_practice",
    });
  });
});
