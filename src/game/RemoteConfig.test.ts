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
});
