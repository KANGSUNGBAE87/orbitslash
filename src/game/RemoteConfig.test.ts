import { describe, expect, it, vi } from "vitest";
import scoringJson from "../data/scoring.json";
import { createRemoteConfig } from "./RemoteConfig";

describe("RemoteConfig", () => {
  it("stays local and does not fetch when remote config is disabled", async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;
    const config = createRemoteConfig({ enabled: false, endpointUrl: "https://example.com/config.json", fetchFn });

    await config.ready();

    expect(fetchFn).not.toHaveBeenCalled();
    expect(config.getScoring()).toEqual(scoringJson);
    expect(config.status()).toMatchObject({ source: "local", reason: "remote_disabled" });
  });

  it("applies only known remote tables after a successful fetch", async () => {
    const remoteScoring = {
      ...(scoringJson as Record<string, unknown>),
      comboChainTimeoutMs: 520,
    };
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      version: "remote-balance-1",
      tables: {
        scoring: remoteScoring,
        unknownTable: { should: "ignore" },
      },
    }), { status: 200 })) as unknown as typeof fetch;
    const config = createRemoteConfig({ enabled: true, endpointUrl: "https://example.com/config.json", fetchFn });

    await config.ready();
    await config.ready();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(config.getScoring().comboChainTimeoutMs).toBe(520);
    expect(config.get("unknownTable")).toBeUndefined();
    expect(config.status()).toMatchObject({ source: "remote", version: "remote-balance-1" });
  });

  it("falls back to local tables when the remote fetch fails", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const config = createRemoteConfig({ enabled: true, endpointUrl: "https://example.com/config.json", fetchFn });

    await config.ready();

    expect(config.getScoring()).toEqual(scoringJson);
    expect(config.status()).toMatchObject({ source: "local", reason: "fetch_failed" });
  });

  it("exposes only a validated liveops table and keeps invalid remote input disabled", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      version: "remote-liveops-1",
      tables: {
        liveops: {
          enabled: true,
          seasons: [{
            id: "aurora-01",
            startsAt: "2026-07-01T00:00:00.000Z",
            endsAt: "2026-08-01T00:00:00.000Z",
            supportedClientVersion: "1.0.0",
            configVersion: "remote-liveops-1",
            cosmeticRewardIds: ["earth_aurora"],
          }],
        },
      },
    }), { status: 200 })) as unknown as typeof fetch;
    const config = createRemoteConfig({ enabled: true, endpointUrl: "https://example.com/config.json", fetchFn });

    await config.ready();

    expect(config.getLiveOps()).toMatchObject({ enabled: true, seasons: [{ id: "aurora-01" }] });

    const invalidFetch = vi.fn(async () => new Response(JSON.stringify({
      version: "remote-liveops-2",
      tables: { liveops: { enabled: true, seasons: [{ id: "bad" }] } },
    }), { status: 200 })) as unknown as typeof fetch;
    const invalidConfig = createRemoteConfig({ enabled: true, endpointUrl: "https://example.com/config.json", fetchFn: invalidFetch });

    await invalidConfig.ready();

    expect(invalidConfig.getLiveOps()).toEqual({ enabled: false, seasons: [] });
    expect(invalidConfig.status()).toMatchObject({ source: "remote", version: "remote-liveops-2" });
  });

  it("accepts validated remote retention rules and fails closed to shipped data", async () => {
    const validFetch = vi.fn(async () => new Response(JSON.stringify({
      version: "remote-retention-1",
      tables: {
        retention: {
          stages: { "story-1": { silverScore: 100, goldScore: 200, goldEnergy: 10, goldCombo: 2 } },
          weekly: { requiredDistinctClearDays: 4, titleId: "weekly_five_day" },
        },
      },
    }), { status: 200 })) as unknown as typeof fetch;
    const validConfig = createRemoteConfig({ enabled: true, endpointUrl: "https://example.com/config.json", fetchFn: validFetch });

    await validConfig.ready();

    expect(validConfig.getRetention()).toMatchObject({
      stages: { "story-1": { silverScore: 100, goldScore: 200 } },
      weekly: { requiredDistinctClearDays: 4, titleId: "weekly_five_day" },
    });

    const invalidFetch = vi.fn(async () => new Response(JSON.stringify({
      version: "remote-retention-2",
      tables: { retention: { stages: { "story-1": { silverScore: 100, goldScore: 200 } }, weekly: { requiredDistinctClearDays: 5, titleId: "unknown_title" } } },
    }), { status: 200 })) as unknown as typeof fetch;
    const invalidConfig = createRemoteConfig({ enabled: true, endpointUrl: "https://example.com/config.json", fetchFn: invalidFetch });

    await invalidConfig.ready();

    expect(invalidConfig.getRetention().stages["story-1"]?.silverScore).toBe(900);
    expect(invalidConfig.getRetention().weekly.requiredDistinctClearDays).toBe(5);
  });
});
