import { describe, expect, it } from "vitest";
import migration from "../../supabase/migrations/20260711_orbitslash_friend_challenges.sql?raw";
import edgeSource from "../../supabase/functions/orbitslash-friend-challenge/index.ts?raw";
import policySource from "../../supabase/functions/_shared/FriendChallengePolicy.ts?raw";

describe("friend challenge boundary", () => {
  it("stores only opaque token hashes and server-bound internal identity", () => {
    expect(migration).toContain("public.orbitslash_friend_challenges");
    expect(migration).toContain("owner_core_user_id uuid not null references public.core_users(id)");
    expect(migration).toContain("token_hash text not null unique");
    expect(migration).toContain("status text not null default 'open'");
    expect(migration).toContain("orbitslash_friend_challenges_owner_status_expiry_idx");
    expect(migration).toContain("orbitslash_accept_friend_challenge");
    expect(migration).toContain("expires_at > now()");
    expect(migration).toContain("accepted_by_core_user_id is null or accepted_by_core_user_id <> owner_core_user_id");
    expect(migration).toContain("revoke all on function public.orbitslash_accept_friend_challenge(uuid, uuid, uuid, uuid, jsonb) from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.orbitslash_accept_friend_challenge");
    expect(migration).toContain("alter table public.orbitslash_friend_challenges enable row level security");
    expect(migration).toContain("revoke all on table public.orbitslash_friend_challenges from anon, authenticated");
    expect(migration).not.toContain("provider_user_id");
    expect(migration).not.toContain("friend_list");
    expect(migration).not.toContain("challenge_token text");
  });

  it("binds create, list, and accept paths to verified identity and verified result records", () => {
    expect(edgeSource).toContain("authmap_user_identities");
    expect(edgeSource).toContain("token_hash");
    expect(edgeSource).toContain("opaqueChallengeTokenLookupKey");
    expect(edgeSource).toContain("createOpaqueToken");
    expect(edgeSource).toContain("crypto.getRandomValues");
    expect(edgeSource).toContain(".eq(\"status\", \"open\")");
    expect(edgeSource).toContain("challenge_already_accepted");
    expect(policySource).toContain("challenge_owner_cannot_accept");
    expect(edgeSource).toContain("expireOwnerChallenges");
    expect(edgeSource).toContain("expireChallengeIfDue");
    expect(edgeSource).toContain('rpc("orbitslash_accept_friend_challenge"');
    expect(edgeSource).not.toContain("claimNowIso");
    expect(edgeSource.indexOf("if (!acceptability.ok) return json")).toBeLessThan(edgeSource.indexOf("orbitslash_scores"));
    expect(edgeSource).toContain("challenge_contract_invalid");
    expect(edgeSource).toContain("orbitslash_scores");
    expect(edgeSource).toContain("verified");
    expect(edgeSource).toContain("identity_not_bound");
    expect(edgeSource).toContain("SENSITIVE_KEYS");
    expect(edgeSource).toContain("sensitive_payload");
    expect(edgeSource).not.toContain("provider_user_id:");
    expect(edgeSource).not.toContain("friend_list:");
    expect(edgeSource).not.toContain("base64UrlDecode");
    expect(edgeSource).not.toContain("checksum(");
  });
});
