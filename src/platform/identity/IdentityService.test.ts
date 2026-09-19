import { describe, expect, it, vi } from "vitest";
import { AppsInTossAdapter } from "../AppsInTossAdapter";
import { GooglePlayAdapter } from "../GooglePlayAdapter";
import { WebStubAdapter } from "../WebStubAdapter";
import { IdentityService } from "./IdentityService";

describe("IdentityService", () => {
  it("starts anonymous and exposes loading while sign-in is pending", async () => {
    let completeLogin!: (value: { userId: string; provider: string }) => void;
    const login = vi.fn(
      () =>
        new Promise<{ userId: string; provider: string }>((resolve) => {
          completeLogin = resolve;
        }),
    );
    const service = new IdentityService({ login });

    expect(service.getState()).toEqual({ status: "anonymous" });

    const signIn = service.signIn();
    expect(service.getState()).toEqual({ status: "loading" });

    completeLogin({ userId: "core-user-1", provider: "google_play" });
    await expect(signIn).resolves.toEqual({
      status: "linked",
      internalUserId: "core-user-1",
      provider: "google_play",
    });
    expect(service.getState()).toEqual({
      status: "linked",
      internalUserId: "core-user-1",
      provider: "google_play",
    });
  });

  it("normalizes a platform login to an internal identity without provider raw fields", async () => {
    const service = new IdentityService({
      login: async () => ({
        userId: "  core-user-1  ",
        provider: "  google_play  ",
        rawCredential: "must-not-cross-boundary",
      }),
    });

    await expect(service.signIn()).resolves.toEqual({
      status: "linked",
      internalUserId: "core-user-1",
      provider: "google_play",
    });
  });

  it("exposes only a stable safe error when platform login throws", async () => {
    const service = new IdentityService({
      login: async () => {
        throw new Error("offline: raw provider detail");
      },
    });

    await expect(service.signIn()).resolves.toEqual({ status: "error", reason: "sign_in_failed" });
    expect(service.getState()).toEqual({ status: "error", reason: "sign_in_failed" });
    expect(JSON.stringify(service.getState())).not.toContain("offline");
  });

  it("rejects blank and non-string platform identities without leaking malformed values", async () => {
    const malformedResults = [
      { userId: "   ", provider: "google_play" },
      { userId: 42, provider: "google_play" },
      { userId: "core-user-1", provider: { rawSecret: "provider-secret" } },
    ];

    for (const malformedResult of malformedResults) {
      const service = new IdentityService({
        login: async () => malformedResult as never,
      });

      await expect(service.signIn()).resolves.toEqual({ status: "error", reason: "sign_in_failed" });
      expect(JSON.stringify(service.getState())).not.toContain("provider-secret");
    }
  });

  it("treats built-in platform fallback identities as anonymous", async () => {
    const states = await Promise.all([
      new IdentityService(new GooglePlayAdapter()).signIn(),
      new IdentityService(new AppsInTossAdapter()).signIn(),
      new IdentityService(new WebStubAdapter()).signIn(),
      new IdentityService({
        login: async () => ({ userId: " google-play-anonymous ", provider: " google_play " }),
      }).signIn(),
    ]);

    expect(states).toEqual([
      { status: "anonymous" },
      { status: "anonymous" },
      { status: "anonymous" },
      { status: "anonymous" },
    ]);
  });

  it("deduplicates concurrent sign-in attempts and prevents prompt races", async () => {
    let completeLogin!: (value: { userId: string; provider: string }) => void;
    const login = vi.fn(
      () =>
        new Promise<{ userId: string; provider: string }>((resolve) => {
          completeLogin = resolve;
        }),
    );
    const service = new IdentityService({ login });

    const first = service.signIn();
    const second = service.signIn();

    expect(login).toHaveBeenCalledTimes(1);
    expect(service.getState()).toEqual({ status: "loading" });

    completeLogin({ userId: "core-user-2", provider: "apps_in_toss" });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: "linked", internalUserId: "core-user-2", provider: "apps_in_toss" },
      { status: "linked", internalUserId: "core-user-2", provider: "apps_in_toss" },
    ]);
    expect(service.getState()).toEqual({
      status: "linked",
      internalUserId: "core-user-2",
      provider: "apps_in_toss",
    });
  });

  it("returns an established linked identity without prompting the platform again", async () => {
    const login = vi.fn(async () => ({ userId: "core-user-linked", provider: "google_play" }));
    const service = new IdentityService({ login });

    const linked = await service.signIn();

    await expect(service.signIn()).resolves.toBe(linked);
    expect(login).toHaveBeenCalledOnce();
    expect(service.getState()).toBe(linked);
  });

  it("clears a failed in-flight attempt so a later sign-in can retry", async () => {
    const login = vi
      .fn()
      .mockRejectedValueOnce(new Error("first raw failure"))
      .mockResolvedValueOnce({ userId: "core-user-retry", provider: "google_play" });
    const service = new IdentityService({ login });

    await expect(service.signIn()).resolves.toEqual({ status: "error", reason: "sign_in_failed" });
    await expect(service.signIn()).resolves.toEqual({
      status: "linked",
      internalUserId: "core-user-retry",
      provider: "google_play",
    });
    expect(login).toHaveBeenCalledTimes(2);
  });

  it("returns only non-empty verified session access tokens", async () => {
    const valid = new IdentityService({
      login: async () => ({ userId: "unused", provider: "test" }),
      getVerifiedSessionAccessToken: async () => "verified-token",
    });
    const blank = new IdentityService({
      login: async () => ({ userId: "unused", provider: "test" }),
      getVerifiedSessionAccessToken: async () => "   ",
    });

    await expect(valid.getVerifiedSessionAccessToken()).resolves.toBe("verified-token");
    await expect(blank.getVerifiedSessionAccessToken()).resolves.toBeNull();
  });

  it("returns null when verified session token access is absent or fails", async () => {
    const absent = new IdentityService({ login: async () => ({ userId: "unused", provider: "test" }) });
    const failed = new IdentityService({
      login: async () => ({ userId: "unused", provider: "test" }),
      getVerifiedSessionAccessToken: async () => {
        throw new Error("raw token failure");
      },
    });

    await expect(absent.getVerifiedSessionAccessToken()).resolves.toBeNull();
    await expect(failed.getVerifiedSessionAccessToken()).resolves.toBeNull();
  });
});
