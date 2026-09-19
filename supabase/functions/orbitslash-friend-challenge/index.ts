import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RANKED_CORE_RULES_HASH, RANKED_CORE_SCHEMA_VERSION } from "../_shared/orbitslash-ranked-core.generated.ts";
import { claimFriendChallenge } from "../_shared/FriendChallengeAcceptance.ts";
import { opaqueChallengeTokenLookupKey } from "../_shared/FriendChallengeToken.ts";
import {
  evaluateFriendChallengeAcceptability,
  resolveFriendChallengeStatus,
  validateFriendChallengeRequestedExpiry,
  type FriendChallengeStatus,
} from "../_shared/FriendChallengePolicy.ts";

const SENSITIVE_KEYS = ["userKey", "tossUserKey", "providerUserId", "provider_user_id", "friendList", "friend_list", "nickname", "freeText", "fullUrl"];
const CURRENT_CONFIG_VERSION = Deno.env.get("ORBITSLASH_CONFIG_VERSION") ?? "server-ranked-v1";
const FRIEND_CHALLENGE_ENABLED = Deno.env.get("ORBITSLASH_FRIEND_CHALLENGE_ENABLED") === "true"
  && Deno.env.get("ORBITSLASH_LIVEOPS_EVIDENCE_VERIFIED") === "true";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

interface ChallengeContract {
  seed: number;
  difficulty: string;
  rulesHash: string;
  rulesVersion: number;
  configVersion: string;
  expiresAt: string;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);
  if (!FRIEND_CHALLENGE_ENABLED) return json({ ok: false, reason: "feature_inactive" }, 503);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ ok: false, reason: "server_not_configured" }, 500);
  const body = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.action !== "string") return json({ ok: false, reason: "action_invalid" }, 400);
  if (containsSensitiveKey(body)) return json({ ok: false, reason: "sensitive_payload" }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const coreUserId = await resolveCoreUserId(admin, supabaseUrl, anonKey, request.headers.get("Authorization"));
  if (!coreUserId) return json({ ok: false, reason: "identity_not_bound" }, 401);
  if (body.action === "create") return createChallenge(admin, coreUserId, body);
  if (body.action === "list") return listChallenges(admin, coreUserId);
  if (body.action === "accept") return acceptChallenge(admin, coreUserId, body.token, body.runToken);
  return json({ ok: false, reason: "action_invalid" }, 400);
});

async function createChallenge(admin: SupabaseClient, coreUserId: string, body: Record<string, unknown>): Promise<Response> {
  const challenge = validateNewContract(body);
  if (!challenge.ok) return json(challenge, 409);
  const token = createOpaqueToken();
  const tokenHash = await opaqueChallengeTokenLookupKey(token);
  const { data, error } = await admin.from("orbitslash_friend_challenges").insert({
    owner_core_user_id: coreUserId,
    token_hash: tokenHash,
    seed: challenge.contract.seed,
    difficulty: challenge.contract.difficulty,
    rules_hash: challenge.contract.rulesHash,
    rules_version: challenge.contract.rulesVersion,
    config_version: challenge.contract.configVersion,
    expires_at: challenge.contract.expiresAt,
    status: "open",
  }).select("id").single();
  if (error || typeof data?.id !== "string") return json({ ok: false, reason: "challenge_create_failed" }, 500);
  // This is the only response that contains the raw opaque token.
  return json({ ok: true, challengeId: data.id, token, created: true });
}

async function listChallenges(admin: SupabaseClient, coreUserId: string): Promise<Response> {
  const nowIso = new Date().toISOString();
  if (!await expireOwnerChallenges(admin, coreUserId, nowIso)) return json({ ok: false, reason: "challenge_expiry_update_failed" }, 500);
  const { data, error } = await admin.from("orbitslash_friend_challenges")
    .select("id, seed, difficulty, rules_hash, rules_version, config_version, expires_at, status, accepted_at, accepted_result_metadata")
    .eq("owner_core_user_id", coreUserId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return json({ ok: false, reason: "challenge_list_failed" }, 500);
  return json({ ok: true, challenges: (data ?? []).flatMap((row) => publicChallenge(row, nowIso)) });
}

async function acceptChallenge(admin: SupabaseClient, coreUserId: string, rawToken: unknown, rawRunToken: unknown): Promise<Response> {
  if (!opaqueToken(rawToken) || !shortText(rawRunToken)) return json({ ok: false, reason: "challenge_token_invalid" }, 400);
  const nowIso = new Date().toISOString();
  const tokenHash = await opaqueChallengeTokenLookupKey(rawToken);
  const { data: stored, error: storedError } = await admin.from("orbitslash_friend_challenges")
    .select("id, owner_core_user_id, seed, difficulty, rules_hash, rules_version, config_version, expires_at, status, accepted_score_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (storedError) return json({ ok: false, reason: "challenge_lookup_failed" }, 500);
  if (!stored) return json({ ok: false, reason: "challenge_not_found" }, 404);
  if (!await expireChallengeIfDue(admin, stored.id, nowIso)) return json({ ok: false, reason: "challenge_expiry_update_failed" }, 500);
  const acceptability = evaluateFriendChallengeAcceptability({
    ownerCoreUserId: String(stored.owner_core_user_id ?? ""),
    acceptingCoreUserId: coreUserId,
    status: stored.status as FriendChallengeStatus,
    expiresAt: String(stored.expires_at ?? ""),
    nowMs: Date.parse(nowIso),
  });
  if (!acceptability.ok) return json({ ok: false, reason: acceptability.reason }, 409);
  if (stored.accepted_score_id) return json({ ok: false, reason: "challenge_already_accepted" }, 409);
  const contract = validateStoredContract(stored);
  if (!contract.ok) return json(contract, 409);

  const { data: run, error: runError } = await admin.from("orbitslash_runs")
    .select("id, core_user_id, seed, difficulty, config_version, rules_hash, rules_version, status")
    .eq("run_token", rawRunToken)
    .maybeSingle();
  if (runError) return json({ ok: false, reason: "verified_run_lookup_failed" }, 500);
  if (!run || run.core_user_id !== coreUserId || run.status !== "submitted") return json({ ok: false, reason: "verified_run_required" }, 409);
  if (!sameContract(run, contract.contract)) return json({ ok: false, reason: "verified_run_contract_mismatch" }, 409);
  const { data: score, error: scoreError } = await admin.from("orbitslash_scores")
    .select("id, score, survival_ms, kills, max_combo, created_at")
    .eq("run_id", run.id)
    .eq("core_user_id", coreUserId)
    .eq("verified", true)
    .maybeSingle();
  if (scoreError) return json({ ok: false, reason: "verified_score_lookup_failed" }, 500);
  if (!score || typeof score.id !== "string") return json({ ok: false, reason: "verified_result_required" }, 409);
  const metadata = { score: score.score, survivalMs: score.survival_ms, kills: score.kills, maxCombo: score.max_combo, verifiedAt: score.created_at };

  try {
    const { data: rpcRows, error: rpcError } = await admin.rpc("orbitslash_accept_friend_challenge", {
      p_challenge_id: stored.id,
      p_accepting_core_user_id: coreUserId,
      p_run_id: run.id,
      p_score_id: score.id,
      p_result_metadata: metadata,
    });
    if (rpcError) return json({ ok: false, reason: "challenge_accept_failed" }, 500);
    const claimed = await claimFriendChallenge(async () => {
      const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      return typeof row?.id === "string" && row.status === "accepted" ? { id: row.id } : null;
    });
    if (!claimed.ok) {
      const reason = await resolveRpcClaimFailure(admin, stored.id);
      if (reason === "challenge_expired") await expireChallengeIfDue(admin, stored.id, new Date().toISOString());
      return json({ ok: false, reason }, 409);
    }
  } catch {
    return json({ ok: false, reason: "challenge_accept_failed" }, 500);
  }
  return json({ ok: true, accepted: true, result: metadata });
}

async function resolveRpcClaimFailure(admin: SupabaseClient, challengeId: string): Promise<"challenge_expired" | "challenge_already_accepted"> {
  const { data, error } = await admin.from("orbitslash_friend_challenges")
    .select("status, expires_at")
    .eq("id", challengeId)
    .maybeSingle();
  if (error || !data) return "challenge_already_accepted";
  if (data.status === "expired" || new Date(data.expires_at).getTime() <= Date.now()) return "challenge_expired";
  return "challenge_already_accepted";
}

function validateNewContract(value: Record<string, unknown>): { ok: true; contract: ChallengeContract } | { ok: false; reason: string } {
  const contract = parseContract(value);
  if (!contract) return { ok: false, reason: "challenge_contract_invalid" };
  const expiry = validateFriendChallengeRequestedExpiry(contract.expiresAt, Date.now());
  if (!expiry.ok) return expiry;
  return validatePinnedContract(contract);
}

function validateStoredContract(value: Record<string, unknown>): { ok: true; contract: ChallengeContract } | { ok: false; reason: string } {
  const contract = parseContract({
    seed: value.seed,
    difficulty: value.difficulty,
    rulesHash: value.rules_hash,
    rulesVersion: value.rules_version,
    configVersion: value.config_version,
    expiresAt: value.expires_at,
  });
  if (!contract) return { ok: false, reason: "challenge_contract_invalid" };
  return validatePinnedContract(contract);
}

function validatePinnedContract(contract: ChallengeContract): { ok: true; contract: ChallengeContract } | { ok: false; reason: string } {
  if (Date.parse(contract.expiresAt) <= Date.now()) return { ok: false, reason: "challenge_expired" };
  if (contract.rulesHash !== RANKED_CORE_RULES_HASH) return { ok: false, reason: "rules_hash_mismatch" };
  if (contract.rulesVersion !== RANKED_CORE_SCHEMA_VERSION) return { ok: false, reason: "rules_version_mismatch" };
  if (contract.configVersion !== CURRENT_CONFIG_VERSION) return { ok: false, reason: "config_version_mismatch" };
  return { ok: true, contract };
}

function parseContract(value: Record<string, unknown>): ChallengeContract | null {
  const seed = value.seed;
  const rawDifficulty = value.difficulty;
  const difficulty = shortText(rawDifficulty) ? rawDifficulty : null;
  const rawRulesHash = value.rulesHash;
  const rulesHash = shortText(rawRulesHash) ? rawRulesHash : null;
  const rulesVersion = value.rulesVersion;
  const rawConfigVersion = value.configVersion;
  const configVersion = shortText(rawConfigVersion) ? rawConfigVersion : null;
  const rawExpiresAt = value.expiresAt;
  const expiresAt = canonicalIso(rawExpiresAt) ? rawExpiresAt : null;
  if (typeof seed !== "number" || !Number.isSafeInteger(seed) || seed < 0 || !difficulty || !rulesHash || typeof rulesVersion !== "number" || !Number.isInteger(rulesVersion) || rulesVersion < 1 || rulesVersion > 1000 || !configVersion || !expiresAt) return null;
  return { seed, difficulty, rulesHash, rulesVersion, configVersion, expiresAt };
}

function sameContract(value: Record<string, unknown>, contract: ChallengeContract): boolean {
  return Number(value.seed) === contract.seed
    && value.difficulty === contract.difficulty
    && value.rules_hash === contract.rulesHash
    && Number(value.rules_version) === contract.rulesVersion
    && value.config_version === contract.configVersion;
}

function publicChallenge(value: unknown, nowIso: string): Array<Record<string, unknown>> {
  if (!isRecord(value)) return [];
  const rawStatus = value.status;
  const id = value.id;
  if (rawStatus !== "open" && rawStatus !== "accepted" && rawStatus !== "expired") return [];
  if (typeof id !== "string") return [];
  const contract = parseContract({ seed: value.seed, difficulty: value.difficulty, rulesHash: value.rules_hash, rulesVersion: value.rules_version, configVersion: value.config_version, expiresAt: value.expires_at });
  if (!contract) return [];
  const status = resolveFriendChallengeStatus(rawStatus, contract.expiresAt, Date.parse(nowIso));
  const result = parseResultMetadata(value.accepted_result_metadata);
  return [{ id, ...contract, status, ...(typeof value.accepted_at === "string" ? { acceptedAt: value.accepted_at } : {}), ...(result ? { result } : {}) }];
}

async function expireOwnerChallenges(admin: SupabaseClient, coreUserId: string, nowIso: string): Promise<boolean> {
  const { error } = await admin.from("orbitslash_friend_challenges")
    .update({ status: "expired" })
    .eq("owner_core_user_id", coreUserId)
    .eq("status", "open")
    .lte("expires_at", nowIso);
  return !error;
}

async function expireChallengeIfDue(admin: SupabaseClient, challengeId: string, nowIso: string): Promise<boolean> {
  const { error } = await admin.from("orbitslash_friend_challenges")
    .update({ status: "expired" })
    .eq("id", challengeId)
    .eq("status", "open")
    .lte("expires_at", nowIso);
  return !error;
}

function parseResultMetadata(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.score) || !Number.isSafeInteger(value.survivalMs) || !Number.isSafeInteger(value.kills) || !Number.isSafeInteger(value.maxCombo) || !canonicalIso(value.verifiedAt)) return null;
  const score = value.score;
  const survivalMs = value.survivalMs;
  const kills = value.kills;
  const maxCombo = value.maxCombo;
  const verifiedAt = value.verifiedAt;
  if (typeof score !== "number" || typeof survivalMs !== "number" || typeof kills !== "number" || typeof maxCombo !== "number" || typeof verifiedAt !== "string") return null;
  return { score, survivalMs, kills, maxCombo, verifiedAt };
}

async function resolveCoreUserId(admin: SupabaseClient, supabaseUrl: string, anonKey: string, header: string | null): Promise<string | null> {
  const token = /^Bearer\s+(.+)$/i.exec(header ?? "")?.[1];
  if (!token || token === anonKey) return null;
  const publicClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await publicClient.auth.getUser(token);
  if (!data.user?.id) return null;
  const { data: identity } = await admin.from("authmap_user_identities").select("core_user_id").eq("provider", "supabase_auth").eq("provider_user_id", data.user.id).maybeSingle();
  return typeof identity?.core_user_id === "string" ? identity.core_user_id : null;
}

function createOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `osc1_${base64UrlEncode(bytes)}`;
}

function containsSensitiveKey(value: unknown): boolean { if (!value || typeof value !== "object") return false; if (Array.isArray(value)) return value.some(containsSensitiveKey); return Object.entries(value as Record<string, unknown>).some(([key, child]) => SENSITIVE_KEYS.includes(key) || containsSensitiveKey(child)); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function shortText(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 160; }
function opaqueToken(value: unknown): value is string { return typeof value === "string" && /^osc1_[A-Za-z0-9_-]{24,}$/.test(value); }
function canonicalIso(value: unknown): value is string { if (typeof value !== "string" || value.length > 40) return false; const time = Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString() === value; }
function base64UrlEncode(bytes: Uint8Array): string { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function json(payload: unknown, status = 200): Response { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
