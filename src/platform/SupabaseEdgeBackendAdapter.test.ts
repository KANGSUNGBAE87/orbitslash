import { describe, expect, it, vi } from "vitest";
import { createRunSummary } from "../game/RankingSystem";
import { SupabaseEdgeBackendAdapter } from "./SupabaseEdgeBackendAdapter";
import { RANKED_CORE_RULES_HASH, RANKED_CORE_SCHEMA_VERSION } from "../../shared/ranked-core";

describe("SupabaseEdgeBackendAdapter", () => {
  it("routes only the pinned contract and opaque token through the friend challenge Edge boundary", async () => {
    const calls: Array<{ input: string; body: Record<string, unknown> }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({ input: String(input), body });
      if (body.action === "create") return new Response(JSON.stringify({ ok: true, challengeId: "challenge-1", token: "osc1_server_random", created: true }), { status: 200 });
      if (body.action === "list") return new Response(JSON.stringify({ ok: true, challenges: [{
        id: "challenge-1", seed: 34199, difficulty: "elite", rulesHash: "rules-1", rulesVersion: 4,
        configVersion: "config-1", expiresAt: "2026-08-01T00:00:00.000Z", status: "open",
      }] }), { status: 200 });
      return new Response(JSON.stringify({ ok: true, accepted: true, result: { score: 900, survivalMs: 60_000, kills: 20, maxCombo: 4, verifiedAt: "2026-07-11T00:00:00.000Z" } }), { status: 200 });
    });
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchMock as unknown as typeof fetch, {
      friendChallengeEndpointUrl: "https://example.functions/orbitslash-friend-challenge",
      friendChallengeRemoteEnabled: true,
      liveOpsEvidenceVerified: true,
    });
    const contract = { seed: 34199, difficulty: "elite", rulesHash: "rules-1", rulesVersion: 4, configVersion: "config-1", expiresAt: "2026-08-01T00:00:00.000Z" };

    await expect(adapter.createFriendChallenge(contract)).resolves.toEqual({ accepted: true, challengeId: "challenge-1", token: "osc1_server_random" });
    await expect(adapter.listFriendChallenges()).resolves.toEqual({
      available: true,
      challenges: [{ id: "challenge-1", ...contract, status: "open" }],
    });
    await expect(adapter.acceptFriendChallenge("osc1_server_random", "server-ranked-run")).resolves.toEqual({
      accepted: true,
      result: { score: 900, survivalMs: 60_000, kills: 20, maxCombo: 4, verifiedAt: "2026-07-11T00:00:00.000Z" },
    });

    expect(calls).toEqual([
      { input: "https://example.functions/orbitslash-friend-challenge", body: { action: "create", ...contract } },
      { input: "https://example.functions/orbitslash-friend-challenge", body: { action: "list" } },
      { input: "https://example.functions/orbitslash-friend-challenge", body: { action: "accept", token: "osc1_server_random", runToken: "server-ranked-run" } },
    ]);
    expect(JSON.stringify(calls)).not.toMatch(/providerUserId|friendList|userKey/);
  });

  it("keeps friend challenge calls closed until both remote and liveops evidence flags are explicit", async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchMock, {
      friendChallengeEndpointUrl: "https://example.functions/orbitslash-friend-challenge",
      friendChallengeRemoteEnabled: true,
      liveOpsEvidenceVerified: false,
    });

    await expect(adapter.createFriendChallenge({ seed: 1, difficulty: "rookie", rulesHash: "rules-1", rulesVersion: 1, configVersion: "config-1", expiresAt: "2026-08-01T00:00:00.000Z" })).resolves.toEqual({
      accepted: false,
      reason: "friend_challenge_remote_not_enabled",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts allowlisted product telemetry only to its dedicated enabled endpoint", async () => {
    const calls: Array<{ input: string; body: unknown }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input: String(input), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ ok: true, accepted: true }), { status: 200 });
    });
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchMock as unknown as typeof fetch, {
      productTelemetryEndpointUrl: "https://example.functions/orbitslash-product-telemetry",
      productTelemetryRemoteEnabled: true,
    });

    await expect(adapter.recordProductEvent({
      clientEventId: "trace:1",
      sessionTraceId: "trace",
      eventName: "primary_start",
      eventSequence: 1,
      props: { modeId: "story", freeText: "must-not-send" } as never,
    }, { runtime: "web_stub" })).resolves.toEqual({ accepted: true });

    expect(calls).toEqual([{
      input: "https://example.functions/orbitslash-product-telemetry",
      body: expect.objectContaining({
        action: "record",
        events: [expect.objectContaining({ eventName: "primary_start", props: { modeId: "story" }, runtime: "web_stub" })],
      }),
    }]);
  });

  it("begins ranked runs through the Edge Function with public anon auth only", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        "Content-Type": "application/json",
        apikey: "anon-key",
        Authorization: "Bearer anon-key",
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        action: "begin",
        difficulty: "rookie",
        rulesHash: RANKED_CORE_RULES_HASH,
        rulesVersion: RANKED_CORE_SCHEMA_VERSION,
      });
      return new Response(
        JSON.stringify({
          ok: true,
          start: {
            modeId: "ranked",
            runToken: "server-ranked-run-1",
            seed: 123,
            difficulty: "rookie",
            configVersion: "server-ranked-v1",
            rulesHash: RANKED_CORE_RULES_HASH,
            rulesVersion: RANKED_CORE_SCHEMA_VERSION,
            rankingEligible: true,
            verification: "server_verified",
            identityBound: true,
            issuedAtMs: 100,
            expiresAtMs: 1000,
          },
        }),
        { status: 200 },
      );
    });
    const fetchFn = fetchMock as unknown as typeof fetch;
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchFn, {
      rankedEdgeRemoteEnabled: true,
    });

    const start = await adapter.beginRankedRun("rookie");

    expect(start).toMatchObject({
      runToken: "server-ranked-run-1",
      seed: 123,
      verification: "server_verified",
      identityBound: true,
    });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toMatch(/SERVICE_ROLE|DB_PASSWORD|ACCESS_TOKEN/);
  });

  it("uses a user access token for Authorization while keeping the anon key as apikey", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        apikey: "anon-key",
        Authorization: "Bearer user-access-token",
      });
      return new Response(
        JSON.stringify({
          ok: true,
          start: {
            modeId: "ranked",
            runToken: "server-ranked-run-2",
            seed: 456,
            difficulty: "defender",
            configVersion: "server-ranked-v1",
            rankingEligible: true,
            verification: "server_verified",
            identityBound: true,
            issuedAtMs: 100,
            expiresAtMs: 1000,
          },
        }),
        { status: 200 },
      );
    });
    const fetchFn = fetchMock as unknown as typeof fetch;
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchFn, {
      accessToken: "user-access-token",
      rankedEdgeRemoteEnabled: true,
    });

    await expect(adapter.beginRankedRun("defender")).resolves.toMatchObject({
      runToken: "server-ranked-run-2",
      identityBound: true,
    });
  });

  it("submits ranked summaries and returns server rejection reasons", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({
        action: "submit",
        rulesHash: RANKED_CORE_RULES_HASH,
        rulesVersion: RANKED_CORE_SCHEMA_VERSION,
        replayTrace: {
          hitEvents: [{ spawnOrdinal: 1 }],
          killEvents: [{ spawnOrdinal: 1 }],
        },
      });
      return new Response(JSON.stringify({ ok: false, reason: "seed_mismatch" }), { status: 409 });
    });
    const fetchFn = fetchMock as unknown as typeof fetch;
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchFn, {
      rankedEdgeRemoteEnabled: true,
    });
    const summary = createRunSummary({
      modeId: "ranked",
      runToken: "server-ranked-run-1",
      seed: 123,
      difficulty: "rookie",
      survivalMs: 10_000,
      score: 1000,
      kills: 10,
      maxCombo: 3,
      lastSaveCount: 0,
      remainingEnergy: 88,
    });

    await expect(
      adapter.submitRankedRun(summary, {
        hitEvents: [{ spawnOrdinal: 1, hitAtMs: 1, band: "outer", accuracy: "normal", damage: 1 }],
        killEvents: [{ spawnOrdinal: 1, hitAtMs: 1, band: "outer", accuracy: "normal" }],
        comboBreakEvents: [],
        skillEvents: [],
      }),
    ).resolves.toEqual({ accepted: false, reason: "seed_mismatch" });
  });

  it("converts ranked submit network failures into rejected submit results", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    const fetchFn = fetchMock as unknown as typeof fetch;
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchFn, {
      rankedEdgeRemoteEnabled: true,
    });
    const summary = createRunSummary({
      modeId: "ranked",
      runToken: "server-ranked-run-1",
      seed: 123,
      difficulty: "rookie",
      survivalMs: 10_000,
      score: 0,
      kills: 0,
      maxCombo: 0,
      lastSaveCount: 0,
      remainingEnergy: 88,
    });

    await expect(
      adapter.submitRankedRun(summary, {
        hitEvents: [],
        killEvents: [],
        comboBreakEvents: [],
        skillEvents: [],
      }),
    ).resolves.toEqual({ accepted: false, reason: "ranked_submit_network_failed" });
  });

  it("keeps ranked and public leaderboard locked until ranked Edge remote is explicitly enabled", async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchFn);

    await expect(adapter.beginRankedRun("rookie")).rejects.toThrow("ranked_edge_remote_not_enabled");
    await expect(adapter.submitRankedRun(createRunSummary({
      modeId: "ranked",
      runToken: "server-ranked-run-1",
      seed: 123,
      difficulty: "rookie",
      survivalMs: 10_000,
      score: 0,
      kills: 0,
      maxCombo: 0,
      lastSaveCount: 0,
      remainingEnergy: 88,
    }))).resolves.toEqual({ accepted: false, reason: "ranked_edge_remote_not_enabled" });
    await expect(adapter.leaderboardStatus()).resolves.toMatchObject({
      publicAvailable: false,
      reason: "edge_not_deployed",
    });
    await expect(adapter.publicLeaderboardRows()).resolves.toEqual({
      status: { publicAvailable: false, reason: "edge_not_deployed" },
      rows: [],
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("keeps public leaderboard locked until identity-bound accepted runs exist after ranked Edge is enabled", async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchFn, {
      rankedEdgeRemoteEnabled: true,
    });

    await expect(adapter.leaderboardStatus()).resolves.toMatchObject({
      publicAvailable: false,
      reason: "identity_bound_runs_missing",
    });
    await expect(adapter.publicLeaderboardRows()).resolves.toEqual({
      status: { publicAvailable: false, reason: "public_leaderboard_disabled" },
      rows: [],
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("loads public leaderboard rows only when the public leaderboard flag is explicit", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://example.functions/orbitslash-ranked-run");
      expect(JSON.parse(String(init?.body))).toEqual({ action: "leaderboard", difficulty: "elite", weekKey: "orbitslash-ranked-v1:27", limit: 10 });
      return new Response(
        JSON.stringify({
          ok: true,
          rows: [
            {
              rank: 1,
              score: 9800,
              survivalMs: 120000,
              kills: 88,
              maxCombo: 14,
              difficulty: "elite",
              createdAt: "2026-07-05T00:00:00.000Z",
              core_user_id: "must-not-leak",
            },
          ],
        }),
        { status: 200 },
      );
    });
    const fetchFn = fetchMock as unknown as typeof fetch;
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchFn, {
      rankedEdgeRemoteEnabled: true,
      publicLeaderboardEnabled: true,
    });

    await expect(adapter.publicLeaderboardRows({ difficulty: "elite", weekKey: "orbitslash-ranked-v1:27", limit: 10 })).resolves.toEqual({
      status: { publicAvailable: true, reason: "ready" },
      rows: [
        {
          rank: 1,
          score: 9800,
          survivalMs: 120000,
          kills: 88,
          maxCombo: 14,
          difficulty: "elite",
          createdAt: "2026-07-05T00:00:00.000Z",
        },
      ],
    });
  });

  it("does not send rewarded-ad telemetry to the ranked Edge endpoint", async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchMock);

    await expect(adapter.rewardedAdTelemetryStatus()).resolves.toEqual({
      ready: false,
      reason: "endpoint_not_configured",
      endpointConfigured: false,
      remoteEnabled: false,
      remoteVerified: false,
    });
    await expect(
      adapter.recordRewardedAdEvent({
        eventName: "show_requested",
        placement: "free_defense_revive",
        atMs: 100,
      }),
    ).resolves.toEqual({ accepted: false, reason: "telemetry_not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps rewarded-ad telemetry disabled when only the local draft endpoint is configured", async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchMock, {
      adTelemetryEndpointUrl: "https://example.functions/orbitslash-rewarded-ad-telemetry",
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
        eventName: "show_requested",
        placement: "free_defense_revive",
        atMs: 100,
      }),
    ).resolves.toEqual({ accepted: false, reason: "ad_telemetry_remote_not_enabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends rewarded-ad telemetry only to the dedicated ad telemetry endpoint when configured", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://example.functions/orbitslash-rewarded-ad-telemetry");
      expect(init?.headers).toMatchObject({
        apikey: "anon-key",
        Authorization: "Bearer anon-key",
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        action: "record",
        events: [
          {
            clientEventId: "evt-1",
            sessionTraceId: "session-1",
            eventName: "user_earned_reward",
            placement: "free_defense_revive",
            atMs: 3000,
            clientAt: "2026-07-05T00:00:00.000Z",
            screen: "result",
            runtime: "web_stub",
            eventSequence: 1,
            rewardEarned: true,
            dismissed: false,
          },
        ],
      });
      return new Response(JSON.stringify({ ok: true, accepted: true }), { status: 200 });
    });
    const fetchFn = fetchMock as unknown as typeof fetch;
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchFn, {
      adTelemetryEndpointUrl: "https://example.functions/orbitslash-rewarded-ad-telemetry",
      adTelemetryRemoteEnabled: true,
    });

    await expect(adapter.rewardedAdTelemetryStatus()).resolves.toEqual({
      ready: false,
      reason: "remote_unverified",
      endpointConfigured: true,
      remoteEnabled: true,
      remoteVerified: false,
    });
    await expect(
      adapter.recordRewardedAdEvent({
        clientEventId: "evt-1",
        sessionTraceId: "session-1",
        eventName: "user_earned_reward",
        placement: "free_defense_revive",
        atMs: 3000,
        clientAt: "2026-07-05T00:00:00.000Z",
        screen: "result",
        runtime: "web_stub",
        eventSequence: 1,
        rewardEarned: true,
        dismissed: false,
      }),
    ).resolves.toEqual({ accepted: true });
    await expect(adapter.rewardedAdTelemetryStatus()).resolves.toEqual({
      ready: true,
      reason: "ready",
      endpointConfigured: true,
      remoteEnabled: true,
      remoteVerified: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not send gameplay telemetry to the ranked Edge endpoint", async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchMock);

    await expect(adapter.gameplayTelemetryStatus()).resolves.toEqual({
      ready: false,
      reason: "endpoint_not_configured",
      endpointConfigured: false,
      remoteEnabled: false,
      remoteVerified: false,
    });
    await expect(
      adapter.recordGameplayEvent({
        eventName: "skill_fire",
        atMs: 100,
        modeId: "freeDefense",
        difficulty: "rookie",
      }),
    ).resolves.toEqual({ accepted: false, reason: "telemetry_not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps gameplay telemetry disabled when only the local draft endpoint is configured", async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchMock, {
      gameplayTelemetryEndpointUrl: "https://example.functions/orbitslash-gameplay-telemetry",
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
        eventName: "skill_fire",
        atMs: 100,
        modeId: "freeDefense",
        difficulty: "rookie",
      }),
    ).resolves.toEqual({ accepted: false, reason: "gameplay_telemetry_remote_not_enabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends gameplay telemetry only to the dedicated gameplay endpoint when configured", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://example.functions/orbitslash-gameplay-telemetry");
      expect(init?.headers).toMatchObject({
        apikey: "anon-key",
        Authorization: "Bearer anon-key",
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        action: "record",
        events: [
          {
            clientEventId: "gameplay-evt-1",
            sessionTraceId: "session-1",
            eventName: "skill_fire",
            atMs: 3000,
            clientAt: "2026-07-05T00:00:00.000Z",
            screen: "game",
            modeId: "freeDefense",
            difficulty: "rookie",
            runtime: "web_stub",
            eventSequence: 1,
            skillId: "solar_lance",
            score: 1200,
          },
        ],
      });
      return new Response(JSON.stringify({ ok: true, accepted: true }), { status: 200 });
    });
    const fetchFn = fetchMock as unknown as typeof fetch;
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchFn, {
      gameplayTelemetryEndpointUrl: "https://example.functions/orbitslash-gameplay-telemetry",
      gameplayTelemetryRemoteEnabled: true,
    });

    await expect(adapter.gameplayTelemetryStatus()).resolves.toEqual({
      ready: false,
      reason: "remote_unverified",
      endpointConfigured: true,
      remoteEnabled: true,
      remoteVerified: false,
    });
    await expect(
      adapter.recordGameplayEvent({
        clientEventId: "gameplay-evt-1",
        sessionTraceId: "session-1",
        eventName: "skill_fire",
        atMs: 3000,
        clientAt: "2026-07-05T00:00:00.000Z",
        screen: "game",
        modeId: "freeDefense",
        difficulty: "rookie",
        runtime: "web_stub",
        eventSequence: 1,
        skillId: "solar_lance",
        score: 1200,
      }),
    ).resolves.toEqual({ accepted: true });
    await expect(adapter.gameplayTelemetryStatus()).resolves.toEqual({
      ready: true,
      reason: "ready",
      endpointConfigured: true,
      remoteEnabled: true,
      remoteVerified: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("funnels generic trackEvent calls through gameplay telemetry when the endpoint is enabled", async () => {
    const calls: unknown[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ ok: true, accepted: true }), { status: 200 });
    });
    const fetchFn = fetchMock as unknown as typeof fetch;
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchFn, {
      gameplayTelemetryEndpointUrl: "https://example.functions/orbitslash-gameplay-telemetry",
      gameplayTelemetryRemoteEnabled: true,
    });

    await adapter.trackEvent("combo_break", { reason: "timeout", modeId: "freeDefense", difficulty: "rookie" });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      action: "record",
      events: [
        {
          eventName: "combo_break",
          reason: "timeout",
          modeId: "freeDefense",
          difficulty: "rookie",
          runtime: "web_stub",
        },
      ],
    });
  });

  it("drops unknown trackEvent names and strips unlisted props before posting gameplay telemetry", async () => {
    const calls: unknown[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ ok: true, accepted: true }), { status: 200 });
    });
    const fetchFn = fetchMock as unknown as typeof fetch;
    const adapter = new SupabaseEdgeBackendAdapter("https://example.functions/orbitslash-ranked-run", "anon-key", fetchFn, {
      gameplayTelemetryEndpointUrl: "https://example.functions/orbitslash-gameplay-telemetry",
      gameplayTelemetryRemoteEnabled: true,
    });

    await adapter.trackEvent("free_text_event", { userKey: "raw", reason: "nope" });
    await adapter.trackEvent("skill_fire", { skillId: "solar_lance", userKey: "raw", rawMemo: "drop-me" });

    expect(calls).toHaveLength(1);
    expect(JSON.stringify(calls[0])).not.toMatch(/userKey|rawMemo|raw/);
    expect(calls[0]).toMatchObject({
      events: [
        {
          eventName: "skill_fire",
          skillId: "solar_lance",
        },
      ],
    });
  });
});
