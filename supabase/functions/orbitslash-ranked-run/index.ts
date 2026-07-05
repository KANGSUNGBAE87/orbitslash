import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  skillEvents: Array<{ skillId: string; atMs: number }>;
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
  angleDeg: number;
  radiusRatio: number;
  damageMultiplier: number;
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

interface EdgeWaveBand {
  fromMs: number;
  spawnIntervalMs: number;
  approachSpeedMul: number;
  weights: Record<string, number>;
  maxConsecutive?: Record<string, number>;
}

const CONFIG_VERSION = "server-ranked-v1";
const VALIDATION_VERSION = "ranked-v1";
const RUN_TTL_MS = 15 * 60 * 1000;
const DIFFICULTIES: readonly DifficultyId[] = ["rookie", "defender", "elite", "master"];
const DISTANCE_BANDS = ["outer", "mid", "danger", "lastSave", "impact"] as const;
const ACCURACY_KINDS = ["normal", "directional", "weakCenter", "bossWeak"] as const;
const COMBO_BREAK_REASONS = ["miss", "earth_hit"] as const;
const SKILL_IDS = ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield", "nova_pulse"] as const;
const RANKED_BOSS_EVERY_MS = 75_000;
const RANKED_SPAWN_INTERVAL_MULTIPLIER = 0.9;
const TOP_HUD_SAFE_Y = 370;
const EARTH_CENTER_X = 540;
const EARTH_CENTER_Y = 900;
const EARTH_GAMEPLAY_RADIUS = 58;
const START_VISUAL_RADIUS_SAFE_SCALE = 0.7;
const NORMAL_SLASH_HIT_INFLATE_PX = 12;
const SOLAR_LANCE_HIT_INFLATE_PX = 130;
const LIVE_SEGMENT_MIN_LENGTH_PX = 12;
const SOLAR_LANCE_HIT_DAMAGE = 5;
const ORBITAL_CUT_HIT_DAMAGE = 2;
const NOVA_PULSE_HIT_DAMAGE = 1;
const COMBO_TIMEOUT_MS = 650;
const ORBIT_PROFILES = [
  { angularMul: 0.5, dir: 1 },
  { angularMul: 0.8, dir: 1 },
  { angularMul: 1.1, dir: 1 },
  { angularMul: 1.5, dir: 1 },
  { angularMul: 2.0, dir: 1 },
  { angularMul: 0.5, dir: -1 },
  { angularMul: 0.8, dir: -1 },
  { angularMul: 1.1, dir: -1 },
  { angularMul: 1.5, dir: -1 },
  { angularMul: 2.0, dir: -1 },
] as const;
const DIFFICULTY_APPROACH_MUL: Record<DifficultyId, number> = {
  rookie: 1,
  defender: 1.2,
  elite: 1.45,
  master: 1.75,
};
const DIFFICULTY_GRAVITY_SWELL: Record<DifficultyId, number> = {
  rookie: 1,
  defender: 1.08,
  elite: 1.16,
  master: 1.25,
};

const ENEMIES: Record<string, EdgeEnemyDef> = {
  shard_meteor: { startRadius: 900, approachSpeed: 82, angularSpeed: 0.68, radiusPx: 64, hp: 1, score: 35, directional: false },
  small_meteor: { startRadius: 900, approachSpeed: 72, angularSpeed: 0.6, radiusPx: 86, hp: 3, score: 60, directional: false },
  basic_meteor: { startRadius: 920, approachSpeed: 62, angularSpeed: 0.5, radiusPx: 113, hp: 5, score: 110, directional: false },
  fast_comet: { startRadius: 950, approachSpeed: 96, angularSpeed: 0.7, radiusPx: 99, hp: 7, score: 145, directional: false },
  iron_planet: { startRadius: 920, approachSpeed: 52, angularSpeed: 0.42, radiusPx: 132, hp: 9, score: 175, directional: false },
  directional_comet: { startRadius: 960, approachSpeed: 92, angularSpeed: 0.78, radiusPx: 102, hp: 11, score: 210, directional: true, directionalToleranceDeg: 30 },
  heavy_asteroid: { startRadius: 880, approachSpeed: 42, angularSpeed: 0.35, radiusPx: 192, hp: 13, score: 240, directional: false },
  ancient_planet: { startRadius: 900, approachSpeed: 34, angularSpeed: 0.28, radiusPx: 220, hp: 15, score: 300, directional: false },
  fire_meteor: { startRadius: 930, approachSpeed: 88, angularSpeed: 0.72, radiusPx: 122, hp: 7, score: 260, directional: false },
  ice_comet: { startRadius: 960, approachSpeed: 86, angularSpeed: 0.66, radiusPx: 118, hp: 7, score: 240, directional: false, splitInto: "shard_meteor", splitCount: 3 },
  crystal_meteor: { startRadius: 940, approachSpeed: 58, angularSpeed: 0.44, radiusPx: 148, hp: 9, score: 310, directional: false },
  shield_rock: { startRadius: 910, approachSpeed: 46, angularSpeed: 0.38, radiusPx: 168, hp: 11, score: 330, directional: false, shieldHits: 2 },
  electric_meteor: { startRadius: 970, approachSpeed: 102, angularSpeed: 0.88, radiusPx: 134, hp: 9, score: 360, directional: true, directionalToleranceDeg: 28 },
  graviton_core: { startRadius: 920, approachSpeed: 40, angularSpeed: 0.3, radiusPx: 184, hp: 13, score: 420, directional: false },
  dark_meteor: { startRadius: 900, approachSpeed: 64, angularSpeed: 0.52, radiusPx: 156, hp: 11, score: 390, directional: false },
  armored_fragment: { startRadius: 900, approachSpeed: 38, angularSpeed: 0.32, radiusPx: 210, hp: 15, score: 460, directional: false, armorHits: 2 },
  eclipse_core: { startRadius: 980, approachSpeed: 24, angularSpeed: 0.18, radiusPx: 340, hp: 50, score: 1600, directional: false, boss: true, ignoreSpeedScale: true },
  ringed_destroyer: { startRadius: 1020, approachSpeed: 22, angularSpeed: 0.16, radiusPx: 365, hp: 58, score: 1900, directional: false, boss: true, ignoreSpeedScale: true },
  lava_titan: { startRadius: 1040, approachSpeed: 21, angularSpeed: 0.15, radiusPx: 382, hp: 66, score: 2200, directional: false, boss: true, ignoreSpeedScale: true },
  ice_colossus: { startRadius: 1040, approachSpeed: 20, angularSpeed: 0.14, radiusPx: 392, hp: 72, score: 2500, directional: false, boss: true, ignoreSpeedScale: true },
  dark_planet: { startRadius: 1060, approachSpeed: 19, angularSpeed: 0.12, radiusPx: 420, hp: 84, score: 3200, directional: false, boss: true, ignoreSpeedScale: true },
};

const BOSS_WEAK_POINTS: Record<string, EdgeWeakPointDef[]> = {
  eclipse_core: [
    { angleDeg: 0, radiusRatio: 0.28, damageMultiplier: 1.35 },
    { angleDeg: 180, radiusRatio: 0.42, damageMultiplier: 1.2 },
  ],
  ringed_destroyer: [
    { angleDeg: 45, radiusRatio: 0.36, damageMultiplier: 1.35 },
    { angleDeg: 225, radiusRatio: 0.44, damageMultiplier: 1.25 },
  ],
  lava_titan: [
    { angleDeg: 105, radiusRatio: 0.32, damageMultiplier: 1.4 },
    { angleDeg: 285, radiusRatio: 0.5, damageMultiplier: 1.2 },
  ],
  ice_colossus: [
    { angleDeg: 80, radiusRatio: 0.3, damageMultiplier: 1.3 },
    { angleDeg: 260, radiusRatio: 0.48, damageMultiplier: 1.3 },
  ],
  dark_planet: [
    { angleDeg: 0, radiusRatio: 0.24, damageMultiplier: 1.45 },
    { angleDeg: 120, radiusRatio: 0.44, damageMultiplier: 1.3 },
    { angleDeg: 240, radiusRatio: 0.44, damageMultiplier: 1.3 },
  ],
};

const NORMAL_ENEMY_KEYS = Object.keys(ENEMIES).filter((key) => !ENEMIES[key]?.boss);
const BOSS_SHARD_ENEMY_TYPES: Record<string, string> = {
  eclipse_core: "shard_meteor",
  ringed_destroyer: "shard_meteor",
  lava_titan: "fire_meteor",
  ice_colossus: "ice_comet",
  dark_planet: "dark_meteor",
};
const ROOKIE_WAVES: EdgeWaveBand[] = [
  { fromMs: 0, spawnIntervalMs: 940, approachSpeedMul: 1, weights: { shard_meteor: 58, small_meteor: 32, basic_meteor: 10 } },
  { fromMs: 7000, spawnIntervalMs: 900, approachSpeedMul: 1.05, weights: { shard_meteor: 42, small_meteor: 38, basic_meteor: 16, fast_comet: 4 } },
  { fromMs: 14000, spawnIntervalMs: 860, approachSpeedMul: 1.1, weights: { shard_meteor: 30, small_meteor: 36, basic_meteor: 22, fast_comet: 8, iron_planet: 4 } },
  {
    fromMs: 21000,
    spawnIntervalMs: 820,
    approachSpeedMul: 1.16,
    weights: { shard_meteor: 22, small_meteor: 30, basic_meteor: 25, fast_comet: 12, iron_planet: 7, directional_comet: 4 },
    maxConsecutive: { directional_comet: 2 },
  },
  {
    fromMs: 28000,
    spawnIntervalMs: 780,
    approachSpeedMul: 1.22,
    weights: { shard_meteor: 16, small_meteor: 24, basic_meteor: 26, fast_comet: 14, iron_planet: 10, directional_comet: 6, heavy_asteroid: 4 },
    maxConsecutive: { directional_comet: 2, heavy_asteroid: 2 },
  },
  {
    fromMs: 35000,
    spawnIntervalMs: 740,
    approachSpeedMul: 1.3,
    weights: { shard_meteor: 12, small_meteor: 20, basic_meteor: 25, fast_comet: 16, iron_planet: 12, directional_comet: 8, heavy_asteroid: 5, ancient_planet: 2 },
    maxConsecutive: { directional_comet: 2, heavy_asteroid: 2, ancient_planet: 1 },
  },
  {
    fromMs: 42000,
    spawnIntervalMs: 700,
    approachSpeedMul: 1.38,
    weights: { shard_meteor: 10, small_meteor: 16, basic_meteor: 23, fast_comet: 18, iron_planet: 14, directional_comet: 9, heavy_asteroid: 7, ancient_planet: 3 },
    maxConsecutive: { directional_comet: 2, heavy_asteroid: 2, ancient_planet: 1 },
  },
  {
    fromMs: 49000,
    spawnIntervalMs: 670,
    approachSpeedMul: 1.46,
    weights: { shard_meteor: 8, small_meteor: 14, basic_meteor: 20, fast_comet: 20, iron_planet: 15, directional_comet: 10, heavy_asteroid: 9, ancient_planet: 4 },
    maxConsecutive: { directional_comet: 2, heavy_asteroid: 2, ancient_planet: 1 },
  },
  {
    fromMs: 56000,
    spawnIntervalMs: 640,
    approachSpeedMul: 1.55,
    weights: { shard_meteor: 6, small_meteor: 12, basic_meteor: 18, fast_comet: 21, iron_planet: 16, directional_comet: 11, heavy_asteroid: 11, ancient_planet: 5 },
    maxConsecutive: { directional_comet: 2, heavy_asteroid: 2, ancient_planet: 1 },
  },
  {
    fromMs: 63000,
    spawnIntervalMs: 610,
    approachSpeedMul: 1.65,
    weights: { shard_meteor: 5, small_meteor: 10, basic_meteor: 16, fast_comet: 22, iron_planet: 17, directional_comet: 12, heavy_asteroid: 12, ancient_planet: 6 },
    maxConsecutive: { directional_comet: 2, heavy_asteroid: 2, ancient_planet: 1 },
  },
];

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

  let body: { action?: RankedAction; difficulty?: DifficultyId; summary?: RankedSummary; replayTrace?: RankedReplayTrace; limit?: number };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, reason: "invalid_json" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (body.action === "begin") return beginRankedRun(supabase, body.difficulty, request.headers.get("Authorization"), supabaseUrl);
  if (body.action === "submit") return submitRankedRun(supabase, body.summary, body.replayTrace);
  if (body.action === "leaderboard") return publicLeaderboard(supabase, body.limit);
  if (body.action === "debugRejectedRuns") return adminRejectedRuns(supabase, request.headers.get("Authorization"), body.limit);
  return json({ ok: false, reason: "unknown_action" }, 400);
});

async function beginRankedRun(
  supabase: ReturnType<typeof createClient>,
  difficulty: unknown,
  authorizationHeader: string | null,
  supabaseUrl: string,
): Promise<Response> {
  if (!isDifficulty(difficulty)) return json({ ok: false, reason: "invalid_difficulty" }, 400);

  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + RUN_TTL_MS;
  const seed = createRankedWeeklySeed(difficulty, issuedAtMs);
  const runToken = `server-ranked-${crypto.randomUUID()}`;
  const coreUserId = await resolveCoreUserId(supabase, supabaseUrl, authorizationHeader);
  const identityBound = Boolean(coreUserId);

  const { error } = await supabase.from("orbitslash_runs").insert({
    run_token: runToken,
    core_user_id: coreUserId,
    seed,
    difficulty,
    config_version: CONFIG_VERSION,
    ranking_strategy: "hybrid:supabase_verified+apps_in_toss_leaderboard_bridge",
    status: "started",
    expires_at: new Date(expiresAtMs).toISOString(),
    validation_version: VALIDATION_VERSION,
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
      rankingEligible: identityBound,
      verification: "server_verified",
      identityBound,
      issuedAtMs,
      expiresAtMs,
    },
  });
}

async function submitRankedRun(supabase: ReturnType<typeof createClient>, summary: unknown, replayTrace: unknown): Promise<Response> {
  const summaryValidation = validateSummary(summary);
  if (!summaryValidation.ok) return json(summaryValidation, 400);

  const { data: run, error: runError } = await supabase
    .from("orbitslash_runs")
    .select("id, run_token, seed, difficulty, config_version, status, expires_at, used_at, core_user_id")
    .eq("run_token", summaryValidation.summary.runToken)
    .maybeSingle();

  if (runError) return json({ ok: false, reason: "run_lookup_failed" }, 500);
  if (!run) return json({ ok: false, reason: "run_not_found" }, 404);
  if (run.status !== "started" || run.used_at) return json({ ok: false, reason: "run_already_used" }, 409);
  if (run.config_version !== CONFIG_VERSION) return json({ ok: false, reason: "config_version_mismatch" }, 409);
  if (new Date(run.expires_at).getTime() <= Date.now()) {
    await supabase.from("orbitslash_runs").update({ status: "expired" }).eq("id", run.id);
    return json({ ok: false, reason: "run_expired" }, 409);
  }
  if (typeof run.core_user_id !== "string" || run.core_user_id.length === 0) {
    return json({ ok: false, reason: "identity_not_bound" }, 409);
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

async function rejectRankedRun(supabase: ReturnType<typeof createClient>, runId: string, reason: string): Promise<void> {
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

async function publicLeaderboard(supabase: ReturnType<typeof createClient>, limit: unknown): Promise<Response> {
  if (Deno.env.get("PUBLIC_LEADERBOARD_ENABLED") !== "true") {
    return json({ ok: false, reason: "public_leaderboard_disabled" }, 403);
  }
  const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(20, Number(limit))) : 10;
  const { data, error } = await supabase
    .from("orbitslash_scores")
    .select("score, survival_ms, kills, max_combo, created_at, orbitslash_runs!inner(difficulty)")
    .eq("verified", true)
    .not("core_user_id", "is", null)
    .order("score", { ascending: false })
    .order("survival_ms", { ascending: false })
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

async function adminRejectedRuns(supabase: ReturnType<typeof createClient>, authorizationHeader: string | null, limit: unknown): Promise<Response> {
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
  supabase: ReturnType<typeof createClient>,
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
  if (trace.spawnEvents != null) {
    if (!Array.isArray(trace.spawnEvents)) return { ok: false, reason: "replay_trace_missing" };
    const seen = new Set<number>();
    for (const event of trace.spawnEvents) {
      if (!validReplaySpawnEvent(event, summary.survivalMs)) return { ok: false, reason: "replay_trace_summary_mismatch" };
      if (seen.has(event.spawnOrdinal)) return { ok: false, reason: "replay_trace_summary_mismatch" };
      seen.add(event.spawnOrdinal);
    }
    const spawnRelationship = validateReplaySpawnRelationships(trace);
    if (!spawnRelationship.ok) return spawnRelationship;
  }
  if (trace.killEvents.length !== summary.kills) return { ok: false, reason: "replay_trace_summary_mismatch" };

  const spawns = generateReplaySpawnsForTrace(summary, trace);
  const spawnByOrdinal = new Map(spawns.map((spawn) => [spawn.spawnOrdinal, spawn] as const));
  const sortedKills = [...trace.killEvents].sort((a, b) => a.hitAtMs - b.hitAtMs || a.spawnOrdinal - b.spawnOrdinal);

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

function generateReplaySpawnsForTrace(summary: RankedSummary, trace: RankedReplayTrace): EdgeSpawnSpec[] {
  if (Array.isArray(trace.spawnEvents) && trace.spawnEvents.length > 0) {
    return trace.spawnEvents
      .filter((event) => validReplaySpawnEvent(event, summary.survivalMs))
      .map((event) => ({
        spawnOrdinal: event.spawnOrdinal,
        enemyType: event.enemyType,
        spawnAtMs: event.spawnAtMs,
        startAngleRad: event.startAngleRad,
        startRadius: event.startRadius,
        angularSpeed: event.angularSpeed,
        approachSpeed: event.approachSpeed,
      }));
  }
  const normalSpawns = generateNormalSpawns(summary.seed, summary.survivalMs, summary.difficulty);
  const bossSpawns = generateBossSpawnsFromTrace(normalSpawns, trace, summary.survivalMs);
  return assignSpawnOrdinals([...normalSpawns, ...bossSpawns]);
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
    if (event.source === "boss_shard") {
      if (!event.parentSpawnOrdinal) return { ok: false, reason: "replay_trace_unknown_spawn" };
      const parent = byOrdinal.get(event.parentSpawnOrdinal);
      if (!parent || !ENEMIES[parent.enemyType]?.boss) return { ok: false, reason: "replay_trace_unknown_spawn" };
      const validation = validateBossShardSpawnEvent(event, parent);
      if (!validation.ok) return validation;
    }
  }
  return { ok: true };
}

function validateBossShardSpawnEvent(
  event: NonNullable<RankedReplayTrace["spawnEvents"]>[number],
  parent: NonNullable<RankedReplayTrace["spawnEvents"]>[number],
): { ok: true } | { ok: false; reason: string } {
  if (event.spawnAtMs < parent.spawnAtMs) return { ok: false, reason: "replay_trace_summary_mismatch" };
  const expectedShardType = BOSS_SHARD_ENEMY_TYPES[parent.enemyType];
  if (!expectedShardType || event.enemyType !== expectedShardType) return { ok: false, reason: "replay_trace_summary_mismatch" };
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

function generateNormalSpawns(seed: number, survivalMs: number, difficulty: DifficultyId): EdgeSpawnSpec[] {
  const rng = createRng(seed);
  const out: EdgeSpawnSpec[] = [];
  let nextSpawnAtMs = jitterInterval(rng, difficulty, 0);
  let lastEnemyType: string | undefined;
  let consecutiveEnemyCount = 0;

  while (nextSpawnAtMs <= survivalMs) {
    const band = activeWaveBand(difficulty, nextSpawnAtMs);
    const blocked = new Set<string>();
    const maxConsecutive = lastEnemyType ? band?.maxConsecutive?.[lastEnemyType] : undefined;
    if (lastEnemyType && maxConsecutive != null && consecutiveEnemyCount >= maxConsecutive) blocked.add(lastEnemyType);

    const enemyType = pickEnemyType(rng, band, blocked);
    const def = ENEMIES[enemyType]!;
    if (enemyType === lastEnemyType) {
      consecutiveEnemyCount += 1;
    } else {
      lastEnemyType = enemyType;
      consecutiveEnemyCount = 1;
    }
    const startAngleRad = safeStartAngleRad(rng.next() * 2 * Math.PI, def.startRadius, TOP_HUD_SAFE_Y + def.radiusPx * START_VISUAL_RADIUS_SAFE_SCALE);
    const profile = ORBIT_PROFILES[rng.nextInt(ORBIT_PROFILES.length)] ?? ORBIT_PROFILES[0]!;
    const approachMul = def.ignoreSpeedScale ? 1 : DIFFICULTY_APPROACH_MUL[difficulty] * (band?.approachSpeedMul ?? 1);
    out.push({
      enemyType,
      spawnAtMs: nextSpawnAtMs,
      startAngleRad,
      startRadius: def.startRadius,
      angularSpeed: def.angularSpeed * profile.angularMul * profile.dir,
      approachSpeed: def.approachSpeed * approachMul,
    });
    nextSpawnAtMs += jitterInterval(rng, difficulty, nextSpawnAtMs);
  }

  return out;
}

function generateBossSpawnsFromTrace(
  normalSpawns: EdgeSpawnSpec[],
  trace: RankedReplayTrace,
  survivalMs: number,
): EdgeSpawnSpec[] {
  const bossSpawns: EdgeSpawnSpec[] = [];
  let nextBossAtMs = RANKED_BOSS_EVERY_MS;
  let guard = 0;

  while (nextBossAtMs <= survivalMs && guard < 1000) {
    guard += 1;
    const bossSpawn = createBossSpawn("eclipse_core", nextBossAtMs);
    const withOrdinal = assignSpawnOrdinals([...normalSpawns, ...bossSpawns, bossSpawn]);
    const bossOrdinal = withOrdinal.find((spawn) => spawn.enemyType === "eclipse_core" && spawn.spawnAtMs === nextBossAtMs)?.spawnOrdinal;
    bossSpawns.push(bossSpawn);

    const bossKill = trace.killEvents.find((event) => event.spawnOrdinal === bossOrdinal);
    if (!bossKill || bossKill.hitAtMs > survivalMs) break;
    nextBossAtMs = bossKill.hitAtMs + RANKED_BOSS_EVERY_MS;
  }

  return bossSpawns;
}

function createBossSpawn(enemyType: string, spawnAtMs: number): EdgeSpawnSpec {
  const def = ENEMIES[enemyType]!;
  return {
    enemyType,
    spawnAtMs,
    startAngleRad: -Math.PI / 2,
    startRadius: def.startRadius,
    angularSpeed: def.angularSpeed,
    approachSpeed: def.approachSpeed,
  };
}

function replayHitProgression(
  hitEvents: RankedReplayTrace["hitEvents"],
  spawnByOrdinal: Map<number | undefined, EdgeSpawnSpec>,
  summary: RankedSummary,
  skillEvents: RankedReplayTrace["skillEvents"],
): { ok: true; kills: RankedReplayTrace["hitEvents"] } | { ok: false; reason: string } {
  const sortedHits = [...hitEvents].sort((a, b) => a.hitAtMs - b.hitAtMs || a.spawnOrdinal - b.spawnOrdinal);
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

    const geometry = validateKillGeometry(event, spawn, summary.difficulty, skillEvents, true);
    if (!geometry.ok) return { ok: false, reason: geometry.reason };
    const def = ENEMIES[spawn.enemyType];
    if (!def) return { ok: false, reason: "replay_trace_unknown_spawn" };
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
    const expectedDamage = expectedHitDamage(event);
    if (!Number.isInteger(event.damage) || event.damage !== expectedDamage) return { ok: false, reason: "replay_trace_summary_mismatch" };

    const enemyHp = hpByOrdinal.get(event.spawnOrdinal) ?? def.hp;
    if (!Number.isFinite(enemyHp)) return { ok: false, reason: "replay_trace_unknown_spawn" };
    const remaining = Math.max(0, enemyHp - event.damage);
    hpByOrdinal.set(event.spawnOrdinal, remaining);
    if (remaining <= 0) {
      killed.add(event.spawnOrdinal);
      kills.push(event);
    }
  }

  return { ok: true, kills };
}

function expectedHitDamage(event: RankedReplayTrace["hitEvents"][number]): number {
  const multiplier = event.damageMultiplier ?? 1;
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
  requireSource = false,
): { ok: true } | { ok: false; reason: string } {
  if (requireSource && !event.source) return { ok: false, reason: "replay_trace_summary_mismatch" };
  if (event.source != null && !isReplayKillSource(event.source)) return { ok: false, reason: "replay_trace_summary_mismatch" };
  if (event.source === "slash" && event.skillId != null) return { ok: false, reason: "replay_trace_summary_mismatch" };
  if (event.source === "solar_lance" && event.skillId !== "solar_lance") return { ok: false, reason: "replay_trace_summary_mismatch" };
  if (event.source === "skill" && event.skillId !== "orbital_cut" && event.skillId !== "nova_pulse") {
    return { ok: false, reason: "replay_trace_summary_mismatch" };
  }
  if (event.skillId && !skillEvents.some((skill) => skill.skillId === event.skillId && Math.abs(skill.atMs - event.hitAtMs) <= 100)) {
    return { ok: false, reason: "replay_trace_invalid_geometry" };
  }
  if (!event.segment) {
    if (event.accuracy === "directional" || event.accuracy === "bossWeak" || event.source === "slash" || event.source === "solar_lance") {
      return { ok: false, reason: "replay_trace_invalid_geometry" };
    }
    return { ok: true };
  }
  if (!validSegment(event.segment)) return { ok: false, reason: "replay_trace_invalid_geometry" };
  if (event.source === "slash" && segmentLength(event.segment) < LIVE_SEGMENT_MIN_LENGTH_PX) {
    return { ok: false, reason: "replay_trace_invalid_geometry" };
  }

  const enemy = replayEnemyAt(spawn, event.hitAtMs);
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
  if (event.accuracy !== "bossWeak") return { ok: true };

  const weak = resolveBossWeakPointHit(event.segment, enemy, visualScale);
  if (!weak.ok) return { ok: false, reason: "replay_trace_invalid_geometry" };
  if (event.damageMultiplier != null && Math.abs(event.damageMultiplier - weak.damageMultiplier) > 0.0001) {
    return { ok: false, reason: "replay_trace_summary_mismatch" };
  }
  return { ok: true };
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
  const allEvents = [
    ...kills.map((event) => ({ kind: "kill" as const, atMs: event.hitAtMs, event })),
    ...comboBreaks.map((event) => ({ kind: "break" as const, atMs: event.atMs, event })),
  ].sort((a, b) => a.atMs - b.atMs || (a.kind === "break" ? -1 : 1));

  const skillCounts: Record<string, number> = {};
  for (const event of skillEvents) skillCounts[event.skillId] = (skillCounts[event.skillId] ?? 0) + 1;
  for (const [skillId, count] of Object.entries(summary.skillUse ?? {})) {
    if ((skillCounts[skillId] ?? 0) !== count) return { score: Number.NaN, kills: -1, maxCombo: -1, lastSaveCount: -1 };
  }

  let score = 0;
  let killsCount = 0;
  let combo = 0;
  let maxCombo = 0;
  let lastSaveCount = 0;
  let lastComboHitAtMs: number | null = null;
  let pendingKills: RankedReplayTrace["killEvents"] = [];

  const flushKills = (): void => {
    if (pendingKills.length === 0) return;
    for (const group of groupByComboTimeout(pendingKills, COMBO_TIMEOUT_MS)) {
      const hitAtMs = group[group.length - 1]?.hitAtMs;
      if (lastComboHitAtMs != null && hitAtMs != null && hitAtMs - lastComboHitAtMs >= COMBO_TIMEOUT_MS) combo = 0;
      killsCount += group.length;
      combo += group.length;
      maxCombo = Math.max(maxCombo, combo);
      for (const event of group) {
        const spawn = spawnByOrdinal.get(event.spawnOrdinal);
        const enemyScore = spawn ? ENEMIES[spawn.enemyType]?.score ?? 0 : 0;
        score += scoreFor(enemyScore, event.band, event.accuracy, combo);
        if (event.band === "lastSave") lastSaveCount += 1;
      }
      if (group.length >= 2) score += multiCutBonus(group.length);
      if (hitAtMs != null) lastComboHitAtMs = hitAtMs;
    }
    pendingKills = [];
  };

  for (const entry of allEvents) {
    if (entry.kind === "break") {
      flushKills();
      combo = 0;
      lastComboHitAtMs = null;
      continue;
    }
    pendingKills.push(entry.event);
  }
  flushKills();

  return { score, kills: killsCount, maxCombo, lastSaveCount };
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

function createRng(seed: number): { next(): number; nextInt(maxExclusive: number): number } {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    nextInt(maxExclusive: number): number {
      return Math.floor(next() * maxExclusive);
    },
  };
}

function jitterInterval(rng: { next(): number }, difficulty: DifficultyId, elapsedMs: number): number {
  const base = activeWaveBand(difficulty, elapsedMs)?.spawnIntervalMs ?? 800;
  const factor = 0.6 + rng.next() * 0.8;
  return Math.round(Math.max(120, Math.round(base * RANKED_SPAWN_INTERVAL_MULTIPLIER)) * factor);
}

function activeWaveBand(difficulty: DifficultyId, elapsedMs: number): EdgeWaveBand | undefined {
  if (difficulty !== "rookie") return undefined;
  let active = ROOKIE_WAVES[0];
  for (const band of ROOKIE_WAVES) {
    if (band.fromMs <= elapsedMs && band.fromMs >= (active?.fromMs ?? -Infinity)) active = band;
  }
  return active;
}

function pickEnemyType(rng: { next(): number; nextInt(maxExclusive: number): number }, band: EdgeWaveBand | undefined, blocked: ReadonlySet<string>): string {
  if (!band) return NORMAL_ENEMY_KEYS[rng.nextInt(NORMAL_ENEMY_KEYS.length)] ?? "shard_meteor";
  const entries = Object.entries(band.weights).filter(([key, weight]) => weight > 0 && ENEMIES[key] && !blocked.has(key));
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return NORMAL_ENEMY_KEYS[rng.nextInt(NORMAL_ENEMY_KEYS.length)] ?? "shard_meteor";
  let cursor = rng.next() * total;
  for (const [key, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return key;
  }
  return entries[entries.length - 1]?.[0] ?? "shard_meteor";
}

function safeStartAngleRad(angleRad: number, startRadius: number, minY: number): number {
  const y = EARTH_CENTER_Y + Math.sin(angleRad) * startRadius;
  if (y >= minY) return angleRad;

  const minSin = Math.max(-1, Math.min(1, (minY - EARTH_CENTER_Y) / startRadius));
  const lower = Math.PI + Math.asin(-minSin);
  const upper = Math.PI * 2 - Math.asin(-minSin);
  const distToLower = angularDistance(angleRad, lower);
  const distToUpper = angularDistance(angleRad, upper);
  return distToLower <= distToUpper ? lower : upper;
}

function angularDistance(a: number, b: number): number {
  let diff = Math.abs((a - b) % (Math.PI * 2));
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff;
}

function assignSpawnOrdinals(spawns: EdgeSpawnSpec[]): EdgeSpawnSpec[] {
  return spawns
    .map((spawn, index) => ({ spawn, index }))
    .sort((a, b) => a.spawn.spawnAtMs - b.spawn.spawnAtMs || a.index - b.index)
    .map(({ spawn }, index) => ({ ...spawn, spawnOrdinal: index + 1 }));
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
  if (radius >= 4 * EARTH_GAMEPLAY_RADIUS) return "outer";
  if (radius >= 3 * EARTH_GAMEPLAY_RADIUS) return "mid";
  if (radius >= 2 * EARTH_GAMEPLAY_RADIUS) return "danger";
  if (radius >= 1.3 * EARTH_GAMEPLAY_RADIUS) return "lastSave";
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
  const weakPoints = BOSS_WEAK_POINTS[enemy.enemyType];
  if (!weakPoints) return { ok: false };
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

function groupByComboTimeout<T extends { hitAtMs: number }>(items: T[], timeoutMs: number): T[][] {
  if (items.length === 0) return [];
  const groups: T[][] = [];
  let current: T[] = [];
  let previousHitAtMs: number | null = null;
  for (const item of items) {
    if (previousHitAtMs != null && item.hitAtMs - previousHitAtMs >= timeoutMs) {
      groups.push(current);
      current = [];
    }
    current.push(item);
    previousHitAtMs = item.hitAtMs;
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function scoreFor(baseScore: number, band: string, accuracy: string, combo: number): number {
  return baseScore * distanceMultiplierFor(band) * accuracyMultiplierFor(accuracy) * comboMultiplierFor(combo);
}

function distanceMultiplierFor(band: string): number {
  if (band === "mid") return 1.4;
  if (band === "danger") return 2.2;
  if (band === "lastSave") return 3.5;
  return 1.0;
}

function accuracyMultiplierFor(accuracy: string): number {
  if (accuracy === "directional") return 1.2;
  if (accuracy === "weakCenter") return 1.5;
  if (accuracy === "bossWeak") return 2.0;
  return 1.0;
}

function comboMultiplierFor(combo: number): number {
  if (combo >= 30) return 2.5;
  if (combo >= 20) return 2.0;
  if (combo >= 10) return 1.5;
  if (combo >= 5) return 1.2;
  return 1.0;
}

function multiCutBonus(killCount: number): number {
  if (killCount >= 8) return 1000;
  if (killCount >= 5) return 400;
  if (killCount >= 3) return 120;
  if (killCount >= 2) return 50;
  return 0;
}

function createRankedWeeklySeed(difficulty: DifficultyId, nowMs: number): number {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weekStartEpochMs = Date.UTC(2026, 0, 4, 21, 0, 0); // 2026-01-05 06:00 KST.
  const weekIndex = Math.floor((nowMs - weekStartEpochMs) / weekMs);
  return hashRankedSeed(`orbitslash-ranked-v1:${weekIndex}:${difficulty}`);
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
