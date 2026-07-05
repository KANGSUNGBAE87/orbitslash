import { describe, expect, it } from "vitest";
import { buildRunConfig } from "./ModeConfig";
import { resolveReviveAvailability } from "./RevivePolicy";

describe("RevivePolicy", () => {
  it("keeps Free Defense ad revive locked until the ad adapter and telemetry path are ready", () => {
    const state = resolveReviveAvailability(buildRunConfig("freeDefense", { seed: 1 }));

    expect(state.enabled).toBe(false);
    expect(state.reason).toBe("ads_adapter_missing");
  });

  it("enables ad revive only when adapter support, platform support, and telemetry are all ready", () => {
    const state = resolveReviveAvailability(buildRunConfig("freeDefense", { seed: 1 }), {
      adsAdapterReady: true,
      platformSupportsRewardedAd: true,
      rewardedTelemetryReady: true,
    });

    expect(state).toMatchObject({ enabled: true, reason: "ready" });
  });

  it("keeps ranked runs non-revivable even if platform ad capability exists", () => {
    const state = resolveReviveAvailability(buildRunConfig("ranked", { seed: 1 }), {
      adsAdapterReady: true,
      platformSupportsRewardedAd: true,
      rewardedTelemetryReady: true,
    });

    expect(state).toMatchObject({ enabled: false, reason: "policy_not_ad_revive" });
  });
});
