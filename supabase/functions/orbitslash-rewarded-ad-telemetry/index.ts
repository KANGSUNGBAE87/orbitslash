import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EVENT_NAMES = [
  "preload_started",
  "loaded",
  "show_requested",
  "shown",
  "impression",
  "user_earned_reward",
  "dismissed",
  "failed",
] as const;
const PLACEMENTS = ["free_defense_revive", "free_defense_extra_play", "story_retry", "ranked_retry_ticket", "boss_rush_retry"] as const;
const RUNTIMES = ["web_stub", "apps_in_toss", "google_play"] as const;
const RUNTIME_CHANNELS = ["sandbox", "toss_private_test", "toss_live"] as const;
const FINAL_EVENTS = ["user_earned_reward", "dismissed", "failed"] as const;
const SENSITIVE_KEYS = ["userKey", "tossUserKey", "advertisingId", "deviceId", "inviteCode", "nickname", "answerPayload", "fullUrl"];
const MAX_BATCH_EVENTS = 20;
const MAX_TEXT_LENGTH = 160;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EventName = (typeof EVENT_NAMES)[number];
type Placement = (typeof PLACEMENTS)[number];
type Runtime = (typeof RUNTIMES)[number];
type RuntimeChannel = (typeof RUNTIME_CHANNELS)[number];
type FinalEvent = (typeof FINAL_EVENTS)[number];

interface RewardedAdTelemetryPayload {
  clientEventId: string;
  sessionTraceId: string;
  runToken?: string;
  placement: Placement;
  eventName: EventName;
  screen: string;
  modeId?: string;
  runtime: Runtime;
  runtimeChannel?: RuntimeChannel;
  sdkEventType?: string;
  placementKey?: string;
  placementId?: string;
  adGroupId?: string;
  reason?: string;
  shown?: boolean;
  rewardEarned?: boolean;
  dismissed?: boolean;
  eventSequence: number;
  finalEvent?: FinalEvent;
  showToRewardMs?: number;
  rewardToDismissMs?: number;
  showToDismissMs?: number;
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

  const rows = parsed.events.map((event) => ({
    client_event_id: event.clientEventId,
    session_trace_id: event.sessionTraceId,
    run_token: event.runToken ?? null,
    core_user_id: null,
    placement: event.placement,
    event_name: event.eventName,
    screen: event.screen,
    mode_id: event.modeId ?? null,
    runtime: event.runtime,
    runtime_channel: event.runtimeChannel ?? null,
    sdk_event_type: event.sdkEventType ?? null,
    placement_key: event.placementKey ?? null,
    placement_id: event.placementId ?? null,
    ad_group_id: event.adGroupId ?? null,
    reason: event.reason ?? null,
    shown: event.shown ?? false,
    reward_earned: event.rewardEarned ?? false,
    dismissed: event.dismissed ?? false,
    event_sequence: event.eventSequence,
    final_event: event.finalEvent ?? null,
    show_to_reward_ms: event.showToRewardMs ?? null,
    reward_to_dismiss_ms: event.rewardToDismissMs ?? null,
    show_to_dismiss_ms: event.showToDismissMs ?? null,
    client_at: event.clientAt,
    app_version: event.appVersion ?? null,
    build_version: event.buildVersion ?? null,
    deployment_id: event.deploymentId ?? null,
    extra: event.extra ?? {},
  }));

  const { error } = await supabase.from("orbitslash_rewarded_ad_events").upsert(rows, {
    onConflict: "client_event_id",
    ignoreDuplicates: true,
  });

  if (error) return json({ ok: false, reason: "rewarded_ad_telemetry_insert_failed" }, 500);
  return json({ ok: true, accepted: true, acceptedCount: rows.length, rejected: [] });
});

function validateRequest(body: unknown): { ok: true; events: RewardedAdTelemetryPayload[] } | { ok: false; reason: string } {
  if (!body || typeof body !== "object") return { ok: false, reason: "payload_invalid" };
  const record = body as Record<string, unknown>;
  if (record.action !== "record") return { ok: false, reason: "action_invalid" };
  const events = record.events;
  if (!Array.isArray(events) || events.length === 0) return { ok: false, reason: "events_missing" };
  if (events.length > 20 || events.length > MAX_BATCH_EVENTS) return { ok: false, reason: "events_batch_too_large" };
  const parsed: RewardedAdTelemetryPayload[] = [];
  for (const event of events) {
    const validation = validateEvent(event);
    if (!validation.ok) return validation;
    parsed.push(validation.event);
  }
  return { ok: true, events: parsed };
}

function validateEvent(event: unknown): { ok: true; event: RewardedAdTelemetryPayload } | { ok: false; reason: string } {
  if (!event || typeof event !== "object") return { ok: false, reason: "event_invalid" };
  const record = event as Record<string, unknown>;
  if (!shortText(record.clientEventId)) return { ok: false, reason: "client_event_id_invalid" };
  if (!shortText(record.sessionTraceId)) return { ok: false, reason: "session_trace_id_invalid" };
  if (!isPlacement(record.placement)) return { ok: false, reason: "placement_invalid" };
  if (!isEventName(record.eventName)) return { ok: false, reason: "event_name_invalid" };
  if (!shortText(record.screen)) return { ok: false, reason: "screen_invalid" };
  if (!isRuntime(record.runtime)) return { ok: false, reason: "runtime_invalid" };
  if (record.runtime === "apps_in_toss" && !isRuntimeChannel(record.runtimeChannel)) return { ok: false, reason: "runtime_channel_invalid" };
  if (record.runtimeChannel != null && !isRuntimeChannel(record.runtimeChannel)) return { ok: false, reason: "runtime_channel_invalid" };
  if (!Number.isInteger(record.eventSequence) || Number(record.eventSequence) <= 0) return { ok: false, reason: "event_sequence_invalid" };
  if (!shortText(record.clientAt) || Number.isNaN(Date.parse(String(record.clientAt)))) return { ok: false, reason: "client_at_invalid" };
  if (record.finalEvent != null && !isFinalEvent(record.finalEvent)) return { ok: false, reason: "final_event_invalid" };
  for (const key of ["showToRewardMs", "rewardToDismissMs", "showToDismissMs"]) {
    const value = record[key];
    if (value != null && (!Number.isFinite(value) || Number(value) < 0)) return { ok: false, reason: "duration_invalid" };
  }
  for (const key of ["runToken", "modeId", "sdkEventType", "placementKey", "placementId", "adGroupId", "reason", "appVersion", "buildVersion", "deploymentId"]) {
    const value = record[key];
    if (value != null && !shortText(value)) return { ok: false, reason: "text_field_invalid" };
  }
  return { ok: true, event: record as unknown as RewardedAdTelemetryPayload };
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

function shortText(value: unknown): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_TEXT_LENGTH;
}

function isEventName(value: unknown): value is EventName {
  return typeof value === "string" && (EVENT_NAMES as readonly string[]).includes(value);
}

function isPlacement(value: unknown): value is Placement {
  return typeof value === "string" && (PLACEMENTS as readonly string[]).includes(value);
}

function isRuntime(value: unknown): value is Runtime {
  return typeof value === "string" && (RUNTIMES as readonly string[]).includes(value);
}

function isRuntimeChannel(value: unknown): value is RuntimeChannel {
  return typeof value === "string" && (RUNTIME_CHANNELS as readonly string[]).includes(value);
}

function isFinalEvent(value: unknown): value is FinalEvent {
  return typeof value === "string" && (FINAL_EVENTS as readonly string[]).includes(value);
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
