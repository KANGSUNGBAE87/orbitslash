import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { GooglePlayAdapter } from "../GooglePlayAdapter";
import { validatePublicRankedStart } from "../BackendAdapter";
import { IdentityService } from "../identity/IdentityService";
import { GameApp } from "../../game/GameApp";
import { GooglePlayBridge } from "./GooglePlayBridge";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Google Play Capacitor bridge", () => {
  it("fails closed when the Android native bridge is unavailable", async () => {
    const bridge = new GooglePlayBridge({ isNativePlatform: () => false, getPlugin: () => undefined });
    const adapter = new GooglePlayAdapter(bridge);

    await expect(adapter.getVerifiedSessionAccessToken()).resolves.toBeNull();
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
    await expect(adapter.purchase("supporter_pack")).resolves.toEqual({
      success: false,
      productId: "supporter_pack",
      reason: "platform_not_supported",
    });
    await expect(adapter.restorePurchases()).resolves.toEqual({ supported: false, productIds: [] });
    await expect(adapter.safeAreaInsets()).resolves.toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("keeps an unsupported Google Play bridge anonymous and ineligible for public ranked", async () => {
    const adapter = new GooglePlayAdapter();
    const identity = new IdentityService(adapter);
    const authorizationHeaders: HeadersInit[] = [];
    const app = new GameApp({
      platform: adapter,
      backendEnv: {
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_ANON_KEY: "anon-key",
        VITE_RANKED_EDGE_REMOTE_ENABLED: "true",
        fetch: (async (_input: RequestInfo | URL, init?: RequestInit) => {
          authorizationHeaders.push(init?.headers ?? {});
          return new Response(JSON.stringify({ ok: false, reason: "identity_required" }), { status: 401 });
        }) as typeof fetch,
      },
    });

    await expect(identity.signIn()).resolves.toEqual({ status: "anonymous" });
    await expect(identity.getVerifiedSessionAccessToken()).resolves.toBeNull();
    await expect((app as any).rankingBackend.beginRankedRun("rookie")).rejects.toThrow("identity_required");
    expect(authorizationHeaders[0]).toMatchObject({ Authorization: "Bearer anon-key" });
    expect(validatePublicRankedStart({
      modeId: "ranked",
      runToken: "local-ranked-token",
      seed: 1,
      difficulty: "rookie",
      verification: "local_stub",
      rankingEligible: false,
      identityBound: false,
    }).ok).toBe(false);
  });

  it("passes only a native server-issued session token to the runtime provider", async () => {
    const plugin = {
      getVerifiedSession: vi.fn(async () => ({ status: "linked" as const, accessToken: "server-issued-session" })),
      rewardedAdCapability: vi.fn(async () => ({ supported: true, reason: "ready" as const })),
      showRewardedAd: vi.fn(async () => ({ shown: true, rewarded: true, rewardEarned: true, dismissed: true })),
      purchase: vi.fn(async ({ productId }: { productId: string }) => ({ productId, state: "pending_verification" as const })),
      restorePurchases: vi.fn(async () => ({ supported: true, productIds: ["supporter_pack"] })),
      getSafeAreaInsets: vi.fn(async () => ({ top: 12, right: 0, bottom: 24, left: 0 })),
    };
    const bridge = new GooglePlayBridge({ isNativePlatform: () => true, getPlugin: () => plugin });
    const adapter = new GooglePlayAdapter(bridge);

    await expect(adapter.getVerifiedSessionAccessToken()).resolves.toBe("server-issued-session");
    await expect(adapter.rewardedAdCapability()).resolves.toEqual({ supported: true, reason: "ready" });
    await expect(adapter.showRewardedAd()).resolves.toMatchObject({ rewardEarned: true, dismissed: true });
    await expect(adapter.purchase("supporter_pack")).resolves.toEqual({
      success: false,
      productId: "supporter_pack",
      reason: "verification_required",
    });
    await expect(adapter.restorePurchases()).resolves.toEqual({ supported: true, productIds: ["supporter_pack"] });
    await expect(adapter.safeAreaInsets()).resolves.toEqual({ top: 12, right: 0, bottom: 24, left: 0 });
  });

  it("maps only app lifecycle events and releases the native listener", async () => {
    const remove = vi.fn(async () => undefined);
    const addListener = vi.fn(async (_event: string, listener: (event: { state?: string }) => void) => {
      listener({ state: "background" });
      listener({ state: "unexpected" });
      listener({ state: "foreground" });
      return { remove };
    });
    const events: string[] = [];
    const bridge = new GooglePlayBridge({ isNativePlatform: () => true, getPlugin: () => ({ addListener }) });

    const unsubscribe = await bridge.subscribeLifecycle((event) => events.push(event));
    await unsubscribe();

    expect(events).toEqual(["background", "foreground"]);
    expect(addListener).toHaveBeenCalledWith("lifecycle", expect.any(Function));
    expect(remove).toHaveBeenCalledOnce();
  });

  it("routes native lifecycle events through the same GameApp pause and explicit-resume guard", async () => {
    let nativeListener: ((event: "background" | "foreground") => void) | undefined;
    const adapter = new GooglePlayAdapter({
      subscribeLifecycle: async (listener) => {
        nativeListener = listener;
        return async () => undefined;
      },
    });
    const app = new GameApp({ platform: adapter });
    const cancelActivePointer = vi.fn();
    (app as any).scene = { cancelActivePointer };
    (app as any).state = { ...(app as any).state, screen: "gameplay" };

    await (app as any).bindPlatformLifecycle();
    nativeListener?.("background");
    nativeListener?.("foreground");

    expect(cancelActivePointer).toHaveBeenCalledOnce();
    expect((app as any).lifecycle.canAdvance()).toBe(false);
    expect((app as any).shell.pauseOverlayVisible()).toBe(true);
  });
});

describe("Google Play shell source boundary", () => {
  it("registers the native Capacitor proxy inside the platform boundary", () => {
    const bridgeSource = readFileSync(resolve(projectRoot, "src/platform/google-play/GooglePlayBridge.ts"), "utf8");

    expect(bridgeSource).toContain('registerPlugin<NativeGooglePlayPlugin>("OrbitSlashGooglePlay")');
    expect(bridgeSource).toContain('Capacitor.isPluginAvailable("OrbitSlashGooglePlay")');
  });

  it("keeps platform SDK identifiers out of game and render and validates the generated Android shell", () => {
    const script = resolve(projectRoot, "scripts/check-google-play-shell.mjs");
    const config = resolve(projectRoot, "capacitor.config.ts");
    const activity = resolve(projectRoot, "android/app/src/main/java/com/kangsungbae/orbitslash/MainActivity.kt");

    expect(readFileSync(config, "utf8")).toContain('appId: "com.kangsungbae.orbitslash"');
    expect(readFileSync(activity, "utf8")).toContain("class MainActivity");
    expect(readFileSync(activity, "utf8")).not.toMatch(/BillingClient|AdMob|CredentialManager/);
    expect(() => execFileSync("node", [script], { cwd: projectRoot, stdio: "pipe" })).not.toThrow();
  });

  it("pins generated Android instrumentation metadata to the Orbit Slash package", () => {
    const instrumentedTest = readFileSync(
      resolve(projectRoot, "android/app/src/androidTest/java/com/kangsungbae/orbitslash/ExampleInstrumentedTest.java"),
      "utf8",
    );
    const shellCheck = readFileSync(resolve(projectRoot, "scripts/check-google-play-shell.mjs"), "utf8");

    expect(instrumentedTest).toContain("package com.kangsungbae.orbitslash;");
    expect(instrumentedTest).toContain('assertEquals("com.kangsungbae.orbitslash", appContext.getPackageName())');
    expect(shellCheck).toContain("ExampleInstrumentedTest.java");
    expect(shellCheck).toContain("com.kangsungbae.orbitslash");
  });

  it("requires a native plugin safe-contract smoke test instead of an arithmetic placeholder", () => {
    const unitTest = readFileSync(
      resolve(projectRoot, "android/app/src/test/java/com/kangsungbae/orbitslash/ExampleUnitTest.java"),
      "utf8",
    );
    const plugin = readFileSync(
      resolve(projectRoot, "android/app/src/main/java/com/kangsungbae/orbitslash/OrbitSlashGooglePlayPlugin.kt"),
      "utf8",
    );
    const shellCheck = readFileSync(resolve(projectRoot, "scripts/check-google-play-shell.mjs"), "utf8");

    expect(unitTest).toContain("usesSafeUnsupportedPluginContract");
    expect(unitTest).toContain("OrbitSlashGooglePlayPlugin.PLUGIN_NAME");
    expect(unitTest).toContain("OrbitSlashGooglePlayPlugin.UNSUPPORTED_SESSION_STATUS");
    expect(unitTest).not.toContain("2 + 2");
    expect(plugin).toContain('const val PLUGIN_NAME = "OrbitSlashGooglePlay"');
    expect(plugin).toContain('const val UNSUPPORTED_REASON = "platform_not_supported"');
    expect(shellCheck).toContain("usesSafeUnsupportedPluginContract");
    expect(shellCheck).toContain("additionIsCorrect");
  });
});
