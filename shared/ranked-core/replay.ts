import { generateRankedCoreSpawns } from "./spawn";
import type { RankedCoreRules, RankedSpawnSpec, RankedSpawnSummary } from "./types";

export type RankedSpawnEvidenceResult =
  | { ok: true; spawns: RankedSpawnSpec[] }
  | { ok: false; reason: "spawn_sequence_mismatch" };

function nearlyEqual(a: number, b: number) {
  return Math.abs(a - b) <= 0.0001;
}

export interface RankedReplayKillReference {
  spawnOrdinal: number;
  hitAtMs: number;
}

type ReplaySpawn = RankedSpawnSpec & { spawnOrdinal: number; source: "wave" | "boss" | "split"; parentSpawnOrdinal?: number };

function sameSpawn(a: RankedSpawnSpec, b: RankedSpawnSpec) {
  return a.spawnOrdinal === b.spawnOrdinal &&
    a.source === b.source &&
    a.enemyType === b.enemyType &&
    nearlyEqual(a.spawnAtMs, b.spawnAtMs) &&
    nearlyEqual(a.startAngleRad, b.startAngleRad) &&
    nearlyEqual(a.startRadius, b.startRadius) &&
    nearlyEqual(a.angularSpeed, b.angularSpeed) &&
    nearlyEqual(a.approachSpeed, b.approachSpeed) &&
    a.parentSpawnOrdinal === b.parentSpawnOrdinal;
}

function assignReplayOrdinals(spawns: Array<Omit<ReplaySpawn, "spawnOrdinal">>): ReplaySpawn[] {
  return spawns
    .map((spawn, index) => ({ spawn, index }))
    .sort((a, b) => a.spawn.spawnAtMs - b.spawn.spawnAtMs || a.index - b.index)
    .map(({ spawn }, index) => ({ ...spawn, spawnOrdinal: index + 1 }));
}

function normalizeAngle(angle: number) {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
}

function replayEnemyAt(spawn: ReplaySpawn, hitAtMs: number, rules: RankedCoreRules) {
  const def = rules.enemies[spawn.enemyType]!;
  const elapsedSec = Math.max(0, hitAtMs - spawn.spawnAtMs) / 1000;
  return {
    ...spawn,
    ...def,
    angle: spawn.startAngleRad + spawn.angularSpeed * elapsedSec,
    radius: spawn.startRadius - spawn.approachSpeed * elapsedSec,
  };
}

function splitSpawns(parent: ReplaySpawn, hitAtMs: number, rules: RankedCoreRules): Array<Omit<ReplaySpawn, "spawnOrdinal">> {
  const enemy = replayEnemyAt(parent, hitAtMs, rules);
  if (!enemy.splitInto || !enemy.splitCount || enemy.splitCount <= 0) return [];
  const count = Math.max(0, Math.floor(enemy.splitCount));
  const spread = Math.PI / Math.max(3, count + 1);
  const start = enemy.angle - spread * (count - 1) * 0.5;
  return Array.from({ length: count }, (_, index) => ({
    source: "split" as const,
    parentSpawnOrdinal: parent.spawnOrdinal,
    enemyType: enemy.splitInto!,
    spawnAtMs: hitAtMs,
    startAngleRad: normalizeAngle(start + spread * index),
    startRadius: Math.max(180, enemy.radius + 34 + index * 8),
    angularSpeed: enemy.angularSpeed * (index % 2 === 0 ? 1.1 : -0.95),
    approachSpeed: Math.max(20, enemy.approachSpeed * 1.08),
  }));
}

function bossSpawn(atMs: number, rules: RankedCoreRules): Omit<ReplaySpawn, "spawnOrdinal"> | undefined {
  const def = rules.enemies[rules.ranked.bossEnemyType];
  if (!def) return undefined;
  return {
    source: "boss",
    enemyType: rules.ranked.bossEnemyType,
    spawnAtMs: atMs,
    startAngleRad: -Math.PI / 2,
    startRadius: def.startRadius,
    angularSpeed: def.angularSpeed,
    approachSpeed: def.approachSpeed,
  };
}

function sameSequence(a: readonly ReplaySpawn[], b: readonly ReplaySpawn[]) {
  return a.length === b.length && a.every((spawn, index) => sameSpawn(spawn, b[index]!) && spawn.source === b[index]!.source && spawn.parentSpawnOrdinal === b[index]!.parentSpawnOrdinal && spawn.spawnOrdinal === b[index]!.spawnOrdinal);
}

/**
 * Deterministic server replay schedule. Dynamic split children affect later
 * ordinals, so boss and split schedules converge together before evidence is
 * compared. boss_shard is intentionally not generated here.
 */
export function deriveRankedReplaySpawns(
  summary: RankedSpawnSummary,
  killEvents: readonly RankedReplayKillReference[],
  rules: RankedCoreRules,
): ReplaySpawn[] {
  const normal = generateRankedCoreSpawns(summary, rules)
    .filter((spawn) => spawn.source === "wave")
    .map(({ spawnOrdinal: _spawnOrdinal, source: _source, parentSpawnOrdinal: _parentSpawnOrdinal, ...spawn }) => ({ ...spawn, source: "wave" as const }));
  let splits: Array<Omit<ReplaySpawn, "spawnOrdinal">> = [];
  const killFor = (spawnOrdinal: number) => killEvents.find((event) => event.spawnOrdinal === spawnOrdinal);

  for (let iteration = 0; iteration < 64; iteration += 1) {
    const bosses: Array<Omit<ReplaySpawn, "spawnOrdinal">> = [];
    let nextBossAtMs = rules.ranked.periodicBossEveryMs;
    while (nextBossAtMs <= summary.survivalMs && bosses.length < 1000) {
      const boss = bossSpawn(nextBossAtMs, rules);
      if (!boss) break;
      const withOrdinals = assignReplayOrdinals([...normal, ...splits, ...bosses, boss]);
      const assignedBoss = withOrdinals.find((spawn) => spawn.source === "boss" && spawn.spawnAtMs === nextBossAtMs);
      bosses.push(boss);
      const killed = assignedBoss ? killFor(assignedBoss.spawnOrdinal) : undefined;
      if (!killed || killed.hitAtMs < nextBossAtMs || killed.hitAtMs > summary.survivalMs) break;
      nextBossAtMs = killed.hitAtMs + rules.ranked.periodicBossEveryMs;
    }
    const current = assignReplayOrdinals([...normal, ...bosses, ...splits]);
    const nextSplits = current.flatMap((parent) => {
      const killed = killFor(parent.spawnOrdinal);
      return killed && killed.hitAtMs >= parent.spawnAtMs && killed.hitAtMs <= summary.survivalMs
        ? splitSpawns(parent, killed.hitAtMs, rules)
        : [];
    });
    const next = assignReplayOrdinals([...normal, ...bosses, ...nextSplits]);
    if (sameSequence(next, current)) return next;
    splits = nextSplits;
  }

  return assignReplayOrdinals([...normal, ...splits]);
}

/**
 * Public ranked evidence proves server-owned wave/boss ordinals. boss_shard
 * remains deliberately unsupported: its schedule depends on runtime phase
 * state that the current server does not yet simulate deterministically.
 */
export function validateRankedSpawnEvidence(
  summary: RankedSpawnSummary,
  evidence: readonly RankedSpawnSpec[],
  rules: RankedCoreRules,
  killEvents: readonly RankedReplayKillReference[] = [],
): RankedSpawnEvidenceResult {
  if (evidence.some((spawn) => spawn.source === "boss_shard")) {
    return { ok: false, reason: "spawn_sequence_mismatch" };
  }
  const expected = deriveRankedReplaySpawns(summary, killEvents, rules);
  if (evidence.length !== expected.length || evidence.some((spawn, index) => !sameSpawn(spawn, expected[index]!))) {
    return { ok: false, reason: "spawn_sequence_mismatch" };
  }
  return { ok: true, spawns: expected };
}
