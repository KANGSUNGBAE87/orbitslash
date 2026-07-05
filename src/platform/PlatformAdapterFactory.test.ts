import { describe, expect, it } from "vitest";
import { AppsInTossAdapter } from "./AppsInTossAdapter";
import { GooglePlayAdapter } from "./GooglePlayAdapter";
import { createDefaultPlatformAdapter, resolvePlatformTarget } from "./PlatformAdapterFactory";
import { WebStubAdapter } from "./WebStubAdapter";

describe("PlatformAdapterFactory", () => {
  it("defaults to the web stub when no platform target or bridge is present", () => {
    expect(resolvePlatformTarget({}, {})).toBe("web");
    expect(createDefaultPlatformAdapter({}, {})).toBeInstanceOf(WebStubAdapter);
  });

  it("selects Apps in Toss through explicit env or runtime bridge", async () => {
    const bridge = { login: async () => ({ internalUserId: "core-toss" }) };

    expect(resolvePlatformTarget({ VITE_PLATFORM_TARGET: "apps_in_toss" }, {})).toBe("apps_in_toss");
    expect(resolvePlatformTarget({}, { appsInTossBridge: bridge })).toBe("apps_in_toss");

    const adapter = createDefaultPlatformAdapter({ VITE_PLATFORM_TARGET: "apps_in_toss" }, { appsInTossBridge: bridge });
    expect(adapter).toBeInstanceOf(AppsInTossAdapter);
    await expect(adapter.login()).resolves.toEqual({ userId: "core-toss", provider: "apps_in_toss" });
    expect(adapter.telemetryContext()).toEqual({ runtime: "apps_in_toss", runtimeChannel: "sandbox" });
  });

  it("selects Google Play through explicit env or runtime bridge", async () => {
    const bridge = { login: async () => ({ internalUserId: "core-google" }) };

    expect(resolvePlatformTarget({ VITE_PLATFORM_TARGET: "google_play" }, {})).toBe("google_play");
    expect(resolvePlatformTarget({}, { googlePlayBridge: bridge })).toBe("google_play");

    const adapter = createDefaultPlatformAdapter({ VITE_PLATFORM_TARGET: "google_play" }, { googlePlayBridge: bridge });
    expect(adapter).toBeInstanceOf(GooglePlayAdapter);
    await expect(adapter.login()).resolves.toEqual({ userId: "core-google", provider: "google_play" });
    expect(adapter.telemetryContext()).toEqual({ runtime: "google_play" });
  });
});
