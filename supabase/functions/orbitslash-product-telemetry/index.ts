import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRODUCT_EVENT_NAMES = ["app_open", "home_view", "primary_start", "tutorial_step_started", "tutorial_step_completed", "tutorial_complete", "run_end", "retry_selected", "unlock_reveal", "collection_open", "weekly_reward_claimed", "return_next_day"] as const;
const RUNTIMES = ["web_stub", "apps_in_toss", "google_play"] as const;
const RUNTIME_CHANNELS = ["sandbox", "toss_private_test", "toss_live"] as const;
const ALLOWED_PROPS: Record<(typeof PRODUCT_EVENT_NAMES)[number], readonly string[]> = {
  app_open: ["locale", "runtime"], home_view: ["locale"], primary_start: ["modeId", "storyStageId"], tutorial_step_started: ["tutorialStep"], tutorial_step_completed: ["tutorialStep"], tutorial_complete: ["locale"], run_end: ["modeId", "storyStageId", "tutorialStep"], retry_selected: ["modeId"], unlock_reveal: ["unlockCount"], collection_open: ["source"], weekly_reward_claimed: ["weekKey", "titleId"], return_next_day: ["dayKey"],
};
const SENSITIVE_KEYS = ["userKey", "tossUserKey", "providerUserId", "provider_user_id", "advertisingId", "deviceId", "inviteCode", "nickname", "freeText", "fullUrl"];
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];
type Runtime = (typeof RUNTIMES)[number];
type RuntimeChannel = (typeof RUNTIME_CHANNELS)[number];
interface ProductEvent { clientEventId: string; sessionTraceId: string; eventName: ProductEventName; eventSequence: number; runtime: Runtime; runtimeChannel?: RuntimeChannel; deploymentId?: string; clientAt: string; props: Record<string, string | number | boolean>; }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true }, 200);
  if (request.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, reason: "server_not_configured" }, 500);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false, reason: "invalid_json" }, 400); }
  if (containsSensitiveKey(body)) return json({ ok: false, reason: "sensitive_payload" }, 400);
  const parsed = validateRequest(body);
  if (!parsed.ok) return json(parsed, 400);
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const rows = parsed.events.map((event) => ({ client_event_id: event.clientEventId, session_trace_id: event.sessionTraceId, core_user_id: null, event_name: event.eventName, event_sequence: event.eventSequence, runtime: event.runtime, runtime_channel: event.runtimeChannel ?? null, deployment_id: event.deploymentId ?? null, client_at: event.clientAt, props: event.props }));
  const { error } = await supabase.from("orbitslash_product_events").upsert(rows, { onConflict: "client_event_id", ignoreDuplicates: true });
  if (error) return json({ ok: false, reason: "product_telemetry_insert_failed" }, 500);
  return json({ ok: true, accepted: true, acceptedCount: rows.length });
});

function validateRequest(body: unknown): { ok: true; events: ProductEvent[] } | { ok: false; reason: string } {
  if (!body || typeof body !== "object") return { ok: false, reason: "payload_invalid" };
  const record = body as Record<string, unknown>;
  if (record.action !== "record") return { ok: false, reason: "action_invalid" };
  if (!Array.isArray(record.events) || record.events.length === 0) return { ok: false, reason: "events_missing" };
  if (record.events.length > 50) return { ok: false, reason: "events_batch_too_large" };
  const events: ProductEvent[] = [];
  for (const event of record.events) { const parsed = validateEvent(event); if (!parsed.ok) return parsed; events.push(parsed.event); }
  return { ok: true, events };
}

function validateEvent(value: unknown): { ok: true; event: ProductEvent } | { ok: false; reason: string } {
  if (!value || typeof value !== "object") return { ok: false, reason: "event_invalid" };
  const record = value as Record<string, unknown>;
  if (!shortText(record.clientEventId) || !shortText(record.sessionTraceId)) return { ok: false, reason: "trace_invalid" };
  if (!isEventName(record.eventName)) return { ok: false, reason: "event_name_invalid" };
  if (!isRuntime(record.runtime)) return { ok: false, reason: "runtime_invalid" };
  if (record.runtime === "apps_in_toss" && !isRuntimeChannel(record.runtimeChannel)) return { ok: false, reason: "runtime_channel_invalid" };
  if (record.runtimeChannel != null && !isRuntimeChannel(record.runtimeChannel)) return { ok: false, reason: "runtime_channel_invalid" };
  if (!Number.isInteger(record.eventSequence) || Number(record.eventSequence) < 1) return { ok: false, reason: "event_sequence_invalid" };
  if (!shortText(record.clientAt) || Number.isNaN(Date.parse(String(record.clientAt)))) return { ok: false, reason: "client_at_invalid" };
  if (record.deploymentId != null && !shortText(record.deploymentId)) return { ok: false, reason: "deployment_id_invalid" };
  if (!propsAllowed(record.eventName, record.props)) return { ok: false, reason: "props_invalid" };
  return { ok: true, event: record as unknown as ProductEvent };
}

function propsAllowed(eventName: ProductEventName, value: unknown): value is Record<string, string | number | boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const allowed = ALLOWED_PROPS[eventName];
  return Object.entries(value as Record<string, unknown>).every(([key, item]) => allowed.includes(key) && (typeof item === "string" || typeof item === "number" || typeof item === "boolean"));
}
function containsSensitiveKey(value: unknown): boolean { if (!value || typeof value !== "object") return false; if (Array.isArray(value)) return value.some(containsSensitiveKey); return Object.entries(value as Record<string, unknown>).some(([key, child]) => SENSITIVE_KEYS.includes(key) || containsSensitiveKey(child)); }
function shortText(value: unknown): boolean { return typeof value === "string" && value.length > 0 && value.length <= 160; }
function isEventName(value: unknown): value is ProductEventName { return typeof value === "string" && (PRODUCT_EVENT_NAMES as readonly string[]).includes(value); }
function isRuntime(value: unknown): value is Runtime { return typeof value === "string" && (RUNTIMES as readonly string[]).includes(value); }
function isRuntimeChannel(value: unknown): value is RuntimeChannel { return typeof value === "string" && (RUNTIME_CHANNELS as readonly string[]).includes(value); }
function json(payload: unknown, status = 200): Response { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
