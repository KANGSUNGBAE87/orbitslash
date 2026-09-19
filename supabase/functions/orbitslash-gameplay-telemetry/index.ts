import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const EVENT_NAMES = [
  "spawn",
  "directional_reject",
  "combo_break",
  "last_save",
  "skill_fire",
  "death",
  "run_submit",
  "ranked_submission_validation",
  "ranked_submission_result",
  "delta_shield_absorb",
  "wave_start",
  "earth_hit",
  "boss_hit",
  "boss_phase",
] as const;
const MODE_IDS = ["story", "freeDefense", "ranked", "bossRush", "blitz60", "daily"] as const;
const DIFFICULTIES = ["rookie", "defender", "elite", "master"] as const;
const RUNTIMES = ["web_stub", "apps_in_toss", "google_play"] as const;
const RUNTIME_CHANNELS = ["sandbox", "toss_private_test", "toss_live"] as const;
const SENSITIVE_KEYS = [
  "userKey",
  "tossUserKey",
  "providerUserId",
  "provider_user_id",
  "advertisingId",
  "deviceId",
  "inviteCode",
  "nickname",
  "answerPayload",
  "fullUrl",
  "rawMemo",
  "freeText",
];
const MAX_BATCH_EVENTS = 50;
const MAX_TEXT_LENGTH = 160;
const SERVER_RANKED_TOKEN_PREFIX = "server-ranked-";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EventName = (typeof EVENT_NAMES)[number];
type ModeId = (typeof MODE_IDS)[number];
type Difficulty = (typeof DIFFICULTIES)[number];
type Runtime = (typeof RUNTIMES)[number];
type RuntimeChannel = (typeof RUNTIME_CHANNELS)[number];

interface GameplayTelemetryPayload {
  clientEventId: string;
  sessionTraceId: string;
  runToken?: string;
  eventName: EventName;
  screen: string;
  modeId?: ModeId;
  difficulty?: Difficulty;
  runtime: Runtime;
  runtimeChannel?: RuntimeChannel;
  enemyType?: string;
  skillId?: string;
  reason?: string;
  band?: string;
  score?: number;
  survivalMs?: number;
  combo?: number;
  eventSequence: number;
  clientAt: string;
  appVersion?: string;
  buildVersion?: string;
  deploymentId?: string;
  extra?: Record<string, unknown>;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true }, 200);
  if (request.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, reason: "server_not_configured" }, 500);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, reason: "invalid_json" }, 400);
  }
  if (containsSensitiveKey(body)) return json({ ok: false, reason: "sensitive_payload" }, 400);

  const parsed = validateRequest(body);
  if (!parsed.ok) return json(parsed, 400);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authCoreUserId = await resolveCoreUserId(supabase, supabaseUrl, request.headers.get("Authorization"));
  const boundRows = await bindEventsToCoreUsers(supabase, parsed.events, authCoreUserId);
  if (!boundRows.ok) return json(boundRows, 409);

  const rows = boundRows.rows.map(({ event, coreUserId }) => ({
    client_event_id: event.clientEventId,
    session_trace_id: event.sessionTraceId,
    run_token: event.runToken ?? null,
    core_user_id: coreUserId,
    event_name: event.eventName,
    mode_id: event.modeId ?? null,
    difficulty: event.difficulty ?? null,
    screen: event.screen,
    runtime: event.runtime,
    runtime_channel: event.runtimeChannel ?? null,
    enemy_type: event.enemyType ?? null,
    skill_id: event.skillId ?? null,
    reason: event.reason ?? null,
    band: event.band ?? null,
    score: event.score ?? null,
    survival_ms: event.survivalMs ?? null,
    combo: event.combo ?? null,
    event_sequence: event.eventSequence,
    client_at: event.clientAt,
    app_version: event.appVersion ?? null,
    build_version: event.buildVersion ?? null,
    deployment_id: event.deploymentId ?? null,
    extra: event.extra ?? {},
  }));

  const { error } = await supabase.from("orbitslash_gameplay_events").upsert(rows, {
    onConflict: "client_event_id",
    ignoreDuplicates: true,
  });

  if (error) return json({ ok: false, reason: "gameplay_telemetry_insert_failed" }, 500);
  return json({ ok: true, accepted: true, acceptedCount: rows.length, rejected: [] });
});

async function bindEventsToCoreUsers(
  supabase: SupabaseClient,
  events: GameplayTelemetryPayload[],
  authCoreUserId: string | null,
): Promise<{ ok: true; rows: Array<{ event: GameplayTelemetryPayload; coreUserId: string | null }> } | { ok: false; reason: string }> {
  const uniqueRankedTokens = [...new Set(events.flatMap((event) => (event.runToken?.startsWith(SERVER_RANKED_TOKEN_PREFIX) ? [event.runToken] : [])))];
  const runCoreByToken = new Map<string, string>();
  if (uniqueRankedTokens.length > 0) {
    const { data, error } = await supabase.from("orbitslash_runs").select("run_token, core_user_id").in("run_token", uniqueRankedTokens);
    if (error) return { ok: false, reason: "run_lookup_failed" };
    for (const row of data ?? []) {
      if (typeof row.run_token === "string" && typeof row.core_user_id === "string") {
        runCoreByToken.set(row.run_token, row.core_user_id);
      }
    }
  }

  const rows: Array<{ event: GameplayTelemetryPayload; coreUserId: string | null }> = [];
  for (const event of events) {
    let coreUserId = authCoreUserId;
    if (event.runToken?.startsWith(SERVER_RANKED_TOKEN_PREFIX)) {
      const runCoreUserId = runCoreByToken.get(event.runToken);
      if (!runCoreUserId) return { ok: false, reason: "run_identity_not_bound" };
      if (authCoreUserId && authCoreUserId !== runCoreUserId) return { ok: false, reason: "run_identity_mismatch" };
      coreUserId = runCoreUserId;
    }
    rows.push({ event, coreUserId });
  }
  return { ok: true, rows };
}

function validateRequest(body: unknown): { ok: true; events: GameplayTelemetryPayload[] } | { ok: false; reason: string } {
  if (!body || typeof body !== "object") return { ok: false, reason: "payload_invalid" };
  const record = body as Record<string, unknown>;
  if (record.action !== "record") return { ok: false, reason: "action_invalid" };
  const events = record.events;
  if (!Array.isArray(events) || events.length === 0) return { ok: false, reason: "events_missing" };
  if (events.length > 50 || events.length > MAX_BATCH_EVENTS) return { ok: false, reason: "events_batch_too_large" };
  const parsed: GameplayTelemetryPayload[] = [];
  for (const event of events) {
    const validation = validateEvent(event);
    if (!validation.ok) return validation;
    parsed.push(validation.event);
  }
  return { ok: true, events: parsed };
}

function validateEvent(event: unknown): { ok: true; event: GameplayTelemetryPayload } | { ok: false; reason: string } {
  if (!event || typeof event !== "object") return { ok: false, reason: "event_invalid" };
  const record = event as Record<string, unknown>;
  if (!shortText(record.clientEventId)) return { ok: false, reason: "client_event_id_invalid" };
  if (!shortText(record.sessionTraceId)) return { ok: false, reason: "session_trace_id_invalid" };
  if (!isEventName(record.eventName)) return { ok: false, reason: "event_name_invalid" };
  if (!shortText(record.screen)) return { ok: false, reason: "screen_invalid" };
  if (!isRuntime(record.runtime)) return { ok: false, reason: "runtime_invalid" };
  if (record.runtime === "apps_in_toss" && !isRuntimeChannel(record.runtimeChannel)) return { ok: false, reason: "runtime_channel_invalid" };
  if (record.runtimeChannel != null && !isRuntimeChannel(record.runtimeChannel)) return { ok: false, reason: "runtime_channel_invalid" };
  if (record.modeId != null && !isModeId(record.modeId)) return { ok: false, reason: "mode_id_invalid" };
  if (record.difficulty != null && !isDifficulty(record.difficulty)) return { ok: false, reason: "difficulty_invalid" };
  if (!Number.isInteger(record.eventSequence) || Number(record.eventSequence) <= 0) return { ok: false, reason: "event_sequence_invalid" };
  if (!shortText(record.clientAt) || Number.isNaN(Date.parse(String(record.clientAt)))) return { ok: false, reason: "client_at_invalid" };
  for (const key of ["score", "survivalMs", "combo"]) {
    const value = record[key];
    if (value != null && (!Number.isSafeInteger(value) || Number(value) < 0)) return { ok: false, reason: "metric_invalid" };
  }
  for (const key of ["runToken", "enemyType", "skillId", "reason", "band", "appVersion", "buildVersion", "deploymentId"]) {
    const value = record[key];
    if (value != null && !shortText(value)) return { ok: false, reason: "text_field_invalid" };
  }
  return { ok: true, event: record as unknown as GameplayTelemetryPayload };
}

function containsSensitiveKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsSensitiveKey);
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.includes(key)) return true;
    if (containsSensitiveKey(child)) return true;
  }
  return false;
}

async function resolveCoreUserId(
  supabase: SupabaseClient,
  supabaseUrl: string,
  authorizationHeader: string | null,
): Promise<string | null> {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const token = bearerToken(authorizationHeader);
  if (!anonKey || !token || token === anonKey) return null;

  const publicClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await publicClient.auth.getUser(token);
  const authUserId = data.user?.id;
  if (error || !authUserId) return null;

  const { data: identity } = await supabase
    .from("authmap_user_identities")
    .select("core_user_id")
    .eq("provider", "supabase_auth")
    .eq("provider_user_id", authUserId)
    .maybeSingle();
  return typeof identity?.core_user_id === "string" ? identity.core_user_id : null;
}

function bearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? "");
  return match?.[1] ?? null;
}

function shortText(value: unknown): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_TEXT_LENGTH;
}

function isEventName(value: unknown): value is EventName {
  return typeof value === "string" && (EVENT_NAMES as readonly string[]).includes(value);
}

function isModeId(value: unknown): value is ModeId {
  return typeof value === "string" && (MODE_IDS as readonly string[]).includes(value);
}

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}

function isRuntime(value: unknown): value is Runtime {
  return typeof value === "string" && (RUNTIMES as readonly string[]).includes(value);
}

function isRuntimeChannel(value: unknown): value is RuntimeChannel {
  return typeof value === "string" && (RUNTIME_CHANNELS as readonly string[]).includes(value);
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
