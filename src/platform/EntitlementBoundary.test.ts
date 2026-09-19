import { describe, expect, it } from "vitest";
import migration from "../../supabase/migrations/20260711_orbitslash_entitlements.sql?raw";
import edgeSource from "../../supabase/functions/orbitslash-entitlements/index.ts?raw";

describe("entitlement boundary", () => {
  it("keeps entitlement writes server-only behind RLS", () => {
    expect(migration).toContain("public.orbitslash_entitlements");
    expect(migration).toContain("alter table public.orbitslash_entitlements enable row level security");
    expect(migration).toContain("revoke all on table public.orbitslash_entitlements from anon, authenticated");
  });

  it("does not trust client receipt claims", () => {
    expect(edgeSource).toContain("authmap_user_identities");
    expect(edgeSource).toContain("receipt_provider_not_configured");
    expect(edgeSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(edgeSource).not.toContain("clientGranted");
  });
});
