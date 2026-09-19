import { describe, expect, it } from "vitest";
import migration from "../../supabase/migrations/20260711_orbitslash_product_telemetry.sql?raw";
import edgeSource from "../../supabase/functions/orbitslash-product-telemetry/index.ts?raw";

describe("product telemetry boundary", () => {
  it("uses an RLS-protected product table with no public writes", () => {
    expect(migration).toContain("create table if not exists public.orbitslash_product_events");
    expect(migration).toContain("client_event_id");
    expect(migration).toContain("session_trace_id");
    expect(migration).toContain("event_name");
    expect(migration).toContain("props jsonb");
    expect(migration).toContain("alter table public.orbitslash_product_events enable row level security");
    expect(migration).toContain("revoke all on table public.orbitslash_product_events from anon, authenticated");
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });

  it("accepts only the funnel allowlist and rejects raw identity/free text", () => {
    expect(edgeSource).toContain("orbitslash_product_events");
    expect(edgeSource).toContain("PRODUCT_EVENT_NAMES");
    expect(edgeSource).toContain("ALLOWED_PROPS");
    expect(edgeSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(edgeSource).toContain("sensitive_payload");
    expect(edgeSource).toContain("userKey");
    expect(edgeSource).toContain("provider_user_id");
    expect(edgeSource).toContain('record.action !== "record"');
    expect(edgeSource).toContain("ignoreDuplicates: true");
  });
});
