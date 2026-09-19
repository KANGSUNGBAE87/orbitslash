import { describe, expect, it } from "vitest";
import type { ModeResult } from "../ModeConfig";
import type { ProgressSnapshot } from "../ProgressStore";
import { emptyProgressDelta, reduceProgressAfterRun } from "./ProgressReducer";

function baseProgress(): ProgressSnapshot {
  return {
    version: 4,
    profile: { totalRuns: 0, totalKills: 0, totalBossKills: 0, totalScore: 0 },
    records: {},
    unlocks: {
      modes: ["freeDefense", "story"],
      skills: ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield"],
      bosses: [],
      storyStages: [1],
    },
    collection: { bossCodex: [], specialObjectCodex: [], titles: [] },
    story: { clearedStageIds: [] },
    daily: { completedModifierIds: [], clearCount: 0 },
    freeDefense: { dailyPlayDate: null, dailyPlayCount: 0 },
    onboarding: { version: 1, step: "not_started", startedAt: null, completedAt: null, lastUpdatedAt: null },
    retention: { stageMedals: {}, daily: { firstClearAwards: [], clearDayKeys: [] }, claimedWeeklyKeys: [] },
  };
}

function firstBossClear(): ModeResult {
  return {
    modeId: "freeDefense",
    difficulty: "rookie",
    endReason: "earth_destroyed",
    survivalMs: 60000,
    score: 2500,
    kills: 20,
    bossKills: 1,
    defeatedBossIds: ["ringed_destroyer"],
    maxCombo: 5,
    remainingEnergy: 20,
    rankingEligible: false,
    retryDestination: "sameRun",
  };
}

describe("reduceProgressAfterRun", () => {
  it("returns only newly unlocked rewards", () => {
    const result = reduceProgressAfterRun(baseProgress(), firstBossClear(), new Date("2031-02-03T12:00:00.000Z"));

    expect(result.delta.newModes).toEqual(["bossRush", "ranked", "daily"]);
    expect(result.delta.newSkills).toEqual(["nova_pulse"]);
    expect(result.delta.newBosses).toEqual(["ringed_destroyer"]);
    expect(result.delta.newCollectionEntries).toEqual(expect.arrayContaining([
      { kind: "boss", id: "ringed_destroyer" },
      { kind: "title", id: "bossBreaker" },
    ]));
  });

  it("does not reveal the same unlock twice", () => {
    const now = new Date("2031-02-03T12:00:00.000Z");
    const once = reduceProgressAfterRun(baseProgress(), firstBossClear(), now);
    const twice = reduceProgressAfterRun(once.snapshot, firstBossClear(), now);

    expect(twice.delta).toEqual(emptyProgressDelta());
  });

  it("records a non-decreasing Story medal and one Daily first-clear", () => {
    const story = reduceProgressAfterRun(baseProgress(), {
      ...firstBossClear(),
      modeId: "story",
      activeStoryStageId: "story-1",
      objectiveOutcome: "cleared",
      score: 2200,
      remainingEnergy: 90,
      maxCombo: 6,
    }, new Date("2031-02-03T12:00:00.000Z"));
    const daily = reduceProgressAfterRun(story.snapshot, {
      ...firstBossClear(),
      modeId: "daily",
      activeDailyModifierId: "rescueDay",
      objectiveOutcome: "cleared",
    }, new Date("2031-02-04T12:00:00.000Z"));

    expect(story.snapshot.retention.stageMedals["story-1"]).toBe("gold");
    expect(daily.snapshot.retention.daily.firstClearAwards).toEqual(["2031-02-04"]);
  });

  it("uses the supplied stage-specific retention rule instead of hard-coded medal thresholds", () => {
    const result = reduceProgressAfterRun(baseProgress(), {
      ...firstBossClear(),
      modeId: "story",
      activeStoryStageId: "story-1",
      objectiveOutcome: "cleared",
      score: 150,
      remainingEnergy: 10,
      maxCombo: 1,
    }, new Date("2031-02-03T12:00:00.000Z"), {
      stages: {
        "story-1": { silverScore: 100, goldScore: 1000 },
      },
      weekly: { requiredDistinctClearDays: 5, titleId: "weekly_five_day" },
    } as never);

    expect(result.snapshot.retention.stageMedals["story-1"]).toBe("silver");
  });

  it("records daily retention keys by KST calendar day for weekly evaluation", () => {
    const result = reduceProgressAfterRun(baseProgress(), {
      ...firstBossClear(),
      modeId: "daily",
      activeDailyModifierId: "rescueDay",
      objectiveOutcome: "cleared",
    }, new Date("2031-02-02T15:30:00.000Z"));

    expect(result.snapshot.retention.daily.clearDayKeys).toEqual(["2031-02-03"]);
  });
});
