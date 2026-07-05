import { describe, expect, it } from "vitest";
import migration from "../../supabase/migrations/20260705_orbitslash_gameplay_telemetry.sql?raw";
import edgeSource from "../../supabase/functions/orbitslash-gameplay-telemetry/index.ts?raw";

describe("gameplay telemetry boundary", () => {
  it("stores gameplay telemetry in a dedicated RLS-protected table with no public writes", () => {
    expect(migration).toContain("create table if not exists public.orbitslash_gameplay_events");
    expect(migration).toContain("client_event_id");
    expect(migration).toContain("session_trace_id");
    expect(migration).toContain("runtime_channel");
    expect(migration).toContain("event_name");
    expect(migration).toContain("mode_id");
    expect(migration).toContain("difficulty");
    expect(migration).toContain("alter table public.orbitslash_gameplay_events enable row level security");
    expect(migration).toContain("revoke all on table public.orbitslash_gameplay_events from anon, authenticated");
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/with check\s*\(\s*true\s*\)/i);
  });

  it("uses a dedicated Edge Function and rejects raw user/device identifiers", () => {
    expect(edgeSource).toContain("orbitslash_gameplay_events");
    expect(edgeSource).toContain('record.action !== "record"');
    expect(edgeSource).toContain("events.length > 50");
    expect(edgeSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(edgeSource).toContain("runtime_channel");
    expect(edgeSource).toContain('record.runtime === "apps_in_toss"');
    expect(edgeSource).toContain("Access-Control-Allow-Origin");
    expect(edgeSource).toContain('request.method === "OPTIONS"');
    expect(edgeSource).toContain("accepted: true");
    expect(edgeSource).toContain("acceptedCount");
    expect(edgeSource).toContain("run_identity_not_bound");
    expect(edgeSource).toContain("run_identity_mismatch");
    expect(edgeSource).toContain("orbitslash_runs");
    expect(edgeSource).toContain("userKey");
    expect(edgeSource).toContain("provider_user_id");
    expect(edgeSource).toContain("sensitive_payload");
    expect(edgeSource).not.toContain("orbitslash_scores");
  });
});
