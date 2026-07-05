import enemiesJson from "../data/enemies.json";
import difficultyJson from "../data/difficulty.json";
import orbitsJson from "../data/orbits.json";
import scoringJson from "../data/scoring.json";
import skillsJson from "../data/skills.json";
import wavesJson from "../data/waves.json";
import { comboMultiplierFor, ScoringSystem } from "./ScoringSystem";
import { groupByComboTimeout } from "./ComboTiming";
import { segmentIntersectsCircle } from "./CollisionSystem";
import { directionalSlashAccuracy } from "./DirectionalCut";
import { splitSpawnSpecsForEnemy } from "./Enemy";
import { resolveBossWeakPointHit } from "./BossSystem";
import { BOSS_DEFINITIONS, type BossId } from "./BossDefinitions";
import { EARTH_CENTER_X, EARTH_CENTER_Y, EARTH_GAMEPLAY_RADIUS, distanceBand } from "./coords";
import { LIVE_SEGMENT_MIN_LENGTH_PX, NORMAL_SLASH_HIT_INFLATE_PX, SOLAR_LANCE_HIT_INFLATE_PX } from "./input-tuning";
import { buildRunConfig, type DifficultyId, type SkillId } from "./ModeConfig";
import { modeSpawnIntervalMultiplierAt, resolveModeRuntimeRules } from "./ModeRuleEngine";
import { createRng } from "./Rng";
import { WaveGenerator } from "./WaveGenerator";
import type { DifficultyDef, DifficultyTable, EnemyState, EnemyTable, HitResult, OrbitProfile, ScoringConfig, Segment, SkillTable, SpawnSpec, WaveTable, ZoneTable } from "./types";
import type { RunSummary } from "./RankingSystem";
import type { RankedReplayComboBreakEvent, RankedReplayHitEvent, RankedReplayKillEvent, RankedReplaySkillEvent, RankedReplayTrace } from "./RankedReplayTrace";

export interface RankedReplayTables {
  enemies: EnemyTable;
  difficulty: DifficultyTable;
  orbits: OrbitProfile[];
  waves: WaveTable;
  scoring: ScoringConfig;
  skills: SkillTable;
}

export interface RankedReplayBounds {
  normalSpawnCount: number;
  bossSpawnCount: number;
  maxKills: number;
  maxLastSaveCount: number;
  maxScore: number;
  maxSkillUse: Record<SkillId, number>;
  maxSurvivalMs: number;
}

export type RankedReplayValidation =
  | { ok: true; bounds: RankedReplayBounds }
  | {
      ok: false;
      reason:
        | "replay_not_ranked"
        | "replay_invalid_difficulty"
        | "replay_invalid_survival"
        | "replay_survival_exceeds_token_ttl"
        | "replay_kills_exceed_spawned"
        | "replay_last_save_exceeds_kills"
        | "replay_score_exceeds_bound"
        | "replay_skill_use_exceeds_bound"
        | "replay_trace_missing"
        | "replay_trace_invalid_time"
        | "replay_trace_unknown_spawn"
        | "replay_trace_duplicate_kill"
        | "replay_trace_kill_before_spawn"
        | "replay_trace_invalid_geometry"
        | "replay_trace_summary_mismatch";
      bounds?: RankedReplayBounds;
    };

export const RANKED_REPLAY_MAX_SURVIVAL_MS = 15 * 60 * 1000;
const SCORE_SAFETY_RATIO = 1.08;
const SCORE_SAFETY_FLAT = 2_000;
const SKILL_GAUGE_SAFETY = 120;
const SKILL_COOLDOWN_SAFETY_COUNT = 1;
const SKILL_IDS: readonly SkillId[] = ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield", "nova_pulse"];
const DIFFICULTY_IDS: readonly DifficultyId[] = ["rookie", "defender", "elite", "master"];
const DISTANCE_BANDS = ["outer", "mid", "danger", "lastSave", "impact"] as const;
const ACCURACY_KINDS = ["normal", "directional", "weakCenter", "bossWeak"] as const;
const COMBO_BREAK_REASONS = ["miss", "earth_hit"] as const;

export const DEFAULT_RANKED_REPLAY_TABLES: RankedReplayTables = {
  enemies: enemiesJson as EnemyTable,
  difficulty: difficultyJson as DifficultyTable,
  orbits: (orbitsJson as { profiles: OrbitProfile[] }).profiles,
  waves: wavesJson as unknown as WaveTable,
  scoring: scoringJson as unknown as ScoringConfig,
  skills: skillsJson as SkillTable,
};

export function validateRankedReplaySubmission(
  summary: RunSummary,
  trace?: RankedReplayTrace,
  tables: RankedReplayTables = DEFAULT_RANKED_REPLAY_TABLES,
  maxSurvivalMs = RANKED_REPLAY_MAX_SURVIVAL_MS,
): RankedReplayValidation {
  if (summary.modeId !== "ranked") return { ok: false, reason: "replay_not_ranked" };
  if (!isDifficultyId(summary.difficulty)) return { ok: false, reason: "replay_invalid_difficulty" };
  if (!Number.isFinite(summary.survivalMs) || summary.survivalMs < 0) return { ok: false, reason: "replay_invalid_survival" };
  if (summary.survivalMs > maxSurvivalMs) return { ok: false, reason: "replay_survival_exceeds_token_ttl" };
  const bounds = computeRankedReplayBounds(summary, tables, maxSurvivalMs);
  if (summary.kills > bounds.maxKills) return { ok: false, reason: "replay_kills_exceed_spawned", bounds };
  if (summary.lastSaveCount > Math.min(summary.kills, bounds.maxLastSaveCount)) {
    return { ok: false, reason: "replay_last_save_exceeds_kills", bounds };
  }
  if (summary.score > bounds.maxScore) return { ok: false, reason: "replay_score_exceeds_bound", bounds };
  for (const skillId of SKILL_IDS) {
    if ((summary.skillUse[skillId] ?? 0) > bounds.maxSkillUse[skillId]) {
      return { ok: false, reason: "replay_skill_use_exceeds_bound", bounds };
    }
  }
  if (!trace) return { ok: false, reason: "replay_trace_missing", bounds };
  const traceValidation = validateRankedSemanticTrace(summary, trace, tables, maxSurvivalMs);
  if (!traceValidation.ok) return traceValidation;
  return { ok: true, bounds };
}

export function computeRankedReplayBounds(
  summary: Pick<RunSummary, "difficulty" | "seed" | "survivalMs">,
  tables: RankedReplayTables = DEFAULT_RANKED_REPLAY_TABLES,
  maxSurvivalMs = RANKED_REPLAY_MAX_SURVIVAL_MS,
): RankedReplayBounds {
  const difficulty = isDifficultyId(summary.difficulty) ? summary.difficulty : "rookie";
  const allSpawns = withPotentialDynamicSpawns(generateRankedReplaySpawns({ ...summary, difficulty }, tables), tables);
  const maxKills = allSpawns.length;
  const maxScore = computeMaxScore(allSpawns, tables);
  const maxSkillUse = computeMaxSkillUse(summary.survivalMs, allSpawns, tables);

  return {
    normalSpawnCount: allSpawns.filter((spawn) => !tables.enemies[spawn.enemyType]?.boss).length,
    bossSpawnCount: allSpawns.filter((spawn) => Boolean(tables.enemies[spawn.enemyType]?.boss)).length,
    maxKills,
    maxLastSaveCount: maxKills,
    maxScore,
    maxSkillUse,
    maxSurvivalMs,
  };
}

function withPotentialDynamicSpawns(spawns: SpawnSpec[], tables: RankedReplayTables): SpawnSpec[] {
  const out = [...spawns];
  for (const spawn of spawns) {
    const def = tables.enemies[spawn.enemyType];
    if (!def?.splitInto || !def.splitCount || def.splitCount <= 0) continue;
    for (let index = 0; index < Math.floor(def.splitCount); index += 1) {
      out.push({
        enemyType: def.splitInto,
        spawnAtMs: spawn.spawnAtMs,
        startAngleRad: spawn.startAngleRad,
        startRadius: spawn.startRadius,
        angularSpeed: spawn.angularSpeed,
        approachSpeed: spawn.approachSpeed,
      });
    }
  }
  return out;
}

export function generateRankedReplaySpawns(
  summary: Pick<RunSummary, "difficulty" | "seed" | "survivalMs">,
  tables: RankedReplayTables = DEFAULT_RANKED_REPLAY_TABLES,
): SpawnSpec[] {
  const difficulty = isDifficultyId(summary.difficulty) ? summary.difficulty : "rookie";
  const config = buildRunConfig("ranked", {
    difficulty,
    seed: summary.seed,
    configVersion: "server-ranked-replay",
  });
  const runtimeRules = resolveModeRuntimeRules(config);
  const normalSpawns = generateRankedNormalSpawns(summary.seed, summary.survivalMs, difficulty, tables, runtimeRules);
  const bossSpawns = generateRankedBossSpawns(summary.survivalMs, config.rules.bossPolicy.bossEnemyType, runtimeRules.periodicBossEveryMs, tables);
  return assignReplaySpawnOrdinals([...normalSpawns, ...bossSpawns]);
}

function generateRankedNormalSpawns(
  seed: number,
  survivalMs: number,
  difficulty: DifficultyId,
  tables: RankedReplayTables,
  runtimeRules: ReturnType<typeof resolveModeRuntimeRules>,
): SpawnSpec[] {
  const wave = new WaveGenerator(
    createRng(seed),
    {
      difficulty,
      spawnIntervalMultiplierForElapsed: (elapsedMs) => modeSpawnIntervalMultiplierAt(runtimeRules, elapsedMs),
    },
    tables.enemies,
    tables.difficulty,
    tables.orbits,
    tables.waves,
  );
  return wave.next(Math.max(0, survivalMs));
}

function generateRankedBossSpawns(survivalMs: number, enemyType: string, everyMs: number | null, tables: RankedReplayTables): SpawnSpec[] {
  if (!everyMs || everyMs <= 0) return [];
  const out: SpawnSpec[] = [];
  for (let spawnAtMs = everyMs; spawnAtMs <= survivalMs; spawnAtMs += everyMs) {
    out.push(createReplayBossSpawn(enemyType, spawnAtMs, tables));
  }
  return out;
}

function createReplayBossSpawn(enemyType: string, spawnAtMs: number, tables: RankedReplayTables): SpawnSpec {
  const def = tables.enemies[enemyType];
  return {
    enemyType,
    spawnAtMs,
    startAngleRad: -Math.PI / 2,
    startRadius: def?.startRadius ?? 0,
    angularSpeed: def?.angularSpeed ?? 0,
    approachSpeed: def?.approachSpeed ?? 0,
  };
}

function assignReplaySpawnOrdinals(spawns: SpawnSpec[]): SpawnSpec[] {
  return spawns
    .map((spawn, index) => ({ spawn, index }))
    .sort((a, b) => a.spawn.spawnAtMs - b.spawn.spawnAtMs || a.index - b.index)
    .map(({ spawn }, index) => ({ ...spawn, spawnOrdinal: index + 1 }));
}

function validateRankedSemanticTrace(
  summary: RunSummary,
  trace: RankedReplayTrace,
  tables: RankedReplayTables,
  maxSurvivalMs: number,
): RankedReplayValidation {
  const bounds = computeRankedReplayBounds(summary, tables, maxSurvivalMs);
  if (!Array.isArray(trace.hitEvents) || !Array.isArray(trace.killEvents) || !Array.isArray(trace.comboBreakEvents) || !Array.isArray(trace.skillEvents)) {
    return { ok: false, reason: "replay_trace_missing", bounds };
  }
  const spawnResult = generateRankedReplaySpawnsForTrace(summary, trace, tables);
  if (!spawnResult.ok) return { ok: false, reason: spawnResult.reason, bounds };
  const spawns = spawnResult.spawns;
  const spawnByOrdinal = new Map(spawns.map((spawn) => [spawn.spawnOrdinal, spawn] as const));

  for (const event of trace.skillEvents) {
    if (!Number.isFinite(event.atMs) || event.atMs < 0 || event.atMs > summary.survivalMs) {
      return { ok: false, reason: "replay_trace_invalid_time", bounds };
    }
    if (!isSkillId(event.skillId)) return { ok: false, reason: "replay_trace_summary_mismatch", bounds };
  }

  const sortedKills = [...trace.killEvents].sort((a, b) => a.hitAtMs - b.hitAtMs || a.spawnOrdinal - b.spawnOrdinal);
  const hitProgression = replayHitProgression(trace.hitEvents, spawnByOrdinal, summary, tables, trace.skillEvents);
  if (!hitProgression.ok) return { ok: false, reason: hitProgression.reason, bounds };
  if (!sameKillSequence(hitProgression.kills, sortedKills)) return { ok: false, reason: "replay_trace_summary_mismatch", bounds };

  for (const event of trace.comboBreakEvents) {
    if (!Number.isFinite(event.atMs) || event.atMs < 0 || event.atMs > summary.survivalMs) {
      return { ok: false, reason: "replay_trace_invalid_time", bounds };
    }
    if (!isComboBreakReason(event.reason)) return { ok: false, reason: "replay_trace_summary_mismatch", bounds };
  }

  const replayed = replayTraceSummary(sortedKills, trace.comboBreakEvents, trace.skillEvents, spawnByOrdinal, tables);
  if (
    replayed.kills !== summary.kills ||
    replayed.maxCombo !== summary.maxCombo ||
    replayed.lastSaveCount !== summary.lastSaveCount ||
    Math.abs(replayed.score - summary.score) > 0.0001
  ) {
    return { ok: false, reason: "replay_trace_summary_mismatch", bounds };
  }
  for (const skillId of SKILL_IDS) {
    if (replayed.skillUse[skillId] !== (summary.skillUse[skillId] ?? 0)) {
      return { ok: false, reason: "replay_trace_summary_mismatch", bounds };
    }
  }
  return { ok: true, bounds };
}

function generateRankedReplaySpawnsForTrace(
  summary: Pick<RunSummary, "difficulty" | "seed" | "survivalMs">,
  trace: RankedReplayTrace,
  tables: RankedReplayTables,
): { ok: true; spawns: SpawnSpec[] } | { ok: false; reason: ReplayTraceReason } {
  const difficulty = isDifficultyId(summary.difficulty) ? summary.difficulty : "rookie";
  const config = buildRunConfig("ranked", {
    difficulty,
    seed: summary.seed,
    configVersion: "server-ranked-replay",
  });
  const runtimeRules = resolveModeRuntimeRules(config);
  const normalSpawns = generateRankedNormalSpawns(summary.seed, summary.survivalMs, difficulty, tables, runtimeRules);
  if (Array.isArray(trace.spawnEvents) && trace.spawnEvents.length > 0) {
    return replaySpawnsFromTraceEvents(summary, trace, normalSpawns, config.rules.bossPolicy.bossEnemyType, runtimeRules.periodicBossEveryMs, tables);
  }
  const bossSpawns = generateRankedBossSpawnsFromTrace(
    normalSpawns,
    trace,
    summary.survivalMs,
    config.rules.bossPolicy.bossEnemyType,
    runtimeRules.periodicBossEveryMs,
    tables,
  );
  return { ok: true, spawns: assignReplaySpawnOrdinals([...normalSpawns, ...bossSpawns]) };
}

function generateRankedBossSpawnsFromTrace(
  normalSpawns: SpawnSpec[],
  trace: RankedReplayTrace,
  survivalMs: number,
  enemyType: string,
  everyMs: number | null,
  tables: RankedReplayTables,
): SpawnSpec[] {
  if (!everyMs || everyMs <= 0) return [];
  const bossSpawns: SpawnSpec[] = [];
  let nextBossAtMs = everyMs;
  let guard = 0;

  while (nextBossAtMs <= survivalMs && guard < 1000) {
    guard += 1;
    const nextBoss = createReplayBossSpawn(enemyType, nextBossAtMs, tables);
    const withOrdinal = assignReplaySpawnOrdinals([...normalSpawns, ...bossSpawns, nextBoss]);
    const nextBossOrdinal = withOrdinal.find((spawn) => spawn.enemyType === enemyType && spawn.spawnAtMs === nextBossAtMs)?.spawnOrdinal;
    bossSpawns.push(nextBoss);

    const bossKill = trace.killEvents.find((event) => event.spawnOrdinal === nextBossOrdinal);
    if (!bossKill || bossKill.hitAtMs > survivalMs) break;
    nextBossAtMs = bossKill.hitAtMs + everyMs;
  }

  return bossSpawns;
}

type ReplayTraceReason = "replay_trace_invalid_time" | "replay_trace_unknown_spawn" | "replay_trace_duplicate_kill" | "replay_trace_kill_before_spawn" | "replay_trace_invalid_geometry" | "replay_trace_summary_mismatch";

function replaySpawnsFromTraceEvents(
  summary: Pick<RunSummary, "difficulty" | "seed" | "survivalMs">,
  trace: RankedReplayTrace,
  normalSpawns: SpawnSpec[],
  bossEnemyType: string,
  bossEveryMs: number | null,
  tables: RankedReplayTables,
): { ok: true; spawns: SpawnSpec[] } | { ok: false; reason: ReplayTraceReason } {
  const events = trace.spawnEvents ?? [];
  const byOrdinal = new Map<number, SpawnSpec>();
  const spawns: SpawnSpec[] = [];

  for (const event of events) {
    if (!validReplaySpawnEvent(event, summary.survivalMs, tables)) return { ok: false, reason: "replay_trace_summary_mismatch" };
    if (byOrdinal.has(event.spawnOrdinal)) return { ok: false, reason: "replay_trace_summary_mismatch" };
    const spawn = replaySpawnEventToSpec(event);
    byOrdinal.set(event.spawnOrdinal, spawn);
    spawns.push(spawn);
  }

  const waveSpawns = events.filter((event) => event.source === "wave").map(replaySpawnEventToSpec);
  if (!sameSpawnMultiset(waveSpawns, normalSpawns)) return { ok: false, reason: "replay_trace_summary_mismatch" };

  const bossValidation = validateBossSpawnEventsFromTrace(events, trace, summary.survivalMs, bossEnemyType, bossEveryMs, tables);
  if (!bossValidation.ok) return bossValidation;

  for (const event of events) {
    if (event.source === "split") {
      const validation = validateSplitSpawnEvent(event, byOrdinal, trace, tables);
      if (!validation.ok) return validation;
      continue;
    }
    if (event.source === "boss_shard") {
      if (!event.parentSpawnOrdinal) return { ok: false, reason: "replay_trace_unknown_spawn" };
      const parent = byOrdinal.get(event.parentSpawnOrdinal);
      if (!parent || !tables.enemies[parent.enemyType]?.boss) return { ok: false, reason: "replay_trace_unknown_spawn" };
      const validation = validateBossShardSpawnEvent(event, parent);
      if (!validation.ok) return validation;
    }
  }

  return { ok: true, spawns };
}

function validateBossShardSpawnEvent(
  event: NonNullable<RankedReplayTrace["spawnEvents"]>[number],
  parent: SpawnSpec,
): { ok: true } | { ok: false; reason: ReplayTraceReason } {
  if (event.spawnAtMs < parent.spawnAtMs) return { ok: false, reason: "replay_trace_summary_mismatch" };
  if (!isBossId(parent.enemyType)) return { ok: false, reason: "replay_trace_summary_mismatch" };
  const expectedShardType = BOSS_DEFINITIONS[parent.enemyType].shardPattern?.shardEnemyType;
  if (!expectedShardType || event.enemyType !== expectedShardType) return { ok: false, reason: "replay_trace_summary_mismatch" };
  return { ok: true };
}

function isBossId(value: string): value is BossId {
  return Object.prototype.hasOwnProperty.call(BOSS_DEFINITIONS, value);
}

function validReplaySpawnEvent(
  event: NonNullable<RankedReplayTrace["spawnEvents"]>[number],
  survivalMs: number,
  tables: RankedReplayTables,
): boolean {
  return (
    Number.isInteger(event.spawnOrdinal) &&
    event.spawnOrdinal > 0 &&
    Boolean(tables.enemies[event.enemyType]) &&
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

function replaySpawnEventToSpec(event: NonNullable<RankedReplayTrace["spawnEvents"]>[number]): SpawnSpec {
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

function validateBossSpawnEventsFromTrace(
  events: NonNullable<RankedReplayTrace["spawnEvents"]>,
  trace: RankedReplayTrace,
  survivalMs: number,
  bossEnemyType: string,
  bossEveryMs: number | null,
  tables: RankedReplayTables,
): { ok: true } | { ok: false; reason: ReplayTraceReason } {
  const bossEvents = events.filter((event) => event.source === "boss").sort((a, b) => a.spawnAtMs - b.spawnAtMs || a.spawnOrdinal - b.spawnOrdinal);
  if (!bossEveryMs || bossEveryMs <= 0) return bossEvents.length === 0 ? { ok: true } : { ok: false, reason: "replay_trace_summary_mismatch" };

  let nextBossAtMs = bossEveryMs;
  for (let i = 0; i < bossEvents.length; i += 1) {
    const event = bossEvents[i]!;
    if (event.enemyType !== bossEnemyType) return { ok: false, reason: "replay_trace_summary_mismatch" };
    if (!sameSpawnShape(replaySpawnEventToSpec(event), createReplayBossSpawn(bossEnemyType, nextBossAtMs, tables))) {
      return { ok: false, reason: "replay_trace_summary_mismatch" };
    }
    const bossKill = trace.killEvents.find((kill) => kill.spawnOrdinal === event.spawnOrdinal);
    if (!bossKill) {
      if (i !== bossEvents.length - 1) return { ok: false, reason: "replay_trace_summary_mismatch" };
      return { ok: true };
    }
    if (bossKill.hitAtMs < event.spawnAtMs) return { ok: false, reason: "replay_trace_kill_before_spawn" };
    nextBossAtMs = bossKill.hitAtMs + bossEveryMs;
  }

  if (nextBossAtMs <= survivalMs) return { ok: false, reason: "replay_trace_summary_mismatch" };
  return { ok: true };
}

function validateSplitSpawnEvent(
  event: NonNullable<RankedReplayTrace["spawnEvents"]>[number],
  byOrdinal: ReadonlyMap<number, SpawnSpec>,
  trace: RankedReplayTrace,
  tables: RankedReplayTables,
): { ok: true } | { ok: false; reason: ReplayTraceReason } {
  if (!event.parentSpawnOrdinal) return { ok: false, reason: "replay_trace_unknown_spawn" };
  const parent = byOrdinal.get(event.parentSpawnOrdinal);
  if (!parent) return { ok: false, reason: "replay_trace_unknown_spawn" };
  const parentDef = tables.enemies[parent.enemyType];
  if (!parentDef?.splitInto || parentDef.splitInto !== event.enemyType) return { ok: false, reason: "replay_trace_summary_mismatch" };
  const parentKill = trace.killEvents.find((kill) => kill.spawnOrdinal === event.parentSpawnOrdinal);
  if (!parentKill) return { ok: false, reason: "replay_trace_summary_mismatch" };
  const expected = splitSpawnSpecsForEnemy(replayEnemyAt(parent, parentKill.hitAtMs, tables), parentKill.hitAtMs);
  const submitted = replaySpawnEventToSpec(event);
  if (!expected.some((spawn) => sameSpawnShape(spawn, submitted))) return { ok: false, reason: "replay_trace_summary_mismatch" };
  return { ok: true };
}

function sameSpawnMultiset(actual: SpawnSpec[], expected: SpawnSpec[]): boolean {
  if (actual.length !== expected.length) return false;
  const left = [...actual].sort(compareSpawnShape);
  const right = [...expected].sort(compareSpawnShape);
  for (let i = 0; i < left.length; i += 1) {
    if (!sameSpawnShape(left[i]!, right[i]!)) return false;
  }
  return true;
}

function compareSpawnShape(a: SpawnSpec, b: SpawnSpec): number {
  return (
    a.spawnAtMs - b.spawnAtMs ||
    a.enemyType.localeCompare(b.enemyType) ||
    a.startAngleRad - b.startAngleRad ||
    a.startRadius - b.startRadius ||
    a.angularSpeed - b.angularSpeed ||
    a.approachSpeed - b.approachSpeed
  );
}

function sameSpawnShape(a: SpawnSpec, b: SpawnSpec): boolean {
  return (
    a.enemyType === b.enemyType &&
    nearlyEqual(a.spawnAtMs, b.spawnAtMs) &&
    nearlyEqual(a.startAngleRad, b.startAngleRad) &&
    nearlyEqual(a.startRadius, b.startRadius) &&
    nearlyEqual(a.angularSpeed, b.angularSpeed) &&
    nearlyEqual(a.approachSpeed, b.approachSpeed)
  );
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.0001;
}

function replayHitProgression(
  hitEvents: RankedReplayHitEvent[],
  spawnByOrdinal: Map<number | undefined, SpawnSpec>,
  summary: RunSummary,
  tables: RankedReplayTables,
  skillEvents: RankedReplaySkillEvent[],
): { ok: true; kills: RankedReplayHitEvent[] } | { ok: false; reason: ReplayTraceReason } {
  const sortedHits = [...hitEvents].sort((a, b) => a.hitAtMs - b.hitAtMs || a.spawnOrdinal - b.spawnOrdinal);
  const hpByOrdinal = new Map<number, number>();
  const shieldByOrdinal = new Map<number, number>();
  const armorByOrdinal = new Map<number, number>();
  const killed = new Set<number>();
  const kills: RankedReplayHitEvent[] = [];

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

    const geometry = validateKillGeometry(event, spawn, summary.difficulty, tables, skillEvents, true);
    if (!geometry.ok) return { ok: false, reason: geometry.reason };

    const def = tables.enemies[spawn.enemyType];
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

    const expectedDamage = expectedHitDamage(event, tables);
    if (!Number.isInteger(event.damage) || event.damage !== expectedDamage) return { ok: false, reason: "replay_trace_summary_mismatch" };

    const enemyHp = hpByOrdinal.get(event.spawnOrdinal) ?? def.hp;
    if (typeof enemyHp !== "number" || !Number.isFinite(enemyHp)) return { ok: false, reason: "replay_trace_unknown_spawn" };
    const remaining = Math.max(0, enemyHp - event.damage);
    hpByOrdinal.set(event.spawnOrdinal, remaining);
    if (remaining <= 0) {
      killed.add(event.spawnOrdinal);
      kills.push(event);
    }
  }

  return { ok: true, kills };
}

function expectedHitDamage(event: RankedReplayHitEvent, tables: RankedReplayTables): number {
  const multiplier = event.damageMultiplier ?? 1;
  if (event.source === "solar_lance") return Math.max(1, Math.ceil((tables.skills.solar_lance.hitDamage ?? 1) * multiplier));
  if (event.source === "skill" && event.skillId === "orbital_cut") {
    return Math.max(1, Math.ceil((tables.skills.orbital_cut.hitDamage ?? 2) * multiplier));
  }
  if (event.source === "skill" && event.skillId === "nova_pulse") {
    return Math.max(1, Math.ceil((tables.skills.nova_pulse.hitDamage ?? 1) * multiplier));
  }
  return Math.max(1, Math.ceil(1 * multiplier));
}

function sameKillSequence(expected: RankedReplayHitEvent[], submitted: RankedReplayKillEvent[]): boolean {
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

function sameSegment(a: Segment | undefined, b: Segment | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.a.x === b.a.x && a.a.y === b.a.y && a.b.x === b.b.x && a.b.y === b.b.y;
}

function validateKillGeometry(
  event: RankedReplayHitEvent | RankedReplayKillEvent,
  spawn: SpawnSpec,
  difficulty: string,
  tables: RankedReplayTables,
  skillEvents: RankedReplaySkillEvent[],
  requireSource = false,
): { ok: true } | { ok: false; reason: "replay_trace_invalid_geometry" | "replay_trace_summary_mismatch" } {
  const segment = event.segment;
  if (requireSource && !event.source) {
    return { ok: false, reason: "replay_trace_summary_mismatch" };
  }
  if (event.source != null && !isReplayKillSource(event.source)) {
    return { ok: false, reason: "replay_trace_summary_mismatch" };
  }
  if (event.source === "slash" && event.skillId != null) return { ok: false, reason: "replay_trace_summary_mismatch" };
  if (event.source === "solar_lance" && event.skillId !== "solar_lance") return { ok: false, reason: "replay_trace_summary_mismatch" };
  if (event.source === "skill" && event.skillId !== "orbital_cut" && event.skillId !== "nova_pulse") {
    return { ok: false, reason: "replay_trace_summary_mismatch" };
  }
  if (event.skillId && !skillEvents.some((skill) => skill.skillId === event.skillId && Math.abs(skill.atMs - event.hitAtMs) <= 100)) {
    return { ok: false, reason: "replay_trace_invalid_geometry" };
  }
  if (!segment) {
    if (event.accuracy === "directional" || event.accuracy === "bossWeak" || event.source === "slash" || event.source === "solar_lance") {
      return { ok: false, reason: "replay_trace_invalid_geometry" };
    }
    return { ok: true };
  }
  if (!validSegment(segment)) return { ok: false, reason: "replay_trace_invalid_geometry" };
  if (event.source === "slash" && segmentLength(segment) < LIVE_SEGMENT_MIN_LENGTH_PX) {
    return { ok: false, reason: "replay_trace_invalid_geometry" };
  }

  const enemy = replayEnemyAt(spawn, event.hitAtMs, tables);
  const inflate = event.source === "solar_lance" ? SOLAR_LANCE_HIT_INFLATE_PX : NORMAL_SLASH_HIT_INFLATE_PX;
  const hitRadius = enemy.radiusPx * replayVisualScale(enemy.radius, difficulty, tables) + inflate;
  const center = {
    x: EARTH_CENTER_X + Math.cos(enemy.angle) * enemy.radius,
    y: EARTH_CENTER_Y + Math.sin(enemy.angle) * enemy.radius,
  };

  if (!segmentIntersectsCircle(segment, center.x, center.y, hitRadius)) {
    return { ok: false, reason: "replay_trace_invalid_geometry" };
  }
  if (event.band !== distanceBand(enemy.radius, EARTH_GAMEPLAY_RADIUS, tables.difficulty.zones as ZoneTable)) {
    return { ok: false, reason: "replay_trace_summary_mismatch" };
  }

  const expectedAccuracy = directionalSlashAccuracy(segment, enemy);
  if (event.accuracy === "directional" && expectedAccuracy !== "directional") {
    return { ok: false, reason: "replay_trace_invalid_geometry" };
  }
  if (enemy.directional && event.accuracy !== "directional") {
    return { ok: false, reason: "replay_trace_summary_mismatch" };
  }
  if (event.accuracy !== "bossWeak") return { ok: true };

  const weak = resolveBossWeakPointHit(segment, enemy, EARTH_CENTER_X, EARTH_CENTER_Y, replayVisualScale(enemy.radius, difficulty, tables));
  if (weak.accuracy !== "bossWeak") return { ok: false, reason: "replay_trace_invalid_geometry" };
  if (event.damageMultiplier != null && Math.abs(event.damageMultiplier - weak.damageMultiplier) > 0.0001) {
    return { ok: false, reason: "replay_trace_summary_mismatch" };
  }
  return { ok: true };
}

function replayEnemyAt(spawn: SpawnSpec, hitAtMs: number, tables: RankedReplayTables): EnemyState {
  const def = tables.enemies[spawn.enemyType]!;
  const elapsedSec = Math.max(0, hitAtMs - spawn.spawnAtMs) / 1000;
  const directionalAngle = def.directionalSlashAngleDeg == null ? undefined : (def.directionalSlashAngleDeg * Math.PI) / 180;
  return {
    id: spawn.spawnOrdinal ?? 0,
    spawnOrdinal: spawn.spawnOrdinal,
    type: spawn.enemyType,
    angle: spawn.startAngleRad + spawn.angularSpeed * elapsedSec,
    radius: spawn.startRadius - spawn.approachSpeed * elapsedSec,
    angularSpeed: spawn.angularSpeed,
    approachSpeed: spawn.approachSpeed,
    radiusPx: def.radiusPx,
    earthImpactRadiusPx: def.earthImpactRadiusPx ?? 0,
    maxHp: def.hp,
    directional: def.directional,
    directionalSlashAngleRad: directionalAngle,
    directionalToleranceDeg: def.directional ? (def.directionalToleranceDeg ?? 30) : undefined,
    hp: def.hp,
    damage: def.damage,
    score: def.score,
    boss: def.boss,
    attribute: def.attribute,
    behavior: def.behavior,
    splitInto: def.splitInto,
    splitCount: def.splitCount,
    precisionBonus: def.precisionBonus,
    shieldHits: def.shieldHits,
    empOnWrongHit: def.empOnWrongHit,
    gravityPullRadiusPx: def.gravityPullRadiusPx,
    visibility: def.visibility,
    armorHits: def.armorHits,
    alive: true,
  };
}

function replayVisualScale(radius: number, difficulty: string, tables: RankedReplayTables): number {
  const diff = tables.difficulty[difficulty] as DifficultyDef | undefined;
  const swell = diff?.gravitySwell ?? 1;
  const near = 1.3 * swell;
  const far = 0.6;
  const t = Math.max(0, Math.min(1, 1 - radius / (EARTH_GAMEPLAY_RADIUS * 6)));
  return far + (near - far) * t;
}

function validSegment(segment: Segment): boolean {
  return (
    Number.isFinite(segment.a.x) &&
    Number.isFinite(segment.a.y) &&
    Number.isFinite(segment.b.x) &&
    Number.isFinite(segment.b.y)
  );
}

function segmentLength(segment: Segment): number {
  return Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
}

function replayTraceSummary(
  kills: RankedReplayKillEvent[],
  comboBreaks: RankedReplayComboBreakEvent[],
  skillEvents: RankedReplaySkillEvent[],
  spawnByOrdinal: Map<number | undefined, SpawnSpec>,
  tables: RankedReplayTables,
): { score: number; kills: number; maxCombo: number; lastSaveCount: number; skillUse: Record<SkillId, number> } {
  const scoring = new ScoringSystem(tables.scoring);
  const allEvents = [
    ...kills.map((event) => ({ kind: "kill" as const, atMs: event.hitAtMs, event })),
    ...comboBreaks.map((event) => ({ kind: "break" as const, atMs: event.atMs, event })),
  ].sort((a, b) => a.atMs - b.atMs || (a.kind === "break" ? -1 : 1));
  const skillUse = Object.fromEntries(SKILL_IDS.map((skillId) => [skillId, 0])) as Record<SkillId, number>;
  for (const event of skillEvents) {
    if (event.skillId in skillUse) skillUse[event.skillId] += 1;
  }

  let pendingKills: RankedReplayKillEvent[] = [];
  const flushKills = (): void => {
    if (pendingKills.length === 0) return;
    for (const group of groupByComboTimeout(pendingKills, tables.scoring.comboChainTimeoutMs ?? 650)) {
      const scoreByOrdinal = new Map<number, number>();
      const typeByOrdinal = new Map<number, string>();
      const hits: HitResult[] = group.map((event) => {
        const spawn = spawnByOrdinal.get(event.spawnOrdinal);
        const def = spawn ? tables.enemies[spawn.enemyType] : undefined;
        scoreByOrdinal.set(event.spawnOrdinal, def?.score ?? 0);
        typeByOrdinal.set(event.spawnOrdinal, spawn?.enemyType ?? "");
        return {
          enemyId: event.spawnOrdinal,
          band: event.band,
          accuracy: event.accuracy,
          damageMultiplier: event.damageMultiplier,
        };
      });
      scoring.onHit(
        hits,
        (id) => scoreByOrdinal.get(id) ?? 0,
        (id) => typeByOrdinal.get(id) ?? "",
        group[group.length - 1]?.hitAtMs,
      );
    }
    pendingKills = [];
  };

  for (const entry of allEvents) {
    if (entry.kind === "break") {
      flushKills();
      scoring.onMiss();
      continue;
    }
    pendingKills.push(entry.event);
  }
  flushKills();
  const snapshot = scoring.snapshot();
  return {
    score: snapshot.score,
    kills: snapshot.kills,
    maxCombo: snapshot.maxCombo,
    lastSaveCount: snapshot.lastSaveCount,
    skillUse,
  };
}

function computeMaxScore(spawns: SpawnSpec[], tables: RankedReplayTables): number {
  const maxAccuracy = Math.max(...Object.values(tables.scoring.accuracyMultiplier));
  const lastSaveMultiplier = tables.scoring.distanceMultiplier.lastSave ?? 1;
  const maxMultiCutBonus = Math.max(...Object.values(tables.scoring.multiCutBonus));
  let score = 0;
  for (let i = 0; i < spawns.length; i += 1) {
    const def = tables.enemies[spawns[i]!.enemyType];
    if (!def) continue;
    const combo = i + 1;
    score += def.score * lastSaveMultiplier * maxAccuracy * comboMultiplierFor(combo, tables.scoring);
    score += maxMultiCutBonus;
  }
  return Math.ceil(score * SCORE_SAFETY_RATIO + SCORE_SAFETY_FLAT);
}

function computeMaxSkillUse(survivalMs: number, spawns: SpawnSpec[], tables: RankedReplayTables): Record<SkillId, number> {
  const totalGaugeUpper = spawns.reduce((sum, spawn) => {
    const base = tables.scoring.gaugeGain[spawn.enemyType] ?? 0;
    const directional = tables.enemies[spawn.enemyType]?.directional ? tables.scoring.gaugeGain.directionalCut ?? 0 : 0;
    const lastSave = tables.scoring.gaugeGain.lastSave ?? 0;
    const comboKill = tables.scoring.gaugeGain.comboKill ?? 0;
    const bossWeak = tables.enemies[spawn.enemyType]?.boss ? tables.scoring.gaugeGain.bossWeakPoint ?? 0 : 0;
    return sum + base + directional + lastSave + comboKill + bossWeak;
  }, SKILL_GAUGE_SAFETY);

  const out = {} as Record<SkillId, number>;
  for (const skillId of SKILL_IDS) {
    const def = tables.skills[skillId];
    const cooldownMs = Math.max(1, def.cooldownSec * 1000);
    const byCooldown = Math.floor(survivalMs / cooldownMs) + SKILL_COOLDOWN_SAFETY_COUNT;
    const byGauge = Math.floor(totalGaugeUpper / Math.max(1, def.gaugeCost)) + SKILL_COOLDOWN_SAFETY_COUNT;
    out[skillId] = Math.max(0, Math.min(byCooldown, byGauge));
  }
  return out;
}

function isDifficultyId(value: string): value is DifficultyId {
  return (DIFFICULTY_IDS as readonly string[]).includes(value);
}

function isSkillId(value: string): value is SkillId {
  return (SKILL_IDS as readonly string[]).includes(value);
}

function isDistanceBand(value: string): boolean {
  return (DISTANCE_BANDS as readonly string[]).includes(value);
}

function isAccuracyKind(value: string): boolean {
  return (ACCURACY_KINDS as readonly string[]).includes(value);
}

function isComboBreakReason(value: string): boolean {
  return (COMBO_BREAK_REASONS as readonly string[]).includes(value);
}

function isAbsorbedKind(value: string): value is "shield" | "armor" {
  return value === "shield" || value === "armor";
}

function isReplaySpawnSource(value: string): value is "wave" | "boss" | "split" | "boss_shard" {
  return value === "wave" || value === "boss" || value === "split" || value === "boss_shard";
}

function isReplayKillSource(value: string): boolean {
  return value === "slash" || value === "solar_lance" || value === "skill";
}
