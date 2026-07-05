import { describe, expect, it } from "vitest";
import { AppsInTossAdapter, resolveAppsInTossRuntimeChannel } from "./AppsInTossAdapter";
import { GooglePlayAdapter } from "./GooglePlayAdapter";
import { WebStubAdapter } from "./WebStubAdapter";

describe("rewarded ad platform boundary", () => {
  it("keeps the web stub unsupported with no earned reward or dismiss lifecycle", async () => {
    const adapter = new WebStubAdapter();

    await expect(adapter.rewardedAdCapability()).resolves.toEqual({
      supported: false,
      reason: "platform_not_supported",
    });
    expect(adapter.telemetryContext()).toEqual({ runtime: "web_stub" });
    await expect(adapter.showRewardedAd()).resolves.toMatchObject({
      shown: false,
      rewardEarned: false,
      dismissed: false,
      reason: "platform_not_supported",
    });
  });
});

describe("platform shell adapters", () => {
  it("keeps Apps in Toss features behind injected bridge methods", async () => {
    const events: unknown[] = [];
    const adapter = new AppsInTossAdapter({
      login: async () => ({ internalUserId: "core-1" }),
      rewardedAdCapability: async () => ({ supported: true, reason: "ready" }),
      showRewardedAd: async () => ({
        shown: true,
        rewarded: true,
        rewardEarned: true,
        dismissed: true,
      }),
      purchase: async (productId) => ({ success: false, productId, reason: "platform_not_supported" }),
      haptic: (kind) => events.push({ haptic: kind }),
      trackAnalyticsEvent: async (event) => {
        events.push(event);
      },
    });

    await expect(adapter.login()).resolves.toEqual({ userId: "core-1", provider: "apps_in_toss" });
    expect(adapter.telemetryContext()).toEqual({ runtime: "apps_in_toss", runtimeChannel: "sandbox" });
    await expect(adapter.rewardedAdCapability()).resolves.toEqual({ supported: true, reason: "ready" });
    await expect(adapter.showRewardedAd()).resolves.toMatchObject({ rewardEarned: true, dismissed: true });
    await expect(adapter.purchase("starter_pack")).resolves.toEqual({
      success: false,
      productId: "starter_pack",
      reason: "platform_not_supported",
    });
    adapter.haptic("heavy");
    await adapter.trackAnalyticsEvent({ eventName: "mode_open", atMs: 1, screen: "modeDetail" });
    expect(events).toEqual([{ haptic: "heavy" }, { eventName: "mode_open", atMs: 1, screen: "modeDetail" }]);
  });

  it("keeps Google Play features behind injected bridge methods with safe defaults", async () => {
    const adapter = new GooglePlayAdapter();

    await expect(adapter.login()).resolves.toEqual({ userId: "google-play-anonymous", provider: "google_play" });
    expect(adapter.telemetryContext()).toEqual({ runtime: "google_play" });
    await expect(adapter.rewardedAdCapability()).resolves.toEqual({
      supported: false,
      reason: "platform_not_supported",
    });
    await expect(adapter.showRewardedAd()).resolves.toMatchObject({
      shown: false,
      rewardEarned: false,
      dismissed: false,
      reason: "platform_not_supported",
    });
    await expect(adapter.purchase("starter_pack")).resolves.toEqual({
      success: false,
      productId: "starter_pack",
      reason: "platform_not_supported",
    });

    await adapter.storageSet("progress", "ok");
    await expect(adapter.storageGet("progress")).resolves.toBe("ok");
  });

  it("classifies Apps in Toss runtime channels from bridge and URL hints", () => {
    expect(resolveAppsInTossRuntimeChannel({ operationalEnvironment: "sandbox" })).toBe("sandbox");
    expect(resolveAppsInTossRuntimeChannel({ href: "intoss-private://orbitslash", deploymentId: "dep-1" })).toBe("toss_private_test");
    expect(resolveAppsInTossRuntimeChannel({ host: "private-apps.tossmini.com" })).toBe("toss_private_test");
    expect(resolveAppsInTossRuntimeChannel({ href: "intoss://orbitslash" })).toBe("toss_live");
    expect(resolveAppsInTossRuntimeChannel({ host: "apps.tossmini.com" })).toBe("toss_live");
    expect(resolveAppsInTossRuntimeChannel({ runtimeChannel: "toss_private_test" })).toBe("toss_private_test");
  });
});
