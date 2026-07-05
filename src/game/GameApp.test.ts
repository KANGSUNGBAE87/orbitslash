import { describe, expect, it } from "vitest";
import { devQaLaunchOptionsFromSearch, GameApp, resolveAdReviveReadiness, shouldAllowRunStart, shouldRecordProgressForRun } from "./GameApp";
import { FREE_DEFENSE_DAILY_PLAY_LIMIT, ProgressStore } from "./ProgressStore";
import { LocalBackendAdapter } from "../platform/BackendAdapter";
import { WebStubAdapter } from "../platform/WebStubAdapter";

describe("GameApp progress gate", () => {
  it("maps DEV boss QA query params into a selected Free Defense boss practice run", () => {
    expect(devQaLaunchOptionsFromSearch("freeDefense", "?qaPreset=boss&qaBoss=lava_titan")).toEqual({
      freeDefensePreset: "bossPractice",
      practiceBossId: "lava_titan",
    });
    expect(devQaLaunchOptionsFromSearch("freeDefense", "?qaPreset=boss&qaBoss=unknown")).toEqual({
      freeDefensePreset: "bossPractice",
      practiceBossId: "ringed_destroyer",
    });
    expect(devQaLaunchOptionsFromSearch("freeDefense", "?qaPreset=blockedBody")).toEqual({
      freeDefensePreset: "bossPractice",
      practiceBossId: "ringed_destroyer",
    });
  });

  it("forwards selected Story stage launch options into the active run config", async () => {
    const app = new GameApp();

    await (app as any).startRun("story", "play", { storyStageId: "story-8" });

    expect((app as any).state.runConfig.seed).toBe(1008);
  });

  it("routes settings through the app state machine", () => {
    const app = new GameApp();

    (app as any).shell.triggerHomeAction("settings");

    expect((app as any).state.screen).toBe("settings");
  });

  it("accepts injected platform and backend adapters instead of forcing the web stub", () => {
    const platform = new WebStubAdapter();
    const backend = new LocalBackendAdapter(42);
    const app = new GameApp({ platform, backend });

    expect((app as any).platform).toBe(platform);
    expect((app as any).rankingBackend).toBe(backend);
  });

  it("records normal runs but keeps DEV QA and practice runs out of progression", () => {
    expect(shouldRecordProgressForRun("play")).toBe(true);
    expect(shouldRecordProgressForRun("devQa")).toBe(false);
    expect(shouldRecordProgressForRun("practice" as any)).toBe(false);
  });

  it("blocks standard Free Defense starts after the daily free-play limit but still allows practice", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);
    for (let i = 0; i < FREE_DEFENSE_DAILY_PLAY_LIMIT; i += 1) {
      await store.recordResult({
        modeId: "freeDefense",
        difficulty: "rookie",
        endReason: "earth_destroyed",
        survivalMs: 10000,
        score: 100,
        kills: 2,
        maxCombo: 1,
        remainingEnergy: 0,
        rankingEligible: false,
        retryDestination: "sameRun",
      });
    }
    const snapshot = await store.load();

    expect(shouldAllowRunStart("freeDefense", "play", snapshot)).toBe(false);
    expect(shouldAllowRunStart("freeDefense", "practice", snapshot)).toBe(true);
    expect(shouldAllowRunStart("bossRush", "play", snapshot)).toBe(true);
  });

  it("keeps ad revive readiness disabled until both platform ads and remote telemetry are ready", async () => {
    const supportedPlatform = {
      rewardedAdCapability: async () => ({ supported: true as const, reason: "ready" as const }),
    };
    const remoteTelemetry = {
      rewardedAdTelemetryStatus: async () => ({
        ready: true,
        reason: "ready" as const,
        endpointConfigured: true,
        remoteEnabled: true,
        remoteVerified: true,
      }),
    };
    const unverifiedRemoteTelemetry = {
      rewardedAdTelemetryStatus: async () => ({
        ready: false,
        reason: "remote_unverified" as const,
        endpointConfigured: true,
        remoteEnabled: true,
        remoteVerified: false,
      }),
    };

    await expect(resolveAdReviveReadiness(new WebStubAdapter(), remoteTelemetry)).resolves.toMatchObject({
      adsAdapterReady: true,
      platformSupportsRewardedAd: false,
      rewardedTelemetryReady: true,
    });
    await expect(resolveAdReviveReadiness(supportedPlatform, new LocalBackendAdapter(1234))).resolves.toMatchObject({
      adsAdapterReady: true,
      platformSupportsRewardedAd: true,
      rewardedTelemetryReady: false,
    });
    await expect(resolveAdReviveReadiness(supportedPlatform, unverifiedRemoteTelemetry)).resolves.toMatchObject({
      adsAdapterReady: true,
      platformSupportsRewardedAd: true,
      rewardedTelemetryReady: false,
    });
    await expect(resolveAdReviveReadiness(supportedPlatform, remoteTelemetry)).resolves.toMatchObject({
      adsAdapterReady: true,
      platformSupportsRewardedAd: true,
      rewardedTelemetryReady: true,
    });
  });
});
