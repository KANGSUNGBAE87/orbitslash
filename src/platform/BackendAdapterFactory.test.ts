import { describe, expect, it, vi } from "vitest";
import { LocalBackendAdapter } from "./BackendAdapter";
import { createDefaultBackendAdapter } from "./BackendAdapterFactory";
import { SupabaseEdgeBackendAdapter } from "./SupabaseEdgeBackendAdapter";

describe("createDefaultBackendAdapter", () => {
  it("uses the local adapter when public Supabase env is absent", () => {
    expect(createDefaultBackendAdapter({})).toBeInstanceOf(LocalBackendAdapter);
  });

  it("uses the Supabase Edge adapter only with public env values", () => {
    const adapter = createDefaultBackendAdapter({
      VITE_SUPABASE_URL: "https://example.supabase.co/",
      VITE_SUPABASE_ANON_KEY: "anon-key",
    });

    expect(adapter).toBeInstanceOf(SupabaseEdgeBackendAdapter);
  });

  it("keeps friend challenge disabled until remote and liveops evidence flags are both explicit", async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    const adapter = createDefaultBackendAdapter({
      VITE_SUPABASE_URL: "https://example.supabase.co/",
      VITE_SUPABASE_ANON_KEY: "anon-key",
      VITE_FRIEND_CHALLENGE_REMOTE_ENABLED: "true",
      fetch: fetchMock,
    });

    await expect(adapter.createFriendChallenge({ seed: 1, difficulty: "rookie", rulesHash: "rules-1", rulesVersion: 1, configVersion: "config-1", expiresAt: "2026-08-01T00:00:00.000Z" })).resolves.toEqual({
      accepted: false,
      reason: "friend_challenge_remote_not_enabled",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the default Supabase ad telemetry endpoint in local-draft mode until explicitly enabled", async () => {
    const fetchMock = (() => {
      throw new Error("should not post ad telemetry before remote enable");
    }) as typeof fetch;
    const adapter = createDefaultBackendAdapter({
      VITE_SUPABASE_URL: "https://example.supabase.co/",
      VITE_SUPABASE_ANON_KEY: "anon-key",
      fetch: fetchMock,
    });

    await expect(adapter.rewardedAdTelemetryStatus()).resolves.toEqual({
      ready: false,
      reason: "remote_not_enabled",
      endpointConfigured: true,
      remoteEnabled: false,
      remoteVerified: false,
    });
    await expect(
      adapter.recordRewardedAdEvent({
        clientEventId: "evt-1",
        sessionTraceId: "session-1",
        eventName: "show_requested",
        placement: "free_defense_revive",
        atMs: 1,
        clientAt: "2026-07-05T00:00:00.000Z",
        screen: "modeDetail",
        runtime: "web_stub",
        eventSequence: 1,
      }),
    ).resolves.toEqual({ accepted: false, reason: "ad_telemetry_remote_not_enabled" });
  });

  it("posts rewarded-ad telemetry only when the remote telemetry flag is explicit", async () => {
    const calls: string[] = [];
    const adapter = createDefaultBackendAdapter({
      VITE_SUPABASE_URL: "https://example.supabase.co/",
      VITE_SUPABASE_ANON_KEY: "anon-key",
      VITE_REWARDED_AD_TELEMETRY_REMOTE_ENABLED: "true",
      fetch: (async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return new Response(JSON.stringify({ ok: true, accepted: true }), { status: 200 });
      }) as typeof fetch,
    });

    await expect(
      adapter.recordRewardedAdEvent({
        clientEventId: "evt-1",
        sessionTraceId: "session-1",
        eventName: "show_requested",
        placement: "free_defense_revive",
        atMs: 1,
        clientAt: "2026-07-05T00:00:00.000Z",
        screen: "modeDetail",
        runtime: "web_stub",
        eventSequence: 1,
      }),
    ).resolves.toEqual({ accepted: true });
    expect(calls).toEqual(["https://example.supabase.co/functions/v1/orbitslash-rewarded-ad-telemetry"]);
    await expect(adapter.rewardedAdTelemetryStatus()).resolves.toMatchObject({
      ready: true,
      reason: "ready",
      remoteVerified: true,
    });
  });

  it("keeps the default Supabase gameplay telemetry endpoint in local-draft mode until explicitly enabled", async () => {
    const fetchMock = (() => {
      throw new Error("should not post gameplay telemetry before remote enable");
    }) as typeof fetch;
    const adapter = createDefaultBackendAdapter({
      VITE_SUPABASE_URL: "https://example.supabase.co/",
      VITE_SUPABASE_ANON_KEY: "anon-key",
      fetch: fetchMock,
    });

    await expect(adapter.gameplayTelemetryStatus()).resolves.toEqual({
      ready: false,
      reason: "remote_not_enabled",
      endpointConfigured: true,
      remoteEnabled: false,
      remoteVerified: false,
    });
    await expect(
      adapter.recordGameplayEvent({
        clientEventId: "gameplay-evt-1",
        sessionTraceId: "session-1",
        eventName: "spawn",
        atMs: 1,
        clientAt: "2026-07-05T00:00:00.000Z",
        screen: "game",
        runtime: "web_stub",
        eventSequence: 1,
      }),
    ).resolves.toEqual({ accepted: false, reason: "gameplay_telemetry_remote_not_enabled" });
  });

  it("posts gameplay telemetry only when the remote telemetry flag is explicit", async () => {
    const calls: string[] = [];
    const adapter = createDefaultBackendAdapter({
      VITE_SUPABASE_URL: "https://example.supabase.co/",
      VITE_SUPABASE_ANON_KEY: "anon-key",
      VITE_GAMEPLAY_TELEMETRY_REMOTE_ENABLED: "true",
      fetch: (async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return new Response(JSON.stringify({ ok: true, accepted: true }), { status: 200 });
      }) as typeof fetch,
    });

    await expect(
      adapter.recordGameplayEvent({
        clientEventId: "gameplay-evt-1",
        sessionTraceId: "session-1",
        eventName: "spawn",
        atMs: 1,
        clientAt: "2026-07-05T00:00:00.000Z",
        screen: "game",
        runtime: "web_stub",
        eventSequence: 1,
      }),
    ).resolves.toEqual({ accepted: true });
    expect(calls).toEqual(["https://example.supabase.co/functions/v1/orbitslash-gameplay-telemetry"]);
    await expect(adapter.gameplayTelemetryStatus()).resolves.toMatchObject({
      ready: true,
      reason: "ready",
      remoteVerified: true,
    });
  });

  it("keeps public leaderboard rows disabled until the public leaderboard flag is explicit", async () => {
    const fetchMock = (() => {
      throw new Error("should not fetch public leaderboard before flag");
    }) as typeof fetch;
    const adapter = createDefaultBackendAdapter({
      VITE_SUPABASE_URL: "https://example.supabase.co/",
      VITE_SUPABASE_ANON_KEY: "anon-key",
      fetch: fetchMock,
    });

    await expect(adapter.publicLeaderboardRows()).resolves.toEqual({
      status: { publicAvailable: false, reason: "edge_not_deployed" },
      rows: [],
    });
  });

  it("treats public Supabase env as local-draft ranked until the ranked Edge flag is explicit", async () => {
    const fetchMock = (() => {
      throw new Error("should not call ranked edge before remote enable");
    }) as typeof fetch;
    const adapter = createDefaultBackendAdapter({
      VITE_SUPABASE_URL: "https://example.supabase.co/",
      VITE_SUPABASE_ANON_KEY: "anon-key",
      VITE_PUBLIC_LEADERBOARD_ENABLED: "true",
      fetch: fetchMock,
    });

    await expect(adapter.beginRankedRun("rookie")).rejects.toThrow("ranked_edge_remote_not_enabled");
    await expect(adapter.leaderboardStatus()).resolves.toEqual({
      publicAvailable: false,
      reason: "edge_not_deployed",
    });
    await expect(adapter.publicLeaderboardRows()).resolves.toEqual({
      status: { publicAvailable: false, reason: "edge_not_deployed" },
      rows: [],
    });
  });

  it("enables public leaderboard fetch only when ranked Edge and leaderboard flags are explicit", async () => {
    const calls: string[] = [];
    const adapter = createDefaultBackendAdapter({
      VITE_SUPABASE_URL: "https://example.supabase.co/",
      VITE_SUPABASE_ANON_KEY: "anon-key",
      VITE_RANKED_EDGE_REMOTE_ENABLED: "true",
      VITE_PUBLIC_LEADERBOARD_ENABLED: "true",
      fetch: (async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return new Response(JSON.stringify({ ok: false, reason: "identity_bound_runs_missing" }), { status: 409 });
      }) as typeof fetch,
    });

    await expect(adapter.publicLeaderboardRows()).resolves.toEqual({
      status: { publicAvailable: false, reason: "identity_bound_runs_missing" },
      rows: [],
    });
    expect(calls).toEqual(["https://example.supabase.co/functions/v1/orbitslash-ranked-run"]);
  });
});
