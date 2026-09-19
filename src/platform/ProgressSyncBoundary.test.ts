import { describe, expect, it } from "vitest";
import migration from "../../supabase/migrations/20260711_orbitslash_progress_sync.sql?raw";
import edgeSource from "../../supabase/functions/orbitslash-progress/index.ts?raw";

describe("progress sync boundary", () => {
  it("keeps snapshots, mutations, and reward claims server-writable only", () => {
    for (const table of ["orbitslash_progress_snapshots", "orbitslash_progress_mutations", "orbitslash_reward_claims"]) {
      expect(migration).toContain(`public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`revoke all on table public.${table} from anon, authenticated`);
    }
    expect(migration).toContain("claim_key text not null unique");
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });

  it("binds sync writes to verified server identity and handles duplicate mutations", () => {
    expect(edgeSource).toContain("authmap_user_identities");
    expect(edgeSource).toContain("identity_not_bound");
    expect(edgeSource).toContain("orbitslash_progress_snapshots");
    expect(edgeSource).toContain("orbitslash_progress_mutations");
    expect(edgeSource).toContain("onConflict: \"id\"");
    expect(edgeSource).toContain("ignoreDuplicates: true");
    expect(edgeSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(edgeSource).toContain("sensitive_payload");
  });

  it("merges the current remote snapshot and retries writes with a revision guard instead of overwriting another device", () => {
    expect(edgeSource).toContain('from "../_shared/orbitslash-progress-merge.ts"');
    expect(edgeSource).toContain("mergeProgressSnapshots");
    expect(edgeSource).toContain("persistMergedSnapshot");
    expect(edgeSource).toContain('.eq("revision", revision)');
    expect(edgeSource).toContain("snapshot_write_conflict");
  });
});
