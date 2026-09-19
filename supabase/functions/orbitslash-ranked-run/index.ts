import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RANKED_CORE_RULES_HASH, RANKED_CORE_SCHEMA_VERSION } from "../_shared/orbitslash-ranked-core.generated.ts";
import { RANKED_BOSS_DEFINITIONS, RANKED_CORE_RULES } from "../_shared/ranked-core/data.ts";
import { generateRankedCoreSpawns } from "../_shared/ranked-core/spawn.ts";
import { replayRankedScore, validateRankedSkillTimeline } from "../_shared/ranked-core/score.ts";
import { deriveRankedReplaySpawns } from "../_shared/ranked-core/replay.ts";

type DifficultyId = "rookie" | "defender" | "elite" | "master";
type RankedAction = "begin" | "submit" | "leaderboard" | "debugRejectedRuns";

interface RankedSummary {
  modeId: "ranked";
  runToken: string;
  seed: number;
  difficulty: DifficultyId;
  survivalMs: number;
  score: number;
  kills: number;
  maxCombo: number;
  lastSaveCount: number;
  remainingEnergy: number;
  skillUse?: Record<string, number>;
}

interface RankedReplayTrace {
  spawnEvents?: Array<{
    spawnOrdinal: number;
    enemyType: string;
    spawnAtMs: number;
    startAngleRad: number;
    startRadius: number;
    angularSpeed: number;
    approachSpeed: number;
    source: "wave" | "boss" | "split" | "boss_shard";
    parentSpawnOrdinal?: number;
  }>;
  hitEvents: Array<{
    eventSequence?: number;
    spawnOrdinal: number;
    hitAtMs: number;
    band: string;
    accuracy: string;
    damage: number;
    absorbed?: "shield" | "armor";
    damageMultiplier?: number;
    source?: string;
    skillId?: string;
    segment?: EdgeSegment;
  }>;
  killEvents: Array<{
    eventSequence?: number;
    spawnOrdinal: number;
    hitAtMs: number;
    band: string;
    accuracy: string;
    damage?: number;
    damageMultiplier?: number;
    source?: string;
    skillId?: string;
    segment?: EdgeSegment;
  }>;
  comboBreakEvents: Array<{ atMs: number; reason: string }>;
  skillEvents: Array<{ eventSequence?: number; skillId: string; atMs: number }>;
}

interface EdgePoint {
  x: number;
  y: number;
  t?: number;
}

interface EdgeSegment {
  a: EdgePoint;
  b: EdgePoint;
}

interface EdgeWeakPointDef {
  activePhaseLabels?: readonly string[];
  angleDeg: number;
  radiusRatio: number;
  damageMultiplier: number;
}

interface EdgeBossDefinition {
  phases: readonly { atHpRatio: number; label: string }[];
  weakPoints: readonly EdgeWeakPointDef[];
  requiresWeakPointDamage?: boolean;
}

interface EdgeSpawnSpec {
  spawnOrdinal?: number;
  enemyType: string;
  spawnAtMs: number;
  startAngleRad: number;
  startRadius: number;
  angularSpeed: number;
  approachSpeed: number;
}

interface EdgeReplaySpawnSpec extends EdgeSpawnSpec {
  spawnOrdinal: number;
  source: "wave" | "boss" | "split";
  parentSpawnOrdinal?: number;
}

interface EdgeEnemyDef {
  startRadius: number;
  approachSpeed: number;
  angularSpeed: number;
  radiusPx: number;
  hp: number;
  score: number;
  directional: boolean;
  directionalToleranceDeg?: number;
  boss?: boolean;
  ignoreSpeedScale?: boolean;
  splitInto?: string;
  splitCount?: number;
  shieldHits?: number;
  armorHits?: number;
}

const CONFIG_VERSION = "server-ranked-v1";
const VALIDATION_VERSION = "ranked-v1";
const RUN_TTL_MS = 15 * 60 * 1000;
const DIFFICULTIES: readonly DifficultyId[] = ["rookie", "defender", "elite", "master"];
const DISTANCE_BANDS = ["outer", "mid", "danger", "lastSave", "impact"] as const;
const ACCURACY_KINDS = ["normal", "directional", "weakCenter", "bossWeak"] as const;
const COMBO_BREAK_REASONS = ["miss", "earth_hit"] as const;
const SKILL_IDS = ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield", "nova_pulse"] as const;
const TOP_HUD_SAFE_Y = RANKED_CORE_RULES.ranked.topHudSafeY;
const EARTH_CENTER_X = RANKED_CORE_RULES.ranked.earthCenterX;
const EARTH_CENTER_Y = RANKED_CORE_RULES.ranked.earthCenterY;
const EARTH_GAMEPLAY_RADIUS = RANKED_CORE_RULES.ranked.earthGameplayRadius;
const START_VISUAL_RADIUS_SAFE_SCALE = RANKED_CORE_RULES.ranked.startVisualRadiusSafeScale;
const NORMAL_SLASH_HIT_INFLATE_PX = RANKED_CORE_RULES.ranked.normalSlashHitInflatePx;
const SOLAR_LANCE_HIT_INFLATE_PX = RANKED_CORE_RULES.ranked.solarLanceHitInflatePx;
const LIVE_SEGMENT_MIN_LENGTH_PX = RANKED_CORE_RULES.ranked.liveSegmentMinLengthPx;
const SOLAR_LANCE_HIT_DAMAGE = RANKED_CORE_RULES.skills.solar_lance.hitDamage ?? 1;
const ORBITAL_CUT_HIT_DAMAGE = RANKED_CORE_RULES.skills.orbital_cut.hitDamage ?? 2;
const NOVA_PULSE_HIT_DAMAGE = RANKED_CORE_RULES.skills.nova_pulse.hitDamage ?? 1;
const DIFFICULTY_GRAVITY_SWELL = Object.fromEntries(
  DIFFICULTIES.map((difficulty) => [difficulty, (RANKED_CORE_RULES.difficulty[difficulty] as { gravitySwell: number }).gravitySwell]),
) as Record<DifficultyId, number>;

// Rules/data are generated from the same JSON snapshot as the player runtime.
const ENEMIES: Record<string, EdgeEnemyDef> = RANKED_CORE_RULES.enemies as unknown as Record<string, EdgeEnemyDef>;
const BOSS_DEFINITIONS: Record<string, EdgeBossDefinition> = RANKED_BOSS_DEFINITIONS as unknown as Record<string, EdgeBossDefinition>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true }, 200);
  if (request.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, reason: "server_env_missing" }, 500);

  let body: {
    action?: RankedAction;
    difficulty?: DifficultyId;
    summary?: RankedSummary;
    replayTrace?: RankedReplayTrace;
    rulesHash?: string;
    rulesVersion?: number;
    limit?: number;
    weekKey?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, reason: "invalid_json" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (body.action === "begin") {
    return beginRankedRun(supabase, body.difficulty, request.headers.get("Authorization"), supabaseUrl, body.rulesHash, body.rulesVersion);
  }
  if (body.action === "submit") {
    return submitRankedRun(
      supabase,
      body.summary,
      body.replayTrace,
      body.rulesHash,
      body.rulesVersion,
      request.headers.get("Authorization"),
      supabaseUrl,
    );
  }
  if (body.action === "leaderboard") return publicLeaderboard(supabase, body.difficulty, body.weekKey, body.limit);
  if (body.action === "debugRejectedRuns") return adminRejectedRuns(supabase, request.headers.get("Authorization"), body.limit);
  return json({ ok: false, reason: "unknown_action" }, 400);
});

async function beginRankedRun(
  supabase: SupabaseClient,
  difficulty: unknown,
  authorizationHeader: string | null,
  supabaseUrl: string,
  rulesHash: unknown,
  rulesVersion: unknown,
): Promise<Response> {
  if (!matchesCurrentRankedRulesContract(rulesHash, rulesVersion)) {
    return json({ ok: false, reason: "ranked_rules_mismatch" }, 409);
  }
  if (!isDifficulty(difficulty)) return json({ ok: false, reason: "invalid_difficulty" }, 400);

  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + RUN_TTL_MS;
  const seed = createRankedWeeklySeed(difficulty, issuedAtMs);
  const weekKey = rankedWeekKey(issuedAtMs);
  const runToken = `server-ranked-${crypto.randomUUID()}`;
  const coreUserId = await resolveCoreUserId(supabase, supabaseUrl, authorizationHeader);
  const identityBound = Boolean(coreUserId);

  const { error } = await supabase.from("orbitslash_runs").insert({
    run_token: runToken,
    core_user_id: coreUserId,
    seed,
    difficulty,
    week_key: weekKey,
    config_version: CONFIG_VERSION,
    ranking_strategy: "hybrid:supabase_verified+apps_in_toss_leaderboard_bridge",
    status: "started",
    expires_at: new Date(expiresAtMs).toISOString(),
    validation_version: VALIDATION_VERSION,
    rules_hash: RANKED_CORE_RULES_HASH,
    rules_version: RANKED_CORE_SCHEMA_VERSION,
  });

  if (error) return json({ ok: false, reason: "begin_insert_failed" }, 500);

  return json({
    ok: true,
    start: {
      modeId: "ranked",
      runToken,
      seed,
      difficulty,
      configVersion: CONFIG_VERSION,
      rulesHash: RANKED_CORE_RULES_HASH,
      rulesVersion: RANKED_CORE_SCHEMA_VERSION,
      rankingEligible: identityBound,
      verification: "server_verified",
      identityBound,
      issuedAtMs,
      expiresAtMs,
    },
  });
}

async function submitRankedRun(
  supabase: SupabaseClient,
  summary: unknown,
  replayTrace: unknown,
  rulesHash: unknown,
  rulesVersion: unknown,
  authorizationHeader: string | null,
  supabaseUrl: string,
): Promise<Response> {
  if (!matchesCurrentRankedRulesContract(rulesHash, rulesVersion)) {
    return json({ ok: false, reason: "ranked_rules_mismatch" }, 409);
  }
  const summaryValidation = validateSummary(summary);
  if (!summaryValidation.ok) return json(summaryValidation, 400);

  const { data: run, error: runError } = await supabase
    .from("orbitslash_runs")
    .select("id, run_token, seed, difficulty, config_version, status, expires_at, used_at, core_user_id, rules_hash, rules_version")
    .eq("run_token", summaryValidation.summary.runToken)
    .maybeSingle();

  if (runError) return json({ ok: false, reason: "run_lookup_failed" }, 500);
  if (!run) return json({ ok: false, reason: "run_not_found" }, 404);
  if (!matchesCurrentRankedRulesContract(run.rules_hash, run.rules_version)) {
    return json({ ok: false, reason: "ranked_rules_mismatch" }, 409);
  }
  if (run.status !== "started" || run.used_at) return json({ ok: false, reason: "run_already_used" }, 409);
  if (run.config_version !== CONFIG_VERSION) return json({ ok: false, reason: "config_version_mismatch" }, 409);
  if (new Date(run.expires_at).getTime() <= Date.now()) {
    await supabase.from("orbitslash_runs").update({ status: "expired" }).eq("id", run.id);
    return json({ ok: false, reason: "run_expired" }, 409);
  }
  if (typeof run.core_user_id !== "string" || run.core_user_id.length === 0) {
    return json({ ok: false, reason: "identity_not_bound" }, 409);
  }
  const callerCoreUserId = await resolveCoreUserId(supabase, supabaseUrl, authorizationHeader);
  if (callerCoreUserId !== run.core_user_id) {
    return json({ ok: false, reason: "caller_identity_mismatch" }, 409);
  }

  const replayValidation = validateReplayTrace(summaryValidation.summary, replayTrace);
  if (!replayValidation.ok) {
    await rejectRankedRun(supabase, run.id, replayValidation.reason);
    return json(replayValidation, 400);
  }

  const accepted = validateAgainstRun(summaryValidation.summary, run);
  if (!accepted.ok) {
    await rejectRankedRun(supabase, run.id, accepted.reason);
    return json(accepted, 409);
  }

  const { error: scoreError } = await supabase.from("orbitslash_scores").insert({
    run_id: run.id,
    core_user_id: run.core_user_id,
    score: summaryValidation.summary.score,
    survival_ms: summaryValidation.summary.survivalMs,
    kills: summaryValidation.summary.kills,
    max_combo: summaryValidation.summary.maxCombo,
    last_save_count: summaryValidation.summary.lastSaveCount,
    remaining_energy: summaryValidation.summary.remainingEnergy,
    skill_use: summaryValidation.summary.skillUse ?? {},
    verified: true,
  });

  if (scoreError) return json({ ok: false, reason: "score_insert_failed" }, 500);

  await supabase
    .from("orbitslash_runs")
    .update({ status: "submitted", finished_at: new Date().toISOString(), used_at: new Date().toISOString() })
    .eq("id", run.id);

  return json({ ok: true, accepted: true });
}

async function rejectRankedRun(supabase: SupabaseClient, runId: string, reason: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("orbitslash_runs")
    .update({
      status: "rejected",
      rejection_reason: reason,
      rejected_at: now,
      finished_at: now,
      used_at: now,
    })
    .eq("id", runId);
}

async function publicLeaderboard(supabase: SupabaseClient, difficulty: unknown, weekKey: unknown, limit: unknown): Promise<Response> {
  if (Deno.env.get("PUBLIC_LEADERBOARD_ENABLED") !== "true") {
    return json({ ok: false, reason: "public_leaderboard_disabled" }, 403);
  }
  if (!isDifficulty(difficulty) || !isRankedWeekKey(weekKey)) return json({ ok: false, reason: "leaderboard_partition_invalid" }, 400);
  const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(20, Number(limit))) : 10;
  const { data, error } = await supabase
    .from("orbitslash_scores")
    .select("score, survival_ms, kills, max_combo, created_at, orbitslash_runs!inner(difficulty, week_key)")
    .eq("verified", true)
    .not("core_user_id", "is", null)
    .eq("orbitslash_runs.difficulty", difficulty)
    .eq("orbitslash_runs.week_key", weekKey)
    .order("survival_ms", { ascending: false })
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(safeLimit);

  if (error) return json({ ok: false, reason: "leaderboard_lookup_failed" }, 500);
  if (!Array.isArray(data) || data.length === 0) return json({ ok: false, reason: "identity_bound_runs_missing" }, 200);
  return json({
    ok: true,
    rows: data.map((row: Record<string, unknown>, index: number) => {
      const run = row.orbitslash_runs as Record<string, unknown> | undefined;
      const difficulty = isDifficulty(run?.difficulty) ? run.difficulty : "rookie";
      return {
        rank: index + 1,
        score: Number(row.score),
        survivalMs: Number(row.survival_ms),
        kills: Number(row.kills),
        maxCombo: Number(row.max_combo),
        difficulty,
        createdAt: String(row.created_at),
      };
    }),
  });
}

async function adminRejectedRuns(supabase: SupabaseClient, authorizationHeader: string | null, limit: unknown): Promise<Response> {
  const expectedToken = Deno.env.get("ADMIN_DEBUG_TOKEN");
  if (!expectedToken || bearerToken(authorizationHeader) !== expectedToken) {
    return json({ ok: false, reason: "admin_debug_forbidden" }, 403);
  }
  const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(50, Number(limit))) : 20;
  const { data, error } = await supabase
    .from("orbitslash_runs")
    .select("id, difficulty, config_version, validation_version, rejection_reason, rejected_at, created_at")
    .eq("status", "rejected")
    .order("rejected_at", { ascending: false })
    .limit(safeLimit);

  if (error) return json({ ok: false, reason: "rejected_runs_lookup_failed" }, 500);
  return json({
    ok: true,
    rows: (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
      runId: String(row.id),
      difficulty: isDifficulty(row.difficulty) ? row.difficulty : "rookie",
      configVersion: String(row.config_version ?? ""),
      validationVersion: String(row.validation_version ?? ""),
      rejectionReason: String(row.rejection_reason ?? "unknown"),
      rejectedAt: String(row.rejected_at ?? row.created_at ?? ""),
      createdAt: String(row.created_at ?? ""),
    })),
  });
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

function validateSummary(value: unknown): { ok: true; summary: RankedSummary } | { ok: false; reason: string } {
  if (!value || typeof value !== "object") return { ok: false, reason: "summary_missing" };
  const summary = value as RankedSummary;
  if (summary.modeId !== "ranked") return { ok: false, reason: "summary_not_ranked" };
  if (!summary.runToken?.startsWith("server-ranked-")) return { ok: false, reason: "invalid_token" };
  if (!Number.isSafeInteger(summary.seed) || summary.seed <= 0) return { ok: false, reason: "invalid_seed" };
  if (!isDifficulty(summary.difficulty)) return { ok: false, reason: "invalid_difficulty" };
  for (const field of ["score", "survivalMs", "kills", "maxCombo", "lastSaveCount"] as const) {
    if (!Number.isInteger(summary[field]) || summary[field] < 0) return { ok: false, reason: `${field}_invalid` };
  }
  if (!Number.isInteger(summary.remainingEnergy) || summary.remainingEnergy < 0 || summary.remainingEnergy > 100) {
    return { ok: false, reason: "remaining_energy_invalid" };
  }
  if (summary.skillUse) {
    for (const count of Object.values(summary.skillUse)) {
      if (!Number.isInteger(count) || count < 0) return { ok: false, reason: "skill_use_invalid" };
    }
  }
  return { ok: true, summary };
}

function validateReplayTrace(summary: RankedSummary, value: unknown): { ok: true } | { ok: false; reason: string } {
  if (!value || typeof value !== "object") return { ok: false, reason: "replay_trace_missing" };
  const trace = value as RankedReplayTrace;
  if (!Array.isArray(trace.hitEvents) || !Array.isArray(trace.killEvents) || !Array.isArray(trace.comboBreakEvents) || !Array.isArray(trace.skillEvents)) {
    return { ok: false, reason: "replay_trace_missing" };
  }
  if (!hasValidSemanticEventSequences(trace)) return { ok: false, reason: "replay_trace_summary_mismatch" };
  if (trace.spawnEvents != null) {
    if (!Array.isArray(trace.spawnEvents)) return { ok: false, reason: "replay_trace_missing" };
    const seen = new Set<number>();
    for (const event of trace.spawnEvents) {
      if (!validReplaySpawnEvent(event, summary.survivalMs)) return { ok: false, reason: "replay_trace_summary_mismatch" };
      if (seen.has(event.spawnOrdinal)) return { ok: false, reason: "spawn_sequence_mismatch" };
      seen.add(event.spawnOrdinal);
    }
    if (trace.spawnEvents.some((event) => event.source === "boss_shard")) {
      return { ok: false, reason: "spawn_sequence_mismatch" };
    }
    const spawnRelationship = validateReplaySpawnRelationships(trace);
    if (!spawnRelationship.ok) return spawnRelationship;
  }
  if (trace.killEvents.length !== summary.kills) return { ok: false, reason: "replay_trace_summary_mismatch" };

  const spawnResult = generateReplaySpawnsForTrace(summary, trace);
  if (!spawnResult.ok) return spawnResult;
  const spawns = spawnResult.spawns;
  const spawnByOrdinal = new Map(spawns.map((spawn) => [spawn.spawnOrdinal, spawn] as const));
  const sortedKills = [...trace.killEvents].sort(compareReplayHitOrder);

  const skillCounts: Record<string, number> = {};
  for (const event of trace.skillEvents) {
    if (!Number.isFinite(event.atMs) || event.atMs < 0 || event.atMs > summary.survivalMs) {
      return { ok: false, reason: "replay_trace_invalid_time" };
    }
    if (!isSkillId(event.skillId)) return { ok: false, reason: "replay_trace_summary_mismatch" };
    skillCounts[event.skillId] = (skillCounts[event.skillId] ?? 0) + 1;
  }
  for (const [skillId, count] of Object.entries(summary.skillUse ?? {})) {
    if ((skillCounts[skillId] ?? 0) !== count) return { ok: false, reason: "replay_trace_summary_mismatch" };
  }

  const hitProgression = replayHitProgression(trace.hitEvents, spawnByOrdinal, summary, trace.skillEvents);
  if (!hitProgression.ok) return { ok: false, reason: hitProgression.reason };
  if (!sameKillSequence(hitProgression.kills, sortedKills)) return { ok: false, reason: "replay_trace_summary_mismatch" };
  const skillTimeline = validateRankedSkillTimeline(
    hitProgression.kills.map((kill) => ({
      enemyType: spawnByOrdinal.get(kill.spawnOrdinal)?.enemyType ?? "",
      hitAtMs: kill.hitAtMs,
      eventSequence: kill.eventSequence,
      band: kill.band,
      accuracy: kill.accuracy,
    })) as never,
    trace.skillEvents as never,
    RANKED_CORE_RULES,
  );
  if (!skillTimeline.ok) return { ok: false, reason: "replay_skill_timeline_invalid" };

  let lastSaveCount = 0;
  for (const event of sortedKills) {
    if (event.band === "lastSave") lastSaveCount += 1;
  }
  if (lastSaveCount !== summary.lastSaveCount) return { ok: false, reason: "replay_trace_summary_mismatch" };

  for (const event of trace.comboBreakEvents) {
    if (!Number.isFinite(event.atMs) || event.atMs < 0 || event.atMs > summary.survivalMs) {
      return { ok: false, reason: "replay_trace_invalid_time" };
    }
    if (!isComboBreakReason(event.reason)) return { ok: false, reason: "replay_trace_summary_mismatch" };
  }

  const replayed = replayTraceSummary(summary, sortedKills, trace.comboBreakEvents, trace.skillEvents, spawnByOrdinal);
  if (
    replayed.kills !== summary.kills ||
    replayed.maxCombo !== summary.maxCombo ||
    replayed.lastSaveCount !== summary.lastSaveCount ||
    Math.abs(replayed.score - summary.score) > 0.0001
  ) {
    return { ok: false, reason: "replay_trace_summary_mismatch" };
  }

  return { ok: true };
}

function generateReplaySpawnsForTrace(
  summary: RankedSummary,
  trace: RankedReplayTrace,
): { ok: true; spawns: EdgeReplaySpawnSpec[] } | { ok: false; reason: "spawn_sequence_mismatch" } {
  if (trace.spawnEvents?.some((event) => event.source === "boss_shard")) {
    return { ok: false, reason: "spawn_sequence_mismatch" };
  }
  const expected = deriveRankedReplaySpawns(summary, trace.killEvents, RANKED_CORE_RULES) as unknown as EdgeReplaySpawnSpec[];
  if (Array.isArray(trace.spawnEvents)) {
    const evidence = trace.spawnEvents.map(replaySpawnEventToReplaySpec);
    if (!sameSpawnSequence(evidence, expected)) {
      return { ok: false, reason: "spawn_sequence_mismatch" };
    }
    return { ok: true, spawns: expected };
  }
  return { ok: true, spawns: expected };
}

function sameSpawnSequence(evidence: EdgeReplaySpawnSpec[], expected: EdgeReplaySpawnSpec[]): boolean {
  if (evidence.length !== expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    const supplied = evidence[index]!;
    const generated = expected[index]!;
    if (
      supplied.spawnOrdinal !== generated.spawnOrdinal ||
      supplied.source !== generated.source ||
      supplied.parentSpawnOrdinal !== generated.parentSpawnOrdinal ||
      !sameSpawnShape(supplied, generated)
    ) {
      return false;
    }
  }
  return true;
}

function validReplaySpawnEvent(event: NonNullable<RankedReplayTrace["spawnEvents"]>[number], survivalMs: number): boolean {
  return (
    Number.isInteger(event.spawnOrdinal) &&
    event.spawnOrdinal > 0 &&
    Boolean(ENEMIES[event.enemyType]) &&
    isReplaySpawnSource(event.source) &&
    Number.isFinite(event.spawnAtMs) &&
    event.spawnAtMs >= 0 &&
    event.spawnAtMs <= survivalMs &&
    Number.isFinite(event.startAngleRad) &&
    Number.isFinite(event.startRadius) &&
    Number.isFinite(event.angularSpeed) &&
    Number.isFinite(event.approachSpeed) &&
    (event.parentSpawnOrdinal == null || (Number.isInteger(event.parentSpawnOrdinal) && event.parentSpawnOrdinal > 0))
  );
}

function validateReplaySpawnRelationships(trace: RankedReplayTrace): { ok: true } | { ok: false; reason: string } {
  const events = trace.spawnEvents ?? [];
  const byOrdinal = new Map(events.map((event) => [event.spawnOrdinal, event] as const));
  for (const event of events) {
    if (event.source === "split") {
      if (!event.parentSpawnOrdinal) return { ok: false, reason: "replay_trace_unknown_spawn" };
      const parent = byOrdinal.get(event.parentSpawnOrdinal);
      if (!parent) return { ok: false, reason: "replay_trace_unknown_spawn" };
      const parentDef = ENEMIES[parent.enemyType];
      if (!parentDef?.splitInto || parentDef.splitInto !== event.enemyType) return { ok: false, reason: "replay_trace_summary_mismatch" };
      const parentKill = trace.killEvents.find((kill) => kill.spawnOrdinal === event.parentSpawnOrdinal);
      if (!parentKill) return { ok: false, reason: "replay_trace_summary_mismatch" };
      const expected = splitSpawnSpecsForEnemy(replayEnemyAt(replaySpawnEventToSpec(parent), parentKill.hitAtMs), parentKill.hitAtMs);
      if (!expected.some((spawn) => sameSpawnShape(spawn, replaySpawnEventToSpec(event)))) return { ok: false, reason: "replay_trace_summary_mismatch" };
    }
  }
  return { ok: true };
}

function replaySpawnEventToSpec(event: NonNullable<RankedReplayTrace["spawnEvents"]>[number]): EdgeSpawnSpec {
  return {
    spawnOrdinal: event.spawnOrdinal,
    enemyType: event.enemyType,
    spawnAtMs: event.spawnAtMs,
    startAngleRad: event.startAngleRad,
    startRadius: event.startRadius,
    angularSpeed: event.angularSpeed,
    approachSpeed: event.approachSpeed,
  };
}

function replaySpawnEventToReplaySpec(event: NonNullable<RankedReplayTrace["spawnEvents"]>[number]): EdgeReplaySpawnSpec {
  return {
    ...replaySpawnEventToSpec(event),
    spawnOrdinal: event.spawnOrdinal,
    source: event.source === "boss_shard" ? "split" : event.source,
    parentSpawnOrdinal: event.parentSpawnOrdinal,
  };
}

function generateNormalSpawns(seed: number, survivalMs: number, difficulty: DifficultyId): EdgeSpawnSpec[] {
  return generateRankedCoreSpawns({ difficulty, seed, survivalMs }, RANKED_CORE_RULES)
    .filter((spawn) => spawn.source === "wave")
    .map(({ source: _source, parentSpawnOrdinal: _parentSpawnOrdinal, spawnOrdinal: _spawnOrdinal, ...spawn }) => spawn) as EdgeSpawnSpec[];
}

function replayHitProgression(
  hitEvents: RankedReplayTrace["hitEvents"],
  spawnByOrdinal: Map<number | undefined, EdgeSpawnSpec>,
  summary: RankedSummary,
  skillEvents: RankedReplayTrace["skillEvents"],
): { ok: true; kills: RankedReplayTrace["hitEvents"] } | { ok: false; reason: string } {
  const sortedHits = [...hitEvents].sort(compareReplayHitOrder);
  const hpByOrdinal = new Map<number, number>();
  const shieldByOrdinal = new Map<number, number>();
  const armorByOrdinal = new Map<number, number>();
  const killed = new Set<number>();
  const kills: RankedReplayTrace["hitEvents"] = [];

  for (const event of sortedHits) {
    if (!Number.isInteger(event.spawnOrdinal) || event.spawnOrdinal <= 0) return { ok: false, reason: "replay_trace_unknown_spawn" };
    if (!Number.isFinite(event.hitAtMs) || event.hitAtMs < 0 || event.hitAtMs > summary.survivalMs) {
      return { ok: false, reason: "replay_trace_invalid_time" };
    }
    const spawn = spawnByOrdinal.get(event.spawnOrdinal);
    if (!spawn) return { ok: false, reason: "replay_trace_unknown_spawn" };
    if (killed.has(event.spawnOrdinal)) return { ok: false, reason: "replay_trace_duplicate_kill" };
    if (event.hitAtMs < spawn.spawnAtMs) return { ok: false, reason: "replay_trace_kill_before_spawn" };
    if (!isDistanceBand(event.band) || !isAccuracyKind(event.accuracy)) return { ok: false, reason: "replay_trace_summary_mismatch" };

    const def = ENEMIES[spawn.enemyType];
    if (!def) return { ok: false, reason: "replay_trace_unknown_spawn" };
    const enemyHp = hpByOrdinal.get(event.spawnOrdinal) ?? def.hp;
    if (!Number.isFinite(enemyHp)) return { ok: false, reason: "replay_trace_unknown_spawn" };
    const geometry = validateKillGeometry(event, spawn, summary.difficulty, skillEvents, enemyHp, true);
    if (!geometry.ok) return { ok: false, reason: geometry.reason };
    const shieldHits = shieldByOrdinal.get(event.spawnOrdinal) ?? (def.shieldHits ?? 0);
    const armorHits = armorByOrdinal.get(event.spawnOrdinal) ?? (def.armorHits ?? 0);
    if (event.absorbed != null) {
      if (!isAbsorbedKind(event.absorbed) || event.damage !== 0) return { ok: false, reason: "replay_trace_summary_mismatch" };
      if (event.absorbed === "shield") {
        if (shieldHits <= 0) return { ok: false, reason: "replay_trace_summary_mismatch" };
        shieldByOrdinal.set(event.spawnOrdinal, shieldHits - 1);
        armorByOrdinal.set(event.spawnOrdinal, armorHits);
        continue;
      }
      if (armorHits <= 0) return { ok: false, reason: "replay_trace_summary_mismatch" };
      shieldByOrdinal.set(event.spawnOrdinal, shieldHits);
      armorByOrdinal.set(event.spawnOrdinal, armorHits - 1);
      continue;
    }
    if (shieldHits > 0 || armorHits > 0) return { ok: false, reason: "replay_trace_summary_mismatch" };
    const expectedDamage = expectedHitDamage(event, geometry.damageMultiplier);
    if (!Number.isInteger(event.damage) || event.damage !== expectedDamage) return { ok: false, reason: "replay_trace_summary_mismatch" };

    const remaining = Math.max(0, enemyHp - event.damage);
    hpByOrdinal.set(event.spawnOrdinal, remaining);
    if (remaining <= 0) {
      killed.add(event.spawnOrdinal);
      kills.push(event);
    }
  }

  return { ok: true, kills };
}

function expectedHitDamage(event: RankedReplayTrace["hitEvents"][number], multiplier: number): number {
  if (event.source === "solar_lance") return Math.max(1, Math.ceil(SOLAR_LANCE_HIT_DAMAGE * multiplier));
  if (event.source === "skill" && event.skillId === "orbital_cut") return Math.max(1, Math.ceil(ORBITAL_CUT_HIT_DAMAGE * multiplier));
  if (event.source === "skill" && event.skillId === "nova_pulse") return Math.max(1, Math.ceil(NOVA_PULSE_HIT_DAMAGE * multiplier));
  return Math.max(1, Math.ceil(1 * multiplier));
}

function sameKillSequence(expected: RankedReplayTrace["hitEvents"], submitted: RankedReplayTrace["killEvents"]): boolean {
  if (expected.length !== submitted.length) return false;
  for (let i = 0; i < expected.length; i += 1) {
    const a = expected[i]!;
    const b = submitted[i]!;
    if (a.spawnOrdinal !== b.spawnOrdinal) return false;
    if (a.hitAtMs !== b.hitAtMs) return false;
    if (a.eventSequence !== b.eventSequence) return false;
    if (a.band !== b.band || a.accuracy !== b.accuracy) return false;
    if ((b.damage ?? a.damage) !== a.damage) return false;
    if ((a.damageMultiplier ?? 1) !== (b.damageMultiplier ?? 1)) return false;
    if (a.source !== b.source) return false;
    if (a.skillId !== b.skillId) return false;
    if (!sameSegment(a.segment, b.segment)) return false;
  }
  return true;
}

function sameSegment(a: EdgeSegment | undefined, b: EdgeSegment | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.a.x === b.a.x && a.a.y === b.a.y && a.b.x === b.b.x && a.b.y === b.b.y;
}

function validateKillGeometry(
  event: RankedReplayTrace["hitEvents"][number] | RankedReplayTrace["killEvents"][number],
  spawn: EdgeSpawnSpec,
  difficulty: DifficultyId,
  skillEvents: RankedReplayTrace["skillEvents"],
  enemyHp: number,
  requireSource = false,
): { ok: true; damageMultiplier: number } | { ok: false; reason: string } {
  if (requireSource && !event.source) return { ok: false, reason: "replay_trace_summary_mismatch" };
  if (event.source != null && !isReplayKillSource(event.source)) return { ok: false, reason: "replay_trace_summary_mismatch" };
  if (event.source === "slash" && event.skillId != null) return { ok: false, reason: "replay_trace_summary_mismatch" };
  if (event.source === "solar_lance" && event.skillId !== "solar_lance") return { ok: false, reason: "replay_trace_summary_mismatch" };
  if (event.source === "skill" && event.skillId !== "orbital_cut" && event.skillId !== "nova_pulse") {
    return { ok: false, reason: "replay_trace_summary_mismatch" };
  }
  if (event.skillId && !skillEvents.some((skill) => (
    skill.skillId === event.skillId &&
    skill.atMs <= event.hitAtMs &&
    event.hitAtMs - skill.atMs <= 100 &&
    (
      event.eventSequence == null ||
      (skill.eventSequence != null && skill.eventSequence < event.eventSequence)
    )
  ))) {
    return { ok: false, reason: "replay_trace_invalid_geometry" };
  }
  if (!event.segment) {
    if (event.accuracy === "directional" || event.accuracy === "bossWeak" || event.source === "slash" || event.source === "solar_lance") {
      return { ok: false, reason: "replay_trace_invalid_geometry" };
    }
    if (event.damageMultiplier != null && Math.abs(event.damageMultiplier - 1) > 0.0001) {
      return { ok: false, reason: "replay_trace_summary_mismatch" };
    }
    return { ok: true, damageMultiplier: 1 };
  }
  if (!validSegment(event.segment)) return { ok: false, reason: "replay_trace_invalid_geometry" };
  if (event.source === "slash" && segmentLength(event.segment) < LIVE_SEGMENT_MIN_LENGTH_PX) {
    return { ok: false, reason: "replay_trace_invalid_geometry" };
  }

  const replayedEnemy = replayEnemyAt(spawn, event.hitAtMs);
  const enemy = { ...replayedEnemy, hp: enemyHp, maxHp: replayedEnemy.hp };
  const inflate = event.source === "solar_lance" ? SOLAR_LANCE_HIT_INFLATE_PX : NORMAL_SLASH_HIT_INFLATE_PX;
  const visualScale = replayVisualScale(enemy.radius, difficulty);
  const hitRadius = enemy.radiusPx * visualScale + inflate;
  const center = {
    x: EARTH_CENTER_X + Math.cos(enemy.angle) * enemy.radius,
    y: EARTH_CENTER_Y + Math.sin(enemy.angle) * enemy.radius,
  };

  if (!segmentIntersectsCircle(event.segment, center.x, center.y, hitRadius)) return { ok: false, reason: "replay_trace_invalid_geometry" };
  if (event.band !== distanceBand(enemy.radius)) return { ok: false, reason: "replay_trace_summary_mismatch" };

  const directional = directionalSlashAccuracy(event.segment, enemy);
  if (event.accuracy === "directional" && directional !== "directional") return { ok: false, reason: "replay_trace_invalid_geometry" };
  if (enemy.directional && event.accuracy !== "directional") return { ok: false, reason: "replay_trace_summary_mismatch" };
  if (event.accuracy !== "bossWeak") {
    if (bossRequiresWeakPointDamage(enemy)) return { ok: false, reason: "replay_trace_invalid_geometry" };
    if (event.damageMultiplier != null && Math.abs(event.damageMultiplier - 1) > 0.0001) {
      return { ok: false, reason: "replay_trace_summary_mismatch" };
    }
    return { ok: true, damageMultiplier: 1 };
  }

  const weak = resolveBossWeakPointHit(event.segment, enemy, visualScale);
  if (!weak.ok) return { ok: false, reason: "replay_trace_invalid_geometry" };
  if (event.damageMultiplier != null && Math.abs(event.damageMultiplier - weak.damageMultiplier) > 0.0001) {
    return { ok: false, reason: "replay_trace_summary_mismatch" };
  }
  return { ok: true, damageMultiplier: weak.damageMultiplier };
}

function hasValidSemanticEventSequences(trace: RankedReplayTrace): boolean {
  const events = [...trace.hitEvents, ...trace.killEvents, ...trace.skillEvents];
  const hasAnySequence = events.some((event) => event.eventSequence != null);
  if (!hasAnySequence) return true;
  if (!events.every((event) => isPositiveSafeInteger(event.eventSequence))) return false;

  const seen = new Set<number>();
  const orderedSemanticEvents = [
    ...trace.hitEvents.map((event) => ({ eventSequence: event.eventSequence!, atMs: event.hitAtMs })),
    ...trace.skillEvents.map((event) => ({ eventSequence: event.eventSequence!, atMs: event.atMs })),
  ].sort((a, b) => a.eventSequence - b.eventSequence);
  let previousAtMs = Number.NEGATIVE_INFINITY;
  for (const event of orderedSemanticEvents) {
    const eventSequence = event.eventSequence!;
    if (seen.has(eventSequence)) return false;
    seen.add(eventSequence);
    if (event.atMs < previousAtMs) return false;
    previousAtMs = event.atMs;
  }
  return true;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function compareReplayHitOrder(
  a: { hitAtMs: number; eventSequence?: number; spawnOrdinal: number },
  b: { hitAtMs: number; eventSequence?: number; spawnOrdinal: number },
): number {
  return (
    a.hitAtMs - b.hitAtMs ||
    (a.eventSequence != null && b.eventSequence != null ? a.eventSequence - b.eventSequence : 0) ||
    a.spawnOrdinal - b.spawnOrdinal
  );
}

function replayEnemyAt(spawn: EdgeSpawnSpec, hitAtMs: number): EdgeSpawnSpec & EdgeEnemyDef & { angle: number; radius: number } {
  const def = ENEMIES[spawn.enemyType]!;
  const elapsedSec = Math.max(0, hitAtMs - spawn.spawnAtMs) / 1000;
  return {
    ...spawn,
    ...def,
    angle: spawn.startAngleRad + spawn.angularSpeed * elapsedSec,
    radius: spawn.startRadius - spawn.approachSpeed * elapsedSec,
  };
}

function splitSpawnSpecsForEnemy(enemy: EdgeSpawnSpec & EdgeEnemyDef & { angle: number; radius: number }, hitAtMs: number): EdgeSpawnSpec[] {
  if (!enemy.splitInto || !enemy.splitCount || enemy.splitCount <= 0) return [];
  const count = Math.max(0, Math.floor(enemy.splitCount));
  const spread = Math.PI / Math.max(3, count + 1);
  const start = enemy.angle - spread * (count - 1) * 0.5;
  return Array.from({ length: count }, (_, index) => ({
    enemyType: enemy.splitInto!,
    spawnAtMs: hitAtMs,
    startAngleRad: normalizeAngle(start + spread * index),
    startRadius: Math.max(180, enemy.radius + 34 + index * 8),
    angularSpeed: enemy.angularSpeed * (index % 2 === 0 ? 1.1 : -0.95),
    approachSpeed: Math.max(20, enemy.approachSpeed * 1.08),
  }));
}

function sameSpawnShape(a: EdgeSpawnSpec, b: EdgeSpawnSpec): boolean {
  return (
    a.enemyType === b.enemyType &&
    nearlyEqual(a.spawnAtMs, b.spawnAtMs) &&
    nearlyEqual(a.startAngleRad, b.startAngleRad) &&
    nearlyEqual(a.startRadius, b.startRadius) &&
    nearlyEqual(a.angularSpeed, b.angularSpeed) &&
    nearlyEqual(a.approachSpeed, b.approachSpeed)
  );
}

function normalizeAngle(angle: number): number {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.0001;
}

function replayTraceSummary(
  summary: RankedSummary,
  kills: RankedReplayTrace["killEvents"],
  comboBreaks: RankedReplayTrace["comboBreakEvents"],
  skillEvents: RankedReplayTrace["skillEvents"],
  spawnByOrdinal: Map<number | undefined, EdgeSpawnSpec>,
): { score: number; kills: number; maxCombo: number; lastSaveCount: number } {
  const skillCounts: Record<string, number> = {};
  for (const event of skillEvents) skillCounts[event.skillId] = (skillCounts[event.skillId] ?? 0) + 1;
  for (const [skillId, count] of Object.entries(summary.skillUse ?? {})) {
    if ((skillCounts[skillId] ?? 0) !== count) return { score: Number.NaN, kills: -1, maxCombo: -1, lastSaveCount: -1 };
  }
  return replayRankedScore(
    kills.map((event) => ({
      spawnOrdinal: event.spawnOrdinal,
      enemyType: spawnByOrdinal.get(event.spawnOrdinal)?.enemyType ?? "",
      hitAtMs: event.hitAtMs,
      band: event.band as never,
      accuracy: event.accuracy as never,
      damageMultiplier: event.damageMultiplier,
    })),
    comboBreaks.map((event) => ({ atMs: event.atMs, reason: event.reason as "miss" | "earth_hit" })),
    RANKED_CORE_RULES,
  );
}

function validateAgainstRun(summary: RankedSummary, run: Record<string, unknown>): { ok: true } | { ok: false; reason: string } {
  if (summary.runToken !== run.run_token) return { ok: false, reason: "run_token_mismatch" };
  if (summary.seed !== Number(run.seed)) return { ok: false, reason: "seed_mismatch" };
  if (summary.difficulty !== run.difficulty) return { ok: false, reason: "difficulty_mismatch" };
  return { ok: true };
}

function isDifficulty(value: unknown): value is DifficultyId {
  return typeof value === "string" && DIFFICULTIES.includes(value as DifficultyId);
}

function matchesCurrentRankedRulesContract(rulesHash: unknown, rulesVersion: unknown): boolean {
  return rulesHash === RANKED_CORE_RULES_HASH && rulesVersion === RANKED_CORE_SCHEMA_VERSION;
}

function isSkillId(value: unknown): boolean {
  return typeof value === "string" && (SKILL_IDS as readonly string[]).includes(value);
}

function isDistanceBand(value: unknown): boolean {
  return typeof value === "string" && (DISTANCE_BANDS as readonly string[]).includes(value);
}

function isAccuracyKind(value: unknown): boolean {
  return typeof value === "string" && (ACCURACY_KINDS as readonly string[]).includes(value);
}

function isComboBreakReason(value: unknown): boolean {
  return typeof value === "string" && (COMBO_BREAK_REASONS as readonly string[]).includes(value);
}

function isAbsorbedKind(value: unknown): value is "shield" | "armor" {
  return value === "shield" || value === "armor";
}

function isReplaySpawnSource(value: unknown): value is "wave" | "boss" | "split" | "boss_shard" {
  return value === "wave" || value === "boss" || value === "split" || value === "boss_shard";
}

function isReplayKillSource(value: unknown): value is "slash" | "solar_lance" | "skill" {
  return value === "slash" || value === "solar_lance" || value === "skill";
}

function validSegment(segment: EdgeSegment): boolean {
  return (
    Number.isFinite(segment.a.x) &&
    Number.isFinite(segment.a.y) &&
    Number.isFinite(segment.b.x) &&
    Number.isFinite(segment.b.y)
  );
}

function segmentLength(segment: EdgeSegment): number {
  return Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
}

function segmentIntersectsCircle(segment: EdgeSegment, cx: number, cy: number, r: number): boolean {
  const ax = segment.a.x;
  const ay = segment.a.y;
  const bx = segment.b.x;
  const by = segment.b.y;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let closestX = ax;
  let closestY = ay;
  if (lenSq !== 0) {
    const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / lenSq));
    closestX = ax + t * dx;
    closestY = ay + t * dy;
  }
  const ddx = cx - closestX;
  const ddy = cy - closestY;
  return ddx * ddx + ddy * ddy <= r * r;
}

function distanceBand(radius: number): string {
  const zones = RANKED_CORE_RULES.difficulty.zones;
  if (radius >= zones.outer * EARTH_GAMEPLAY_RADIUS) return "outer";
  if (radius >= zones.mid * EARTH_GAMEPLAY_RADIUS) return "mid";
  if (radius >= zones.danger * EARTH_GAMEPLAY_RADIUS) return "danger";
  if (radius >= zones.lastSave * EARTH_GAMEPLAY_RADIUS) return "lastSave";
  return "impact";
}

function replayVisualScale(radius: number, difficulty: DifficultyId): number {
  const swell = DIFFICULTY_GRAVITY_SWELL[difficulty] ?? 1;
  const near = 1.3 * swell;
  const far = 0.6;
  const t = Math.max(0, Math.min(1, 1 - radius / (EARTH_GAMEPLAY_RADIUS * 6)));
  return far + (near - far) * t;
}

function directionalSlashAccuracy(segment: EdgeSegment, enemy: EdgeSpawnSpec & EdgeEnemyDef & { angle: number; radius: number }): string | null {
  if (!enemy.directional) return "normal";
  const requiredAngleRad = enemy.angle + Math.PI / 2;
  return slashMatchesDirectionalAngle(segment, requiredAngleRad, enemy.directionalToleranceDeg ?? 30) ? "directional" : null;
}

function slashMatchesDirectionalAngle(segment: EdgeSegment, requiredAngleRad: number, toleranceDeg: number): boolean {
  const slashAngle = Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x);
  const delta = orientationDeltaRad(slashAngle, requiredAngleRad);
  return delta <= (toleranceDeg * Math.PI) / 180;
}

function orientationDeltaRad(a: number, b: number): number {
  let diff = Math.abs(normalizeRad(a) - normalizeRad(b)) % Math.PI;
  if (diff > Math.PI / 2) diff = Math.PI - diff;
  return diff;
}

function normalizeRad(value: number): number {
  let out = value % (Math.PI * 2);
  if (out < 0) out += Math.PI * 2;
  return out;
}

function resolveBossWeakPointHit(
  segment: EdgeSegment,
  enemy: EdgeSpawnSpec & EdgeEnemyDef & { angle: number; radius: number },
  visualScale: number,
): { ok: true; damageMultiplier: number } | { ok: false } {
  if (!enemy.boss) return { ok: false };
  const definition = BOSS_DEFINITIONS[enemy.enemyType];
  if (!definition) return { ok: false };
  const phase = bossPhaseLabel(enemy, definition);
  const weakPoints = definition.weakPoints.filter((weak) => !weak.activePhaseLabels || weak.activePhaseLabels.includes(phase));
  const centerX = EARTH_CENTER_X + Math.cos(enemy.angle) * enemy.radius;
  const centerY = EARTH_CENTER_Y + Math.sin(enemy.angle) * enemy.radius;
  const scaledRadius = enemy.radiusPx * visualScale;
  const weakRadius = Math.max(18, scaledRadius * 0.13);

  for (const weak of weakPoints) {
    const angle = (weak.angleDeg * Math.PI) / 180;
    const wx = centerX + Math.cos(angle) * scaledRadius * weak.radiusRatio;
    const wy = centerY + Math.sin(angle) * scaledRadius * weak.radiusRatio;
    if (segmentDistanceToPoint(segment, wx, wy) <= weakRadius) {
      return { ok: true, damageMultiplier: weak.damageMultiplier };
    }
  }
  return { ok: false };
}

function bossRequiresWeakPointDamage(enemy: EdgeSpawnSpec & EdgeEnemyDef & { hp: number }): boolean {
  return Boolean(enemy.boss && BOSS_DEFINITIONS[enemy.enemyType]?.requiresWeakPointDamage);
}

function bossPhaseLabel(enemy: { hp: number; maxHp?: number }, definition: EdgeBossDefinition): string {
  const hp = Math.max(0, enemy.hp);
  const maxHp = Math.max(1, enemy.maxHp ?? hp);
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  let active = definition.phases[0]?.label ?? "approach";
  for (const phase of definition.phases) {
    if (ratio <= phase.atHpRatio) active = phase.label;
  }
  return active;
}

function segmentDistanceToPoint(segment: EdgeSegment, px: number, py: number): number {
  const ax = segment.a.x;
  const ay = segment.a.y;
  const bx = segment.b.x;
  const by = segment.b.y;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function createRankedWeeklySeed(difficulty: DifficultyId, nowMs: number): number {
  const weekIndex = rankedWeekIndex(nowMs);
  return hashRankedSeed(`orbitslash-ranked-v1:${weekIndex}:${difficulty}`);
}

function rankedWeekKey(nowMs: number): string {
  return `orbitslash-ranked-v1:${rankedWeekIndex(nowMs)}`;
}

function rankedWeekIndex(nowMs: number): number {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weekStartEpochMs = Date.UTC(2026, 0, 4, 21, 0, 0); // 2026-01-05 06:00 KST.
  return Math.floor((nowMs - weekStartEpochMs) / weekMs);
}

function isRankedWeekKey(value: unknown): value is string {
  return typeof value === "string" && /^orbitslash-ranked-v1:-?\d+$/.test(value);
}

function hashRankedSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
