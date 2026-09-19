import { describe, expect, it, vi } from "vitest";
import { SupabaseProgressSyncPort } from "./SupabaseProgressSyncPort";

describe("SupabaseProgressSyncPort", () => {
  it("sends snapshot and mutation IDs without exposing the local internal user identifier", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ apikey: "anon-key", Authorization: "Bearer anon-key" });
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({ action: "sync", mutations: [{ id: "11111111-1111-4111-8111-111111111111" }] });
      expect(JSON.stringify(body)).not.toContain("core-user-1");
      return new Response(JSON.stringify({ ok: true, snapshot: { version: 4 }, acknowledgedMutationIds: ["11111111-1111-4111-8111-111111111111"] }), { status: 200 });
    });
    const port = new SupabaseProgressSyncPort("https://example.functions/orbitslash-progress", "anon-key", fetchMock as unknown as typeof fetch);

    const result = await port.sync({
      identity: { status: "linked", internalUserId: "core-user-1", provider: "google_play" },
      snapshot: { version: 4 } as never,
      mutations: [{ id: "11111111-1111-4111-8111-111111111111", type: "snapshot_sync", createdAt: "2031-02-03T00:00:00.000Z" }],
    });

    expect(result.acknowledgedMutationIds).toEqual(["11111111-1111-4111-8111-111111111111"]);
  });
});
