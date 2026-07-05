import { describe, expect, it } from "vitest";
import { appStateReducer, initialAppState } from "./AppState";

describe("AppState", () => {
  it("boots before the app shell is ready and then opens home", () => {
    const boot = initialAppState();

    expect(boot.screen).toBe("boot");

    const loading = appStateReducer(boot, { type: "APP_LOADING" });
    expect(loading.screen).toBe("loading");
    expect(loading.activeModeId).toBeNull();
    expect(loading.selectedModeId).toBeNull();

    const ready = appStateReducer(loading, { type: "APP_READY" });
    expect(ready.screen).toBe("home");
    expect(ready.runSource).toBe("play");
  });

  it("starts at home and enters mode select", () => {
    const state = appStateReducer(initialAppState(), { type: "OPEN_MODE_SELECT" });

    expect(state.screen).toBe("modeSelect");
    expect(state.activeModeId).toBeNull();
    expect(state.selectedModeId).toBeNull();
  });

  it("opens a mode detail screen before starting gameplay", () => {
    const detail = appStateReducer(initialAppState(), { type: "OPEN_MODE_DETAIL", modeId: "bossRush" });

    expect(detail.screen).toBe("modeDetail");
    expect(detail.selectedModeId).toBe("bossRush");
    expect(detail.activeModeId).toBeNull();

    const playing = appStateReducer(detail, { type: "START_RUN", modeId: "bossRush" });
    expect(playing.screen).toBe("gameplay");
    expect(playing.activeModeId).toBe("bossRush");
    expect(playing.selectedModeId).toBe("bossRush");
  });

  it("returns from result to the completed mode detail", () => {
    const playing = appStateReducer(initialAppState(), { type: "START_RUN", modeId: "daily", seed: 20260705 });
    const result = appStateReducer(playing, {
      type: "RUN_ENDED",
      result: {
        modeId: "daily",
        difficulty: "defender",
        endReason: "daily_challenge_failed",
        survivalMs: 30000,
        score: 100,
        kills: 2,
        maxCombo: 1,
        remainingEnergy: 0,
        rankingEligible: false,
        retryDestination: "sameRun",
        activeDailyModifierId: "lastSaveDay",
        objectiveOutcome: "failed",
      },
    });

    const detail = appStateReducer(result, { type: "OPEN_MODE_DETAIL" });

    expect(detail.screen).toBe("modeDetail");
    expect(detail.selectedModeId).toBe("daily");
    expect(detail.lastResult?.objectiveOutcome).toBe("failed");
  });

  it("starts gameplay for a selected mode and returns to result on run end", () => {
    const playing = appStateReducer(initialAppState(), { type: "START_RUN", modeId: "blitz60" });
    expect(playing).toMatchObject({ screen: "gameplay", activeModeId: "blitz60" });
    expect(playing.runSource).toBe("play");
    expect(playing.runConfig.modeId).toBe("blitz60");
    expect(playing.runConfig.rules.durationLimitMs).toBe(60000);

    const result = appStateReducer(playing, {
      type: "RUN_ENDED",
      result: {
        modeId: "blitz60",
        difficulty: "rookie",
        endReason: "timer_expired",
        survivalMs: 60000,
        score: 1000,
        kills: 12,
        maxCombo: 4,
        remainingEnergy: 80,
        rankingEligible: false,
        retryDestination: "sameRun",
      },
    });

    expect(result.screen).toBe("result");
    expect(result.lastResult?.endReason).toBe("timer_expired");
  });

  it("starts Free Defense with selected difficulty and practice preset as a non-recording practice run", () => {
    const playing = appStateReducer(initialAppState(), {
      type: "START_RUN",
      modeId: "freeDefense",
      difficulty: "elite",
      freeDefensePreset: "bossPractice",
      practiceBossId: "dark_planet",
      source: "practice",
    } as any);

    expect(playing.screen).toBe("gameplay");
    expect(playing.runSource).toBe("practice");
    expect(playing.runConfig.modeId).toBe("freeDefense");
    expect(playing.runConfig.difficulty).toBe("elite");
    expect(playing.runConfig.rules.freeDefensePreset).toBe("bossPractice");
    expect(playing.runConfig.rules.bossPolicy.bossEnemyType).toBe("dark_planet");
    expect(playing.runConfig.rules.rankingEligible).toBe(false);
  });

  it("starts and retries Story with the selected stage seed", () => {
    const playing = appStateReducer(initialAppState(), {
      type: "START_RUN",
      modeId: "story",
      storyStageId: "story-8",
    });

    expect(playing.runConfig.modeId).toBe("story");
    expect(playing.runConfig.seed).toBe(1008);

    const result = appStateReducer(playing, {
      type: "RUN_ENDED",
      result: {
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
        activeStoryStageId: "story-8",
        objectiveOutcome: "cleared",
      },
    });
    const retry = appStateReducer(result, { type: "RETRY_RUN" });

    expect(retry.runConfig.seed).toBe(1008);
  });

  it("retries the previous mode from result state", () => {
    const playing = appStateReducer(initialAppState(), { type: "START_RUN", modeId: "ranked", seed: 9 });
    const result = appStateReducer(playing, {
      type: "RUN_ENDED",
      result: {
        modeId: "ranked",
        difficulty: "rookie",
        endReason: "earth_destroyed",
        survivalMs: 1000,
        score: 10,
        kills: 1,
        maxCombo: 1,
        remainingEnergy: 0,
        rankingEligible: true,
        retryDestination: "modeSelect",
      },
    });

    const retry = appStateReducer(result, { type: "RETRY_RUN", seed: 10 });

    expect(retry.screen).toBe("gameplay");
    expect(retry.activeModeId).toBe("ranked");
    expect(retry.runConfig.seed).toBe(10);
    expect(retry.runConfig.rules.rankingEligible).toBe(false);
  });

  it("does not reuse server-ranked config on ranked retry", () => {
    const playing = appStateReducer(initialAppState(), { type: "START_RUN", modeId: "ranked", seed: 9 });
    const serverRanked = {
      ...playing,
      runConfig: {
        ...playing.runConfig,
        configVersion: "server-ranked-2026w27",
        rules: { ...playing.runConfig.rules, rankingEligible: true },
      },
    };
    const result = appStateReducer(serverRanked, {
      type: "RUN_ENDED",
      result: {
        modeId: "ranked",
        difficulty: "rookie",
        endReason: "earth_destroyed",
        survivalMs: 1000,
        score: 10,
        kills: 1,
        maxCombo: 1,
        remainingEnergy: 0,
        rankingEligible: true,
        retryDestination: "sameRun",
      },
    });

    const retry = appStateReducer(result, { type: "RETRY_RUN" });

    expect(retry.runConfig.configVersion).toBe("local");
    expect(retry.runConfig.rules.rankingEligible).toBe(false);
  });

  it("preserves the previous seed on retry unless a new seed is explicitly supplied", () => {
    const playing = appStateReducer(initialAppState(), { type: "START_RUN", modeId: "daily", seed: 20260704 });
    const result = appStateReducer(playing, {
      type: "RUN_ENDED",
      result: {
        modeId: "daily",
        difficulty: "defender",
        endReason: "earth_destroyed",
        survivalMs: 1000,
        score: 10,
        kills: 1,
        maxCombo: 1,
        remainingEnergy: 0,
        rankingEligible: false,
        retryDestination: "sameRun",
      },
    });

    const retry = appStateReducer(result, { type: "RETRY_RUN" });

    expect(retry.runConfig.seed).toBe(20260704);
  });

  it("keeps DEV QA run source through result and retry so QA does not become progress", () => {
    const playing = appStateReducer(initialAppState(), { type: "START_RUN", modeId: "bossRush", source: "devQa" });
    expect(playing.runSource).toBe("devQa");

    const result = appStateReducer(playing, {
      type: "RUN_ENDED",
      result: {
        modeId: "bossRush",
        difficulty: "defender",
        endReason: "earth_destroyed",
        survivalMs: 1000,
        score: 10,
        kills: 1,
        bossKills: 0,
        maxCombo: 1,
        remainingEnergy: 0,
        rankingEligible: false,
        retryDestination: "sameRun",
      },
    });
    const retry = appStateReducer(result, { type: "RETRY_RUN" });

    expect(result.runSource).toBe("devQa");
    expect(retry.runSource).toBe("devQa");
  });

  it("resets run source to normal play when leaving QA back to the shell", () => {
    const playing = appStateReducer(initialAppState(), { type: "START_RUN", modeId: "freeDefense", source: "devQa" });

    expect(appStateReducer(playing, { type: "OPEN_HOME" }).runSource).toBe("play");
    expect(appStateReducer(playing, { type: "OPEN_MODE_SELECT" }).runSource).toBe("play");
  });

  it("resets run source to normal play when leaving practice back to the shell", () => {
    const playing = appStateReducer(initialAppState(), {
      type: "START_RUN",
      modeId: "freeDefense",
      source: "practice",
      freeDefensePreset: "skillPractice",
    } as any);

    expect(appStateReducer(playing, { type: "OPEN_HOME" }).runSource).toBe("play");
    expect(appStateReducer(playing, { type: "OPEN_MODE_SELECT" }).runSource).toBe("play");
  });
});
