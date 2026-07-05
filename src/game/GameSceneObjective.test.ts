import { describe, expect, it, vi } from "vitest";
import { GameScene } from "./GameScene";
import { buildRunConfig } from "./ModeConfig";
import { createServerVerifiedRankedStart } from "../platform/BackendAdapter";

function makeObjectiveScene(config = buildRunConfig("story", { seed: 1001 })) {
  const scene: any = Object.create(GameScene.prototype);
  scene.runConfig = config;
  scene.elapsedMs = 0;
  scene.protectedCount = 0;
  scene.failedProtectCount = 0;
  scene.energy = { getEnergy: () => 80 };
  scene.runSession = { skillUseSnapshot: () => ({}) };
  scene.scoring = {
    snapshot: () => ({
      score: 0,
      combo: 0,
      kills: 0,
      maxCombo: 0,
      lastSaveCount: 0,
    }),
  };
  scene.bossKills = 0;
  scene.defeatedBossIds = [];
  scene.currentRunStart = { difficulty: "rookie", runToken: "local", seed: config.seed };
  scene.telemetrySessionTraceId = "test-session";
  scene.telemetryEventSequence = 0;
  scene.platformTelemetryContext = { runtime: "web_stub" };
  scene.runSession.finish = (input: any) => ({
    modeId: config.modeId,
    difficulty: config.difficulty,
    runToken: "local",
    seed: config.seed,
    rankingEligible: config.rules.rankingEligible,
    ...input,
  });
  scene.runSession.replayTraceSnapshot = () => ({ hitEvents: [], killEvents: [], comboBreakEvents: [], skillEvents: [] });
  scene.backend = { submitRankedRun: async () => ({ accepted: false }), trackEvent: vi.fn(async () => undefined) };
  scene.result = { show: () => undefined };
  scene.showResultOverlay = false;
  scene.onRunEnd = null;
  return scene;
}

describe("GameScene objective integration", () => {
  it("turns completed story objectives into stage completion", () => {
    const scene = makeObjectiveScene(buildRunConfig("story", { seed: 1001 }));
    scene.scoring.snapshot = () => ({
      score: 0,
      combo: 0,
      kills: 3,
      maxCombo: 2,
      lastSaveCount: 0,
    });

    expect(scene.currentObjectiveEndReason()).toBe("stage_objective_complete");
  });

  it("turns daily earth destruction into daily challenge failure", () => {
    const scene = makeObjectiveScene(buildRunConfig("daily", { seed: 20260704 }));

    expect(scene.resolveObjectiveEndReason("earth_destroyed")).toBe("daily_challenge_failed");
  });

  it("passes daily rescue only after protected-object counters reach the target", () => {
    const scene = makeObjectiveScene(buildRunConfig("daily", { seed: 20260701 }));
    scene.elapsedMs = 60000;
    scene.protectedCount = 2;

    expect(scene.currentObjectiveEndReason()).toBe("stage_objective_complete");
  });

  it("emits mode-specific result metadata when a story objective completes", () => {
    const scene = makeObjectiveScene(buildRunConfig("story", { seed: 1002 }));
    scene.scoring.snapshot = () => ({
      score: 100,
      combo: 1,
      kills: 1,
      maxCombo: 1,
      lastSaveCount: 1,
    });
    let result: any = null;
    scene.onRunEnd = (next: any) => {
      result = next;
    };

    scene.endRun("stage_objective_complete");

    expect(result).toMatchObject({
      modeId: "story",
      endReason: "stage_objective_complete",
      activeStoryStageId: "story-2",
      objectiveOutcome: "cleared",
      rankingSubmissionState: "notEligible",
      lastSaveCount: 1,
      protectedCount: 0,
      failedProtectCount: 0,
    });
  });

  it("returns ranked runs to mode selection for a fresh token instead of same-run retry", () => {
    const scene = makeObjectiveScene(buildRunConfig("ranked", { difficulty: "master", seed: 777, configVersion: "server-ranked-v1" }));
    let result: any = null;
    scene.onRunEnd = (next: any) => {
      result = next;
    };

    scene.endRun("earth_destroyed");

    expect(result).toMatchObject({
      modeId: "ranked",
      difficulty: "master",
      retryDestination: "modeSelect",
    });
  });

  it("keeps local ranked run results local-only when no server-verified start exists", () => {
    const scene = makeObjectiveScene(buildRunConfig("ranked", { difficulty: "elite", seed: 777 }));
    let result: any = null;
    scene.onRunEnd = (next: any) => {
      result = next;
    };

    scene.endRun("earth_destroyed");

    expect(result).toMatchObject({
      modeId: "ranked",
      difficulty: "elite",
      rankingEligible: false,
      rankingSubmissionState: "localOnly",
      retryDestination: "modeSelect",
    });
  });

  it("marks 60s Blitz timer expiry as survived and returns to mode selection", () => {
    const scene = makeObjectiveScene(buildRunConfig("blitz60", { seed: 20260705 }));
    let result: any = null;
    scene.onRunEnd = (next: any) => {
      result = next;
    };

    scene.endRun("timer_expired");

    expect(result).toMatchObject({
      modeId: "blitz60",
      endReason: "timer_expired",
      objectiveOutcome: "survived",
      rankingSubmissionState: "notEligible",
      retryDestination: "modeSelect",
    });
  });

  it("flushes local gameplay telemetry through the backend adapter on run end", () => {
    const scene = makeObjectiveScene(buildRunConfig("freeDefense", { seed: 77 }));

    scene.endRun("earth_destroyed");

    expect(scene.backend.trackEvent).toHaveBeenCalledWith(
      "death",
      expect.objectContaining({
        modeId: "freeDefense",
        difficulty: "rookie",
        runToken: "local",
        sessionTraceId: "test-session",
        screen: "game",
        runtime: "web_stub",
        eventSequence: 1,
      }),
    );
  });

  it("attaches platform runtime channel context to gameplay telemetry", () => {
    const scene = makeObjectiveScene(buildRunConfig("freeDefense", { seed: 88 }));
    scene.platformTelemetryContext = {
      runtime: "apps_in_toss",
      runtimeChannel: "toss_private_test",
      operationalEnvironment: "production",
      deploymentId: "deploy-1",
    };

    scene.endRun("earth_destroyed");

    expect(scene.backend.trackEvent).toHaveBeenCalledWith(
      "death",
      expect.objectContaining({
        runtime: "apps_in_toss",
        runtimeChannel: "toss_private_test",
        operationalEnvironment: "production",
        deploymentId: "deploy-1",
      }),
    );
  });

  it("emits ranked submission outcome updates after the backend accepts", async () => {
    const config = buildRunConfig("ranked", { difficulty: "rookie", seed: 777, configVersion: "server-ranked-v1" });
    const scene = makeObjectiveScene(config);
    scene.currentRunStart = createServerVerifiedRankedStart({
      difficulty: "rookie",
      seed: 777,
      runToken: "server-ranked-run-777",
      configVersion: "server-ranked-v1",
      issuedAtMs: Date.now() - 1000,
      expiresAtMs: Date.now() + 60_000,
    });
    scene.runSession.finish = (input: any) => ({
      modeId: "ranked",
      difficulty: "rookie",
      runToken: "server-ranked-run-777",
      seed: 777,
      rankingEligible: true,
      skillUse: {},
      ...input,
    });
    scene.backend = { submitRankedRun: async () => ({ accepted: true }), trackEvent: vi.fn(async () => undefined) };
    let result: any = null;
    let submissionState: any = null;
    scene.onRunEnd = (next: any) => {
      result = next;
    };
    scene.onRankedSubmissionUpdate = (next: any) => {
      submissionState = next;
    };

    scene.endRun("earth_destroyed");
    await Promise.resolve();
    await Promise.resolve();

    expect(result.rankingSubmissionState).toBe("pending");
    expect(submissionState).toBe("submitted");
    expect(scene.backend.trackEvent).toHaveBeenCalledWith("ranked_submission_validation", expect.objectContaining({ reason: "ok" }));
    expect(scene.backend.trackEvent).toHaveBeenCalledWith("ranked_submission_result", expect.objectContaining({ accepted: true }));
  });
});
