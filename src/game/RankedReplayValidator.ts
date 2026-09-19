import enemiesJson from "../data/enemies.json";
import difficultyJson from "../data/difficulty.json";
import orbitsJson from "../data/orbits.json";
import scoringJson from "../data/scoring.json";
import skillsJson from "../data/skills.json";
import wavesJson from "../data/waves.json";
import {
  computeRankedScoreBounds,
  createRankedCoreRulesFromJson,
  deriveRankedReplaySpawns,
  generateRankedCoreSpawns,
  replayRankedScore,
  validateRankedSkillTimeline,
  withPotentialRankedSplitSpawns,
  type RankedCoreRules,
} from "../../shared/ranked-core";
import { segmentIntersectsCircle } from "./CollisionSystem";
import { directionalSlashAccuracy } from "./DirectionalCut";
import { resolveBossWeakPointHit } from "./BossSystem";
import { BOSS_DEFINITIONS } from "./BossDefinitions";
import { EARTH_CENTER_X, EARTH_CENTER_Y, EARTH_GAMEPLAY_RADIUS, distanceBand } from "./coords";
import { LIVE_SEGMENT_MIN_LENGTH_PX, NORMAL_SLASH_HIT_INFLATE_PX, SOLAR_LANCE_HIT_INFLATE_PX } from "./input-tuning";
import type { DifficultyId, SkillId } from "./ModeConfig";
import { matchesCurrentRankedRulesContract, type RankedRulesContract } from "./RankedRulesContract";
import type { DifficultyDef, DifficultyTable, EnemyState, EnemyTable, OrbitProfile, ScoringConfig, Segment, SkillTable, SpawnSpec, WaveTable, ZoneTable } from "./types";
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
        | "ranked_rules_mismatch"
        | "replay_not_ranked"
        | "replay_invalid_difficulty"
        | "replay_invalid_survival"
        | "replay_survival_exceeds_token_ttl"
        | "replay_kills_exceed_spawned"
        | "replay_last_save_exceeds_kills"
        | "replay_score_exceeds_bound"
        | "replay_skill_use_exceeds_bound"
        | "replay_skill_timeline_invalid"
        | "replay_trace_missing"
        | "replay_trace_invalid_time"
        | "replay_trace_unknown_spawn"
        | "replay_trace_duplicate_kill"
        | "replay_trace_kill_before_spawn"
        | "replay_trace_invalid_geometry"
        | "replay_trace_summary_mismatch";
      bounds?: RankedReplayBounds;
    };

export type RankedReplaySpawnSpec = SpawnSpec & {
  source?: "wave" | "boss" | "split";
  parentSpawnOrdinal?: number;
};

export const RANKED_REPLAY_MAX_SURVIVAL_MS = 15 * 60 * 1000;
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

const DEFAULT_RANKED_CORE_RULES = createRankedCoreRulesFromJson(
  enemiesJson,
  difficultyJson,
  orbitsJson,
  wavesJson,
  scoringJson,
  skillsJson,
);

function coreRulesFor(tables: RankedReplayTables): RankedCoreRules {
  return {
    ...DEFAULT_RANKED_CORE_RULES,
    enemies: tables.enemies,
    difficulty: tables.difficulty,
    orbits: tables.orbits,
    waves: tables.waves,
    scoring: tables.scoring,
    skills: tables.skills,
  } as unknown as RankedCoreRules;
}

export function validateRankedReplaySubmission(
  summary: RunSummary,
  trace?: RankedReplayTrace,
  tables: RankedReplayTables = DEFAULT_RANKED_REPLAY_TABLES,
  maxSurvivalMs = RANKED_REPLAY_MAX_SURVIVAL_MS,
  expectedRules?: RankedRulesContract,
): RankedReplayValidation {
  if (expectedRules && !matchesCurrentRankedRulesContract(expectedRules)) {
    return { ok: false, reason: "ranked_rules_mismatch" };
  }
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
  const rules = coreRulesFor(tables);
  const allSpawns = withPotentialRankedSplitSpawns(generateRankedCoreSpawns({ ...summary, difficulty }, rules), rules) as SpawnSpec[];
  const scoreBounds = computeRankedScoreBounds(summary.survivalMs, allSpawns, rules);
  const maxKills = allSpawns.length;

  return {
    normalSpawnCount: allSpawns.filter((spawn) => !tables.enemies[spawn.enemyType]?.boss).length,
    bossSpawnCount: allSpawns.filter((spawn) => Boolean(tables.enemies[spawn.enemyType]?.boss)).length,
    maxKills,
    maxLastSaveCount: maxKills,
    maxScore: scoreBounds.maxScore,
    maxSkillUse: scoreBounds.maxSkillUse as Record<SkillId, number>,
    maxSurvivalMs,
  };
}

export function generateRankedReplaySpawns(
  summary: Pick<RunSummary, "difficulty" | "seed" | "survivalMs">,
  tables: RankedReplayTables = DEFAULT_RANKED_REPLAY_TABLES,
): SpawnSpec[] {
  const difficulty = isDifficultyId(summary.difficulty) ? summary.difficulty : "rookie";
  return generateRankedCoreSpawns({ ...summary, difficulty }, coreRulesFor(tables)) as SpawnSpec[];
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
  if (!hasValidSemanticEventSequences(trace)) {
    return { ok: false, reason: "replay_trace_summary_mismatch", bounds };
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

  const sortedKills = [...trace.killEvents].sort(compareReplayHitOrder);
  const hitProgression = replayHitProgression(trace.hitEvents, spawnByOrdinal, summary, tables, trace.skillEvents);
  if (!hitProgression.ok) return { ok: false, reason: hitProgression.reason, bounds };
  if (!sameKillSequence(hitProgression.kills, sortedKills)) return { ok: false, reason: "replay_trace_summary_mismatch", bounds };
  const skillTimeline = validateRankedSkillTimeline(
    hitProgression.kills.map((kill) => ({
      enemyType: spawnByOrdinal.get(kill.spawnOrdinal)?.enemyType ?? "",
      hitAtMs: kill.hitAtMs,
      eventSequence: kill.eventSequence,
      band: kill.band,
      accuracy: kill.accuracy,
    })),
    trace.skillEvents,
    coreRulesFor(tables),
  );
  if (!skillTimeline.ok) return { ok: false, reason: "replay_skill_timeline_invalid", bounds };

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

export function generateRankedReplaySpawnsForTrace(
  summary: Pick<RunSummary, "difficulty" | "seed" | "survivalMs">,
  trace: RankedReplayTrace,
  tables: RankedReplayTables,
): { ok: true; spawns: RankedReplaySpawnSpec[] } | { ok: false; reason: ReplayTraceReason } {
  if (trace.spawnEvents?.some((event) => event.source === "boss_shard")) {
    return { ok: false, reason: "replay_trace_summary_mismatch" };
  }
  const difficulty = isDifficultyId(summary.difficulty) ? summary.difficulty : "rookie";
  const expected = deriveRankedReplaySpawns({ ...summary, difficulty }, trace.killEvents, coreRulesFor(tables)) as RankedReplaySpawnSpec[];
  if (!Array.isArray(trace.spawnEvents) || trace.spawnEvents.length === 0) return { ok: true, spawns: expected };
  const evidence = trace.spawnEvents;
  if (evidence.length !== expected.length) return { ok: false, reason: "replay_trace_summary_mismatch" };
  for (let index = 0; index < expected.length; index += 1) {
    const submitted = evidence[index]!;
    const generated = expected[index]!;
    if (
      submitted.spawnOrdinal !== generated.spawnOrdinal ||
      submitted.source !== generated.source ||
      submitted.parentSpawnOrdinal !== generated.parentSpawnOrdinal ||
      !sameSpawnShape(replaySpawnEventToSpec(submitted), generated)
    ) {
      return { ok: false, reason: "replay_trace_summary_mismatch" };
    }
  }
  return { ok: true, spawns: expected };
}

type ReplayTraceReason = "replay_trace_invalid_time" | "replay_trace_unknown_spawn" | "replay_trace_duplicate_kill" | "replay_trace_kill_before_spawn" | "replay_trace_invalid_geometry" | "replay_trace_summary_mismatch";
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
  const sortedHits = [...hitEvents].sort(compareReplayHitOrder);
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

    const def = tables.enemies[spawn.enemyType];
    if (!def) return { ok: false, reason: "replay_trace_unknown_spawn" };
    const enemyHp = hpByOrdinal.get(event.spawnOrdinal) ?? def.hp;
    if (typeof enemyHp !== "number" || !Number.isFinite(enemyHp)) return { ok: false, reason: "replay_trace_unknown_spawn" };
    const geometry = validateRankedKillGeometry(event, spawn, summary.difficulty, tables, skillEvents, enemyHp, true);
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

    const expectedDamage = expectedHitDamage(event, tables, geometry.damageMultiplier);
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

function expectedHitDamage(event: RankedReplayHitEvent, tables: RankedReplayTables, multiplier: number): number {
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

function sameSegment(a: Segment | undefined, b: Segment | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.a.x === b.a.x && a.a.y === b.a.y && a.b.x === b.b.x && a.b.y === b.b.y;
}

export function validateRankedKillGeometry(
  event: RankedReplayHitEvent | RankedReplayKillEvent,
  spawn: SpawnSpec,
  difficulty: string,
  tables: RankedReplayTables,
  skillEvents: RankedReplaySkillEvent[],
  enemyHp: number,
  requireSource = false,
): { ok: true; damageMultiplier: number } | { ok: false; reason: "replay_trace_invalid_geometry" | "replay_trace_summary_mismatch" } {
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
  if (!segment) {
    if (event.accuracy === "directional" || event.accuracy === "bossWeak" || event.source === "slash" || event.source === "solar_lance") {
      return { ok: false, reason: "replay_trace_invalid_geometry" };
    }
    if (event.damageMultiplier != null && Math.abs(event.damageMultiplier - 1) > 0.0001) {
      return { ok: false, reason: "replay_trace_summary_mismatch" };
    }
    return { ok: true, damageMultiplier: 1 };
  }
  if (!validSegment(segment)) return { ok: false, reason: "replay_trace_invalid_geometry" };
  if (event.source === "slash" && segmentLength(segment) < LIVE_SEGMENT_MIN_LENGTH_PX) {
    return { ok: false, reason: "replay_trace_invalid_geometry" };
  }

  const replayedEnemy = replayEnemyAt(spawn, event.hitAtMs, tables);
  const enemy = { ...replayedEnemy, hp: enemyHp, maxHp: replayedEnemy.maxHp };
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
  if (event.accuracy !== "bossWeak") {
    if (enemy.boss && BOSS_DEFINITIONS[enemy.type as keyof typeof BOSS_DEFINITIONS]?.requiresWeakPointDamage) {
      return { ok: false, reason: "replay_trace_invalid_geometry" };
    }
    if (event.damageMultiplier != null && Math.abs(event.damageMultiplier - 1) > 0.0001) {
      return { ok: false, reason: "replay_trace_summary_mismatch" };
    }
    return { ok: true, damageMultiplier: 1 };
  }

  const weak = resolveBossWeakPointHit(segment, enemy, EARTH_CENTER_X, EARTH_CENTER_Y, replayVisualScale(enemy.radius, difficulty, tables));
  if (weak.accuracy !== "bossWeak") return { ok: false, reason: "replay_trace_invalid_geometry" };
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
  a: Pick<RankedReplayHitEvent, "hitAtMs" | "eventSequence" | "spawnOrdinal">,
  b: Pick<RankedReplayHitEvent, "hitAtMs" | "eventSequence" | "spawnOrdinal">,
): number {
  return (
    a.hitAtMs - b.hitAtMs ||
    (a.eventSequence != null && b.eventSequence != null ? a.eventSequence - b.eventSequence : 0) ||
    a.spawnOrdinal - b.spawnOrdinal
  );
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
  const skillUse = Object.fromEntries(SKILL_IDS.map((skillId) => [skillId, 0])) as Record<SkillId, number>;
  for (const event of skillEvents) {
    if (event.skillId in skillUse) skillUse[event.skillId] += 1;
  }
  const snapshot = replayRankedScore(
    kills.map((event) => ({
      spawnOrdinal: event.spawnOrdinal,
      enemyType: spawnByOrdinal.get(event.spawnOrdinal)?.enemyType ?? "",
      hitAtMs: event.hitAtMs,
      band: event.band,
      accuracy: event.accuracy,
      damageMultiplier: event.damageMultiplier,
    })),
    comboBreaks,
    coreRulesFor(tables),
  );
  return {
    score: snapshot.score,
    kills: snapshot.kills,
    maxCombo: snapshot.maxCombo,
    lastSaveCount: snapshot.lastSaveCount,
    skillUse,
  };
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

function isReplayKillSource(value: string): boolean {
  return value === "slash" || value === "solar_lance" || value === "skill";
}
