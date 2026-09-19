import { describe, expect, it } from "vitest";
import { mergeProgressSnapshots } from "../../../supabase/functions/_shared/orbitslash-progress-merge";

describe("progress Edge merge", () => {
  it("unions unlocks and preserves each device's best records before the server writes a new revision", () => {
    const merged = mergeProgressSnapshots(
      {
        version: 4,
        profile: { totalRuns: 4, totalKills: 8, totalBossKills: 0, totalScore: 800 },
        records: { freeDefense: { plays: 4, bestScore: 800, bestSurvivalMs: 30_000, bestCombo: 3, bestKills: 8, bestBossKills: 0 } },
        unlocks: { modes: ["story"], skills: ["solar_lance"], bosses: [], storyStages: [1] },
        collection: { bossCodex: [], specialObjectCodex: [], titles: [] },
        story: { clearedStageIds: ["story-1"] }, daily: { completedModifierIds: [], clearCount: 1 }, freeDefense: { dailyPlayDate: "2031-02-03", dailyPlayCount: 1 },
        onboarding: { step: "last_save" }, retention: { stageMedals: { "story-1": "bronze" }, daily: { firstClearAwards: ["2031-02-03"], clearDayKeys: ["2031-02-03"] }, claimedWeeklyKeys: [] },
      },
      {
        version: 4,
        profile: { totalRuns: 6, totalKills: 6, totalBossKills: 1, totalScore: 600 },
        records: { freeDefense: { plays: 2, bestScore: 600, bestSurvivalMs: 45_000, bestCombo: 5, bestKills: 6, bestBossKills: 1 } },
        unlocks: { modes: ["bossRush"], skills: ["nova_pulse"], bosses: ["ringed_destroyer"], storyStages: [2] },
        collection: { bossCodex: ["ringed_destroyer"], specialObjectCodex: [], titles: ["weekly_guardian"] },
        story: { clearedStageIds: ["story-2"] }, daily: { completedModifierIds: ["noSkill"], clearCount: 2 }, freeDefense: { dailyPlayDate: "2031-02-04", dailyPlayCount: 1 },
        onboarding: { step: "solar_lance" }, retention: { stageMedals: { "story-1": "silver" }, daily: { firstClearAwards: ["2031-02-04"], clearDayKeys: ["2031-02-04"] }, claimedWeeklyKeys: ["2031-W06"] },
      },
    );

    expect(merged).toMatchObject({
      profile: { totalRuns: 6, totalKills: 8, totalBossKills: 1, totalScore: 800 },
      records: { freeDefense: { bestScore: 800, bestSurvivalMs: 45_000, bestCombo: 5, bestBossKills: 1 } },
      onboarding: { step: "solar_lance" },
      retention: { stageMedals: { "story-1": "silver" } },
    });
    expect((merged.unlocks as any).modes).toEqual(expect.arrayContaining(["story", "bossRush"]));
    expect((merged.retention as any).daily.clearDayKeys).toEqual(expect.arrayContaining(["2031-02-03", "2031-02-04"]));
  });
});
