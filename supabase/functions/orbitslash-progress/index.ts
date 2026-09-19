import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mergeProgressSnapshots } from "../_shared/orbitslash-progress-merge.ts";

const SENSITIVE_KEYS = ["userKey", "tossUserKey", "providerUserId", "provider_user_id", "advertisingId", "deviceId", "inviteCode", "nickname", "freeText", "fullUrl"];
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

interface Mutation { id: string; type: string; createdAt: string; }
interface SyncRequest { snapshot: Record<string, unknown>; mutations: Mutation[]; }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true }, 200);
  if (request.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ ok: false, reason: "server_not_configured" }, 500);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false, reason: "invalid_json" }, 400); }
  if (containsSensitiveKey(body)) return json({ ok: false, reason: "sensitive_payload" }, 400);
  const parsed = parseSync(body);
  if (!parsed.ok) return json(parsed, 400);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const coreUserId = await resolveCoreUserId(admin, supabaseUrl, anonKey, request.headers.get("Authorization"));
  if (!coreUserId) return json({ ok: false, reason: "identity_not_bound" }, 401);
  const persisted = await persistMergedSnapshot(admin, coreUserId, parsed.snapshot);
  if (!persisted.ok) return json({ ok: false, reason: persisted.reason }, 500);
  const rows = parsed.mutations.map((mutation) => ({ id: mutation.id, core_user_id: coreUserId, mutation_type: mutation.type, payload_json: {}, created_at: mutation.createdAt }));
  if (rows.length > 0) {
    const { error } = await admin.from("orbitslash_progress_mutations").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (error) return json({ ok: false, reason: "mutation_write_failed" }, 500);
  }
  return json({ ok: true, snapshot: persisted.snapshot, acknowledgedMutationIds: parsed.mutations.map((mutation) => mutation.id), revision: persisted.revision });
});

async function persistMergedSnapshot(
  admin: SupabaseClient,
  coreUserId: string,
  incoming: Record<string, unknown>,
): Promise<{ ok: true; snapshot: Record<string, unknown>; revision: number } | { ok: false; reason: "snapshot_read_failed" | "snapshot_write_failed" | "snapshot_write_conflict" }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: previous, error: previousError } = await admin
      .from("orbitslash_progress_snapshots")
      .select("revision, snapshot_json")
      .eq("core_user_id", coreUserId)
      .maybeSingle();
    if (previousError) return { ok: false, reason: "snapshot_read_failed" };

    const revision = Number(previous?.revision ?? 0);
    const snapshot = mergeProgressSnapshots(
      previous?.snapshot_json && typeof previous.snapshot_json === "object" && !Array.isArray(previous.snapshot_json)
        ? previous.snapshot_json as Record<string, unknown>
        : {},
      incoming,
    );
    const nextRevision = revision + 1;
    const payload = { core_user_id: coreUserId, revision: nextRevision, snapshot_json: snapshot, updated_at: new Date().toISOString() };

    if (!previous) {
      const { data: inserted, error } = await admin
        .from("orbitslash_progress_snapshots")
        .insert(payload)
        .select("revision")
        .maybeSingle();
      if (!error && inserted?.revision === nextRevision) return { ok: true, snapshot, revision: nextRevision };
      continue;
    }

    const { data: updated, error } = await admin
      .from("orbitslash_progress_snapshots")
      .update(payload)
      .eq("core_user_id", coreUserId)
      .eq("revision", revision)
      .select("revision")
      .maybeSingle();
    if (!error && updated?.revision === nextRevision) return { ok: true, snapshot, revision: nextRevision };
    if (error && attempt === 2) return { ok: false, reason: "snapshot_write_failed" };
  }
  return { ok: false, reason: "snapshot_write_conflict" };
}

function parseSync(value: unknown): { ok: true; snapshot: Record<string, unknown>; mutations: Mutation[] } | { ok: false; reason: string } {
  if (!value || typeof value !== "object") return { ok: false, reason: "payload_invalid" };
  const record = value as Record<string, unknown>;
  if (record.action !== "sync") return { ok: false, reason: "action_invalid" };
  if (!record.snapshot || typeof record.snapshot !== "object" || Array.isArray(record.snapshot)) return { ok: false, reason: "snapshot_invalid" };
  if (!Array.isArray(record.mutations) || record.mutations.length > 50) return { ok: false, reason: "mutations_invalid" };
  const mutations: Mutation[] = [];
  for (const item of record.mutations) {
    if (!item || typeof item !== "object") return { ok: false, reason: "mutation_invalid" };
    const mutation = item as Record<string, unknown>;
    if (!isUuid(mutation.id) || !shortText(mutation.type) || !shortText(mutation.createdAt) || Number.isNaN(Date.parse(String(mutation.createdAt)))) return { ok: false, reason: "mutation_invalid" };
    mutations.push({ id: String(mutation.id), type: String(mutation.type), createdAt: String(mutation.createdAt) });
  }
  return { ok: true, snapshot: record.snapshot as Record<string, unknown>, mutations };
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

function containsSensitiveKey(value: unknown): boolean { if (!value || typeof value !== "object") return false; if (Array.isArray(value)) return value.some(containsSensitiveKey); return Object.entries(value as Record<string, unknown>).some(([key, child]) => SENSITIVE_KEYS.includes(key) || containsSensitiveKey(child)); }
function isUuid(value: unknown): boolean { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function shortText(value: unknown): boolean { return typeof value === "string" && value.length > 0 && value.length <= 160; }
function json(payload: unknown, status = 200): Response { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
