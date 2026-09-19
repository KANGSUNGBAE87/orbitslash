import { describe, expect, it } from "vitest";
import bridgeSource from "./AppsInTossBridge.ts?raw";
import { AppsInTossBridge } from "./AppsInTossBridge";

describe("AppsInTossBridge", () => {
  it("fails closed without a supported SDK and never fabricates an identity or token", async () => {
    const bridge = new AppsInTossBridge({ isAvailable: () => false });

    await expect(bridge.login?.()).resolves.toBeUndefined();
    await expect(bridge.getVerifiedSessionAccessToken?.()).resolves.toBeNull();
    await expect(bridge.rewardedAdCapability?.()).resolves.toEqual({
      supported: false,
      reason: "platform_not_supported",
    });
    await expect(bridge.showRewardedAd?.()).resolves.toMatchObject({
      shown: false,
      rewardEarned: false,
      dismissed: false,
      reason: "platform_not_supported",
    });
  });

  it("keeps the default detected bridge ad path disabled without a verified injected SDK bridge", async () => {
    const bridge = new AppsInTossBridge();

    await expect(bridge.rewardedAdCapability?.()).resolves.toEqual({
      supported: false,
      reason: "platform_not_supported",
    });
    await expect(bridge.showRewardedAd?.()).resolves.toMatchObject({
      shown: false,
      rewardEarned: false,
      dismissed: false,
      reason: "platform_not_supported",
    });
    expect(bridgeSource).not.toContain("AdLoadCoordinator");
  });

  it("exposes only a verified internal session and safe runtime metadata", async () => {
    const bridge = new AppsInTossBridge({
      isAvailable: () => true,
      getVerifiedSession: async () => ({
        internalUserId: "core-user-7",
        accessToken: "server-issued-session",
      }),
      runtimeHints: () => ({
        protocol: "intoss-private:",
        deploymentId: "deployment-7",
        operationalEnvironment: "sandbox",
      }),
    });

    await expect(bridge.login?.()).resolves.toEqual({ internalUserId: "core-user-7" });
    await expect(bridge.getVerifiedSessionAccessToken?.()).resolves.toBe("server-issued-session");
    expect(bridge.runtimeHints?.()).toEqual({
      protocol: "intoss-private:",
      deploymentId: "deployment-7",
      operationalEnvironment: "sandbox",
    });
  });

  it("reports reward earned and dismissal as separate lifecycle results", async () => {
    const bridge = new AppsInTossBridge({
      isAvailable: () => true,
      showRewardedAd: async ({ onRewardEarned, onDismissed }) => {
        onRewardEarned();
        expect(onDismissed).toBeTypeOf("function");
        onDismissed();
      },
    });

    await expect(bridge.showRewardedAd?.()).resolves.toEqual({
      shown: true,
      rewarded: true,
      rewardEarned: true,
      dismissed: true,
    });
  });

  it("does not mark a dismissed ad as rewarded", async () => {
    const bridge = new AppsInTossBridge({
      isAvailable: () => true,
      showRewardedAd: async ({ onDismissed }) => onDismissed(),
    });

    await expect(bridge.showRewardedAd?.()).resolves.toEqual({
      shown: true,
      rewarded: false,
      rewardEarned: false,
      dismissed: true,
      reason: "dismissed_without_reward",
    });
  });

  it("forwards safe storage, haptic, insets, and lifecycle contracts without raw provider identity fields", async () => {
    let lifecycleListener: ((event: "background" | "foreground") => void) | undefined;
    const haptics: string[] = [];
    const bridge = new AppsInTossBridge({
      isAvailable: () => true,
      storageGet: async (key) => (key === "progress" ? "saved" : null),
      storageSet: async () => undefined,
      haptic: (kind) => haptics.push(kind),
      safeAreaInsets: () => ({ top: 12, right: 0, bottom: 24, left: 0 }),
      subscribeLifecycle: (listener) => {
        lifecycleListener = listener;
        return () => undefined;
      },
    });
    const events: string[] = [];

    await expect(bridge.storageGet?.("progress")).resolves.toBe("saved");
    await expect(bridge.storageSet?.("progress", "next")).resolves.toBeUndefined();
    bridge.haptic?.("medium");
    await expect(bridge.safeAreaInsets?.()).resolves.toEqual({ top: 12, right: 0, bottom: 24, left: 0 });
    const unsubscribe = await bridge.subscribeLifecycle?.((event) => events.push(event));
    lifecycleListener?.("background");
    await unsubscribe?.();

    expect(haptics).toEqual(["medium"]);
    expect(events).toEqual(["background"]);
    expect(bridgeSource).not.toMatch(/userKey|getUserKeyForGame|providerUserId/);
  });
});
