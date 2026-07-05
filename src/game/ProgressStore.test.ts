import { describe, expect, it } from "vitest";
import { buildModeProgressSummary, canStartFreeDefenseRun, FREE_DEFENSE_DAILY_PLAY_LIMIT, ProgressStore } from "./ProgressStore";
import { WebStubAdapter } from "../platform/WebStubAdapter";

describe("ProgressStore", () => {
  it("persists best score and survival per mode through the platform storage adapter", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);

    await store.recordResult({
      modeId: "freeDefense",
      difficulty: "rookie",
      endReason: "earth_destroyed",
      survivalMs: 1234,
      score: 500,
      kills: 8,
      maxCombo: 3,
      remainingEnergy: 0,
      rankingEligible: false,
      retryDestination: "sameRun",
    });
    await store.recordResult({
      modeId: "freeDefense",
      difficulty: "rookie",
      endReason: "earth_destroyed",
      survivalMs: 1000,
      score: 700,
      kills: 4,
      maxCombo: 2,
      remainingEnergy: 0,
      rankingEligible: false,
      retryDestination: "sameRun",
    });

    const snapshot = await store.load();

    expect(snapshot.records.freeDefense).toMatchObject({
      plays: 2,
      bestScore: 700,
      bestSurvivalMs: 1234,
    });
    expect(snapshot.profile.totalRuns).toBe(2);
    expect(snapshot.profile.totalKills).toBe(12);
  });

  it("unlocks boss rush and nova pulse after the first boss kill while preserving collection codex", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);

    await store.recordResult({
      modeId: "freeDefense",
      difficulty: "rookie",
      endReason: "earth_destroyed",
      survivalMs: 60000,
      score: 2500,
      kills: 20,
      bossKills: 1,
      defeatedBossIds: ["eclipse_core"],
      maxCombo: 5,
      remainingEnergy: 20,
      rankingEligible: false,
      retryDestination: "sameRun",
    });

    const snapshot = await store.load();

    expect(snapshot.profile.totalBossKills).toBe(1);
    expect(snapshot.unlocks.skills).toContain("nova_pulse");
    expect(snapshot.unlocks.modes).toContain("bossRush");
    expect(snapshot.collection.bossCodex).toContain("eclipse_core");
    expect(snapshot.collection.titles).toContain("bossBreaker");
  });

  it("normalizes legacy v1 records with v2 defaults and avoids NaN boss records", async () => {
    const adapter = new WebStubAdapter();
    await adapter.storageSet(
      "orbitslash.progress.v1",
      JSON.stringify({
        records: {
          freeDefense: {
            plays: 3,
            bestScore: 900,
            bestSurvivalMs: 12000,
            bestCombo: 4,
            bestKills: 20,
          },
        },
        unlocks: { modes: ["freeDefense"], skills: ["solar_lance"], bosses: [], storyStages: [] },
      }),
    );
    const store = new ProgressStore(adapter);

    const before = await store.load();
    expect(before.records.freeDefense?.bestBossKills).toBe(0);
    expect(before.unlocks.modes).toContain("story");
    expect(before.unlocks.skills).toContain("delta_shield");

    const after = await store.recordResult({
      modeId: "freeDefense",
      difficulty: "rookie",
      endReason: "earth_destroyed",
      survivalMs: 1000,
      score: 100,
      kills: 1,
      maxCombo: 1,
      remainingEnergy: 0,
      rankingEligible: false,
      retryDestination: "sameRun",
    });

    expect(after.records.freeDefense?.bestBossKills).toBe(0);
  });

  it("builds mode card progress summaries from unlocks and records", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);

    expect(buildModeProgressSummary(await store.load(), "bossRush")).toMatchObject({
      modeId: "bossRush",
      unlocked: false,
      progressLabel: "보스 러시 준비",
    });

    await store.recordResult({
      modeId: "freeDefense",
      difficulty: "rookie",
      endReason: "earth_destroyed",
      survivalMs: 42000,
      score: 1200,
      kills: 12,
      bossKills: 1,
      defeatedBossIds: ["eclipse_core"],
      maxCombo: 4,
      remainingEnergy: 12,
      rankingEligible: false,
      retryDestination: "sameRun",
    });
    const snapshot = await store.load();

    expect(buildModeProgressSummary(snapshot, "freeDefense")).toMatchObject({
      modeId: "freeDefense",
      unlocked: true,
      plays: 1,
      bestScore: 1200,
      bestLabel: "최고 1,200",
      progressLabel: "1회 플레이",
    });
    expect(buildModeProgressSummary(snapshot, "bossRush")).toMatchObject({
      modeId: "bossRush",
      unlocked: true,
      bestBossKills: 0,
      progressLabel: "보스 러시 준비",
    });
  });

  it("summarizes Boss Rush by best defeated boss count instead of generic play count", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);

    await store.recordResult({
      modeId: "bossRush",
      difficulty: "defender",
      endReason: "earth_destroyed",
      survivalMs: 90000,
      score: 5000,
      kills: 30,
      bossKills: 3,
      defeatedBossIds: ["ringed_destroyer", "eclipse_core", "lava_titan"],
      maxCombo: 8,
      remainingEnergy: 20,
      rankingEligible: false,
      retryDestination: "sameRun",
      objectiveOutcome: "failed",
    });

    const summary = buildModeProgressSummary(await store.load(), "bossRush");

    expect(summary.bestBossKills).toBe(3);
    expect(summary.progressLabel).toBe("최고 보스 3체");
  });

  it("tracks the Free Defense daily free-play limit from recorded standard runs", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);

    for (let i = 0; i < FREE_DEFENSE_DAILY_PLAY_LIMIT; i += 1) {
      await store.recordResult({
        modeId: "freeDefense",
        difficulty: "rookie",
        endReason: "earth_destroyed",
        survivalMs: 10000,
        score: 100 + i,
        kills: 2,
        maxCombo: 1,
        remainingEnergy: 0,
        rankingEligible: false,
        retryDestination: "sameRun",
      });
    }

    const snapshot = await store.load();

    expect(snapshot.freeDefense.dailyPlayCount).toBe(FREE_DEFENSE_DAILY_PLAY_LIMIT);
    expect(snapshot.freeDefense.dailyPlayDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(canStartFreeDefenseRun(snapshot)).toBe(false);
  });

  it("stores story stage clears and daily completion markers from mode results", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);

    await store.recordResult({
      modeId: "story",
      difficulty: "rookie",
      endReason: "stage_objective_complete",
      survivalMs: 30000,
      score: 900,
      kills: 6,
      maxCombo: 3,
      remainingEnergy: 80,
      rankingEligible: false,
      retryDestination: "modeSelect",
      activeStoryStageId: "story-2",
      objectiveOutcome: "cleared",
    });
    await store.recordResult({
      modeId: "daily",
      difficulty: "defender",
      endReason: "stage_objective_complete",
      survivalMs: 60000,
      score: 1200,
      kills: 8,
      maxCombo: 4,
      remainingEnergy: 70,
      rankingEligible: false,
      retryDestination: "modeSelect",
      activeDailyModifierId: "lastSaveDay",
      objectiveOutcome: "cleared",
    });

    const snapshot = await store.load();

    expect(snapshot.story.clearedStageIds).toEqual(["story-2"]);
    expect(snapshot.unlocks.storyStages).toContain(3);
    expect(snapshot.daily.completedModifierIds).toEqual(["lastSaveDay"]);
    expect(snapshot.daily.clearCount).toBe(1);
    expect(snapshot.collection.specialObjectCodex).toContain("empMine");
    expect(snapshot.collection.titles).toContain("dailyClear");
  });

  it("tracks special-object and title collection unlocks from clear outcomes", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);

    await store.recordResult({
      modeId: "daily",
      difficulty: "defender",
      endReason: "stage_objective_complete",
      survivalMs: 60000,
      score: 3000,
      kills: 14,
      maxCombo: 11,
      remainingEnergy: 40,
      rankingEligible: false,
      retryDestination: "modeSelect",
      activeDailyModifierId: "rescueDay",
      protectedCount: 2,
      objectiveOutcome: "cleared",
    });
    await store.recordResult({
      modeId: "blitz60",
      difficulty: "rookie",
      endReason: "timer_expired",
      survivalMs: 60000,
      score: 2200,
      kills: 20,
      maxCombo: 5,
      remainingEnergy: 20,
      rankingEligible: false,
      retryDestination: "modeSelect",
      objectiveOutcome: "survived",
    });

    const snapshot = await store.load();

    expect(snapshot.collection.specialObjectCodex).toEqual(expect.arrayContaining(["friendlyRescue", "satellite", "energyCapsule"]));
    expect(snapshot.collection.titles).toEqual(expect.arrayContaining(["dailyClear", "comboPilot", "blitzSurvivor"]));
  });

  it("does not unlock an invalid Story stage after the final stage clears", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);

    await store.recordResult({
      modeId: "story",
      difficulty: "rookie",
      endReason: "stage_objective_complete",
      survivalMs: 90000,
      score: 3200,
      kills: 20,
      maxCombo: 8,
      remainingEnergy: 90,
      rankingEligible: false,
      retryDestination: "modeSelect",
      activeStoryStageId: "story-32",
      objectiveOutcome: "cleared",
    });

    const snapshot = await store.load();

    expect(snapshot.story.clearedStageIds).toContain("story-32");
    expect(snapshot.unlocks.storyStages).toContain(32);
    expect(snapshot.unlocks.storyStages).not.toContain(33);
  });

  it("does not advance Story or Daily progression from failed objective results", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);

    await store.recordResult({
      modeId: "story",
      difficulty: "rookie",
      endReason: "earth_destroyed",
      survivalMs: 20000,
      score: 300,
      kills: 2,
      maxCombo: 1,
      remainingEnergy: 0,
      rankingEligible: false,
      retryDestination: "sameRun",
      activeStoryStageId: "story-2",
      objectiveOutcome: "failed",
    });
    await store.recordResult({
      modeId: "daily",
      difficulty: "defender",
      endReason: "daily_challenge_failed",
      survivalMs: 30000,
      score: 400,
      kills: 3,
      maxCombo: 1,
      remainingEnergy: 0,
      rankingEligible: false,
      retryDestination: "sameRun",
      activeDailyModifierId: "bossAlert",
      objectiveOutcome: "failed",
    });

    const snapshot = await store.load();

    expect(snapshot.story.clearedStageIds).toEqual([]);
    expect(snapshot.unlocks.storyStages).not.toContain(3);
    expect(snapshot.daily.completedModifierIds).toEqual([]);
    expect(snapshot.daily.clearCount).toBe(0);
  });

  it("tracks ranked, blitz, and daily records without implying public ranking", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);

    await store.recordResult({
      modeId: "ranked",
      difficulty: "elite",
      endReason: "earth_destroyed",
      survivalMs: 45000,
      score: 2500,
      kills: 24,
      maxCombo: 7,
      remainingEnergy: 0,
      rankingEligible: false,
      rankingSubmissionState: "localOnly",
      retryDestination: "modeSelect",
    });
    await store.recordResult({
      modeId: "blitz60",
      difficulty: "rookie",
      endReason: "timer_expired",
      survivalMs: 60000,
      score: 4100,
      kills: 36,
      maxCombo: 9,
      remainingEnergy: 35,
      rankingEligible: false,
      retryDestination: "sameRun",
    });
    await store.recordResult({
      modeId: "daily",
      difficulty: "defender",
      endReason: "stage_objective_complete",
      survivalMs: 60000,
      score: 1900,
      kills: 12,
      maxCombo: 5,
      remainingEnergy: 70,
      rankingEligible: false,
      retryDestination: "modeSelect",
      activeDailyModifierId: "bossAlert",
      objectiveOutcome: "cleared",
    });

    const snapshot = await store.load();

    expect(snapshot.records.ranked).toMatchObject({
      plays: 1,
      bestScore: 2500,
      bestSurvivalMs: 45000,
    });
    expect(snapshot.records.blitz60).toMatchObject({
      plays: 1,
      bestScore: 4100,
      bestSurvivalMs: 60000,
    });
    expect(snapshot.daily).toMatchObject({
      clearCount: 1,
      completedModifierIds: ["bossAlert"],
    });
    expect(buildModeProgressSummary(snapshot, "ranked")).toMatchObject({
      modeId: "ranked",
      bestScore: 2500,
      bestLabel: "최고 2,500",
    });
    expect(buildModeProgressSummary(snapshot, "blitz60")).toMatchObject({
      modeId: "blitz60",
      progressLabel: "1회 플레이",
      bestScore: 4100,
    });
    expect(buildModeProgressSummary(snapshot, "daily")).toMatchObject({
      modeId: "daily",
      progressLabel: "1회 플레이",
      bestScore: 1900,
    });
  });
});
