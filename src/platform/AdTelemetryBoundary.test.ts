import { describe, expect, it } from "vitest";
import migration from "../../supabase/migrations/20260705_orbitslash_rewarded_ad_telemetry.sql?raw";
import edgeSource from "../../supabase/functions/orbitslash-rewarded-ad-telemetry/index.ts?raw";

describe("rewarded ad telemetry boundary", () => {
  it("stores ad telemetry in a dedicated RLS-protected table with no public writes", () => {
    expect(migration).toContain("create table if not exists public.orbitslash_rewarded_ad_events");
    expect(migration).toContain("client_event_id");
    expect(migration).toContain("session_trace_id");
    expect(migration).toContain("runtime_channel");
    expect(migration).toContain("event_name");
    expect(migration).toContain("reward_earned");
    expect(migration).toContain("dismissed");
    expect(migration).toContain("alter table public.orbitslash_rewarded_ad_events enable row level security");
    expect(migration).toContain("revoke all on table public.orbitslash_rewarded_ad_events from anon, authenticated");
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/with check\s*\(\s*true\s*\)/i);
  });

  it("uses a dedicated Edge Function and rejects sensitive raw identifiers", () => {
    expect(edgeSource).toContain("orbitslash_rewarded_ad_events");
    expect(edgeSource).toContain('record.action !== "record"');
    expect(edgeSource).toContain("events.length > 20");
    expect(edgeSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(edgeSource).toContain("runtime_channel");
    expect(edgeSource).toContain('record.runtime === "apps_in_toss"');
    expect(edgeSource).toContain("Access-Control-Allow-Origin");
    expect(edgeSource).toContain('request.method === "OPTIONS"');
    expect(edgeSource).toContain("accepted: true");
    expect(edgeSource).toContain("acceptedCount");
    expect(edgeSource).toContain("userKey");
    expect(edgeSource).toContain("sensitive_payload");
    expect(edgeSource).not.toContain("orbitslash_scores");
    expect(edgeSource).not.toContain("orbitslash_runs");
  });
});
