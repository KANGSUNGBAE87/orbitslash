import { BOSS_DEFINITIONS, type BossId, type BossPhaseDef, type BossWeakPointDef } from "./BossDefinitions";
import type { AccuracyKind, Segment } from "./types";

export interface IBossSystem {
  tick(dtMs: number): void;
  threatPercent(): number;
}

export interface BossSpawnRequest {
  enemyType: string;
  spawnAtMs: number;
}

export interface BossShardEvent {
  kind: "warning" | "spawn" | "phase_action";
  bossType: string;
  shardEnemyType: string;
  patternKind: BossPhaseDef["patternKind"];
  phaseLabel: BossPhaseDef["label"];
  count: number;
  spreadDeg: number;
  spawnRadiusOffset: number;
  telegraphLeadMs: number;
}

export interface BossEncounterRuntimeConfig {
  enabled: boolean;
  bossEveryMs: number;
  bossEnemyType: string;
  sequence?: string[];
  firstBossDelayMs?: number;
  respawnDelayMs?: number;
}

export interface BossThreatPressure {
  kills?: number;
  combo?: number;
  lastSave?: boolean;
  bossWeakHits?: number;
}

const DEFAULT_FIRST_BOSS_DELAY_MS = 1500;
const DEFAULT_RESPAWN_DELAY_MS = 8000;
const THREAT_ADVANCE_PER_KILL_MS = 900;
const THREAT_ADVANCE_PER_COMBO_MS = 260;
const THREAT_ADVANCE_LAST_SAVE_MS = 5000;
const THREAT_ADVANCE_BOSS_WEAK_MS = 1800;

export class BossEncounterRuntime implements IBossSystem {
  private nextBossAtMs: number;
  private activeBossType: string | null = null;
  private sequenceIndex = 0;
  private completed = false;
  private defeated: string[] = [];
  private elapsedMs = 0;
  private nextShardWarningAtMs = Number.POSITIVE_INFINITY;
  private nextShardVolleyAtMs = Number.POSITIVE_INFINITY;
  private shardWarningIssued = false;
  private lastPhaseLabel: BossPhaseDef["label"] | null = null;

  constructor(private readonly config: BossEncounterRuntimeConfig) {
    this.nextBossAtMs = this.sequenceMode()
      ? (config.firstBossDelayMs ?? DEFAULT_FIRST_BOSS_DELAY_MS)
      : Math.max(1, config.bossEveryMs);
  }

  tick(dtMs: number): void {
    this.elapsedMs += Math.max(0, dtMs);
  }

  threatPercent(): number {
    if (!this.config.enabled || this.completed) return 0;
    if (this.activeBossType) return 100;
    const nextAt = Math.max(1, this.nextBossAtMs);
    return Math.max(0, Math.min(100, (this.elapsedMs / nextAt) * 100));
  }

  nextBossInMs(elapsedMs: number): number {
    if (!this.config.enabled || this.completed || this.activeBossType) return 0;
    return Math.max(0, this.nextBossAtMs - elapsedMs);
  }

  recordThreatPressure(pressure: BossThreatPressure): void {
    if (!this.config.enabled || this.completed || this.activeBossType || this.sequenceMode()) return;
    const kills = Math.max(0, pressure.kills ?? 0);
    const combo = Math.max(0, pressure.combo ?? 0);
    const bossWeakHits = Math.max(0, pressure.bossWeakHits ?? 0);
    const advanceMs =
      kills * THREAT_ADVANCE_PER_KILL_MS +
      combo * THREAT_ADVANCE_PER_COMBO_MS +
      bossWeakHits * THREAT_ADVANCE_BOSS_WEAK_MS +
      (pressure.lastSave ? THREAT_ADVANCE_LAST_SAVE_MS : 0);
    if (advanceMs <= 0) return;
    this.nextBossAtMs = Math.max(this.elapsedMs, this.nextBossAtMs - advanceMs);
  }

  nextSpawns(elapsedMs: number, hasActiveBoss: boolean): BossSpawnRequest[] {
    this.elapsedMs = Math.max(this.elapsedMs, elapsedMs);
    if (!this.config.enabled || this.completed || hasActiveBoss || this.activeBossType) return [];
    if (elapsedMs < this.nextBossAtMs) return [];

    const enemyType = this.nextBossType();
    if (!enemyType) {
      this.completed = true;
      return [];
    }

    this.activeBossType = enemyType;
    return [{ enemyType, spawnAtMs: this.nextBossAtMs }];
  }

  /**
   * Advances an intentionally suppressed spawn window without activating a boss.
   * Used by scripted tutorials so completion cannot release an overdue boss.
   */
  deferUntil(elapsedMs: number): void {
    this.elapsedMs = Math.max(this.elapsedMs, elapsedMs);
    if (!this.config.enabled || this.completed || this.activeBossType || elapsedMs < this.nextBossAtMs) return;
    const delayMs = this.sequenceMode()
      ? Math.max(1, this.config.firstBossDelayMs ?? DEFAULT_FIRST_BOSS_DELAY_MS)
      : Math.max(1, this.config.bossEveryMs);
    this.nextBossAtMs = elapsedMs + delayMs;
  }

  recordBossSpawned(enemyType: string, elapsedMs = this.elapsedMs): void {
    this.activeBossType = enemyType;
    this.elapsedMs = Math.max(this.elapsedMs, elapsedMs);
    this.resetShardCycle(enemyType, elapsedMs);
  }

  recordBossDefeated(enemyType: string, elapsedMs: number): void {
    if (this.activeBossType && this.activeBossType !== enemyType) return;
    this.activeBossType = null;
    this.nextShardWarningAtMs = Number.POSITIVE_INFINITY;
    this.nextShardVolleyAtMs = Number.POSITIVE_INFINITY;
    this.shardWarningIssued = false;
    this.lastPhaseLabel = null;
    this.defeated.push(enemyType);

    if (this.sequenceMode()) {
      this.sequenceIndex += 1;
      if (this.sequenceIndex >= (this.config.sequence?.length ?? 0)) {
        this.completed = true;
        return;
      }
      this.nextBossAtMs = elapsedMs + (this.config.respawnDelayMs ?? DEFAULT_RESPAWN_DELAY_MS);
      return;
    }

    this.nextBossAtMs = elapsedMs + Math.max(1, this.config.bossEveryMs);
  }

  sequenceComplete(): boolean {
    return this.completed && this.sequenceMode();
  }

  defeatedBosses(): string[] {
    return [...this.defeated];
  }

  nextShardEvents(
    boss: { type: string; hp?: number; maxHp?: number; boss?: boolean } | null | undefined,
    elapsedMs: number,
  ): BossShardEvent[] {
    this.elapsedMs = Math.max(this.elapsedMs, elapsedMs);
    if (!boss?.boss || !this.activeBossType || boss.type !== this.activeBossType || !isBossId(boss.type)) return [];
    const definition = BOSS_DEFINITIONS[boss.type];
    const pattern = definition.shardPattern;
    if (!pattern) return [];
    const profile = bossShardAttackProfileForEnemy(boss, pattern);

    const events: BossShardEvent[] = [];
    if (!this.shardWarningIssued && elapsedMs >= this.nextShardWarningAtMs) {
      this.shardWarningIssued = true;
      events.push({
        kind: "warning",
        bossType: boss.type,
        ...profile,
      });
    }

    if (elapsedMs >= this.nextShardVolleyAtMs) {
      events.push({
        kind: "spawn",
        bossType: boss.type,
        ...profile,
      });
      this.nextShardVolleyAtMs += pattern.volleyIntervalMs;
      this.nextShardWarningAtMs = this.nextShardVolleyAtMs - pattern.warningLeadMs;
      this.shardWarningIssued = false;
    }
    return events;
  }

  nextPhaseActionEvents(
    boss: { type: string; hp?: number; maxHp?: number; boss?: boolean } | null | undefined,
    elapsedMs: number,
  ): BossShardEvent[] {
    this.elapsedMs = Math.max(this.elapsedMs, elapsedMs);
    if (!boss?.boss || !this.activeBossType || boss.type !== this.activeBossType || !isBossId(boss.type)) return [];
    const phase = bossPhaseForEnemy(boss);
    if (!phase) return [];
    if (this.lastPhaseLabel === null) {
      this.lastPhaseLabel = phase.label;
      return [];
    }
    if (this.lastPhaseLabel === phase.label) return [];

    this.lastPhaseLabel = phase.label;
    this.resetShardCycle(boss.type, elapsedMs, false);
    const pattern = BOSS_DEFINITIONS[boss.type].shardPattern;
    if (!pattern) return [];
    return [
      {
        kind: "phase_action",
        bossType: boss.type,
        ...bossShardAttackProfileForEnemy(boss, pattern),
      },
    ];
  }

  private sequenceMode(): boolean {
    return Boolean(this.config.sequence && this.config.sequence.length > 0 && this.config.bossEveryMs <= 0);
  }

  private nextBossType(): string | null {
    if (this.sequenceMode()) return this.config.sequence?.[this.sequenceIndex] ?? null;
    return this.config.bossEnemyType;
  }

  private resetShardCycle(enemyType: string, elapsedMs: number, resetPhaseLabel = true): void {
    if (!isBossId(enemyType)) return;
    const pattern = BOSS_DEFINITIONS[enemyType].shardPattern;
    if (!pattern) return;
    if (resetPhaseLabel) this.lastPhaseLabel = null;
    this.nextShardVolleyAtMs = elapsedMs + pattern.volleyIntervalMs;
    this.nextShardWarningAtMs = this.nextShardVolleyAtMs - pattern.warningLeadMs;
    this.shardWarningIssued = false;
  }
}

function bossShardAttackProfileForEnemy(
  boss: { type: string; hp?: number; maxHp?: number; boss?: boolean },
  pattern: { shardEnemyType: string; warningLeadMs: number; count: number; spreadDeg: number; spawnRadiusOffset: number },
): Omit<BossShardEvent, "kind" | "bossType"> {
  const phase = bossPhaseForEnemy(boss);
  const patternKind = phase?.patternKind ?? "ring_shards";
  const phaseLabel = phase?.label ?? "approach";
  if (patternKind === "lane_pressure") {
    return {
      shardEnemyType: pattern.shardEnemyType,
      patternKind,
      phaseLabel,
      count: pattern.count + 2,
      spreadDeg: pattern.spreadDeg * 0.55,
      spawnRadiusOffset: pattern.spawnRadiusOffset + 60,
      telegraphLeadMs: pattern.warningLeadMs,
    };
  }
  if (patternKind === "core_open") {
    return {
      shardEnemyType: pattern.shardEnemyType,
      patternKind,
      phaseLabel,
      count: pattern.count + 1,
      spreadDeg: Math.max(pattern.spreadDeg, 300),
      spawnRadiusOffset: pattern.spawnRadiusOffset + 20,
      telegraphLeadMs: pattern.warningLeadMs,
    };
  }
  return {
    shardEnemyType: pattern.shardEnemyType,
    patternKind,
    phaseLabel,
    count: pattern.count,
    spreadDeg: pattern.spreadDeg,
    spawnRadiusOffset: pattern.spawnRadiusOffset,
    telegraphLeadMs: pattern.warningLeadMs,
  };
}

export function bossPhaseForEnemy(enemy: { type: string; hp?: number; maxHp?: number; boss?: boolean }): BossPhaseDef | null {
  if (!enemy.boss) return null;
  const definition = isBossId(enemy.type) ? BOSS_DEFINITIONS[enemy.type] : null;
  if (!definition) return null;
  const hp = enemy.hp ?? enemy.maxHp ?? 1;
  const maxHp = Math.max(1, enemy.maxHp ?? hp);
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  let active = definition.phases[0] ?? null;
  for (const phase of definition.phases) {
    if (ratio <= phase.atHpRatio) active = phase;
  }
  return active;
}

export interface BossWeakPointHitResult {
  accuracy: AccuracyKind;
  weakPointIndex?: number;
  weakPointId?: string;
  weakPointZone?: BossWeakPointDef["zone"];
  damageMultiplier: number;
  blocked?: boolean;
  blockReason?: "boss_body_locked";
}

export interface BossPatternState {
  kind: BossPhaseDef["patternKind"];
  label: BossPhaseDef["label"];
  spawnWeightMul: number;
}

export function bossPatternForEnemy(enemy: { type: string; hp: number; maxHp?: number; boss?: boolean }): BossPatternState | null {
  const phase = bossPhaseForEnemy(enemy);
  if (!phase) return null;
  return {
    kind: phase.patternKind,
    label: phase.label,
    spawnWeightMul: phase.spawnWeightMul,
  };
}

export function bossWaveSpawnIntervalMultiplierForEnemy(enemy: { type: string; hp: number; maxHp?: number; boss?: boolean }): number {
  const pattern = bossPatternForEnemy(enemy);
  if (!pattern) return 1;
  const weightedPressure = 1 + (pattern.spawnWeightMul - 1) * 0.5;
  return Math.max(0.76, Math.min(1.05, 1 / Math.max(0.25, weightedPressure)));
}

export function resolveBossWeakPointHit(
  segment: Segment,
  enemy: { type: string; angle: number; radius: number; radiusPx: number; hp?: number; maxHp?: number; boss?: boolean },
  earthCx: number,
  earthCy: number,
  visualScale = 1,
): BossWeakPointHitResult {
  if (!enemy.boss || !isBossId(enemy.type)) return { accuracy: "normal", damageMultiplier: 1 };
  const definition = BOSS_DEFINITIONS[enemy.type];
  const activeWeakPoints = bossWeakPointsForEnemy(enemy);
  const centerX = earthCx + Math.cos(enemy.angle) * enemy.radius;
  const centerY = earthCy + Math.sin(enemy.angle) * enemy.radius;
  const scaledRadius = enemy.radiusPx * visualScale;
  const weakRadius = Math.max(18, scaledRadius * 0.13);

  for (let i = 0; i < activeWeakPoints.length; i += 1) {
    const weak = activeWeakPoints[i]!;
    const angle = (weak.angleDeg * Math.PI) / 180;
    const wx = centerX + Math.cos(angle) * scaledRadius * weak.radiusRatio;
    const wy = centerY + Math.sin(angle) * scaledRadius * weak.radiusRatio;
    if (segmentDistanceToPoint(segment, wx, wy) <= weakRadius) {
      return {
        accuracy: "bossWeak",
        weakPointIndex: definition.weakPoints.indexOf(weak),
        weakPointId: weak.id,
        weakPointZone: weak.zone,
        damageMultiplier: weak.damageMultiplier,
      };
    }
  }
  if (definition.requiresWeakPointDamage) {
    return { accuracy: "normal", damageMultiplier: 0, blocked: true, blockReason: "boss_body_locked" };
  }
  return { accuracy: "normal", damageMultiplier: 1 };
}

export function bossWeakPointLocalCircles(
  enemy: { type: string; radiusPx: number; hp?: number; maxHp?: number; boss?: boolean },
  visualScale = 1,
): Array<{
  x: number;
  y: number;
  r: number;
  id?: string;
  zone?: BossWeakPointDef["zone"];
  markerKind: "ring_node" | "body_crack" | "core_orb";
  color: number;
  haloColor: number;
  strokeWidth: number;
  fillAlpha: number;
}> {
  if (!enemy.boss || !isBossId(enemy.type)) return [];
  const scaledRadius = enemy.radiusPx * visualScale;
  const theme = BOSS_DEFINITIONS[enemy.type].visualTheme;
  return bossWeakPointsForEnemy(enemy).map((weak) => {
    const angle = (weak.angleDeg * Math.PI) / 180;
    const zone = weak.zone ?? "core";
    const markerKind = zone === "ring" ? "ring_node" : zone === "body" ? "body_crack" : "core_orb";
    return {
      x: Math.cos(angle) * enemy.radiusPx * weak.radiusRatio,
      y: Math.sin(angle) * enemy.radiusPx * weak.radiusRatio,
      r: Math.max(8, (scaledRadius * 0.13) / Math.max(0.1, visualScale)),
      id: weak.id,
      zone: weak.zone,
      markerKind,
      color: zone === "ring" ? theme.weakRingColor : zone === "body" ? theme.weakBodyColor : theme.weakCoreColor,
      haloColor: theme.weakHaloColor,
      strokeWidth: markerKind === "core_orb" ? 7 : markerKind === "body_crack" ? 6 : 5,
      fillAlpha: markerKind === "core_orb" ? 0.48 : markerKind === "body_crack" ? 0.34 : 0.28,
    };
  });
}

function bossWeakPointsForEnemy(enemy: { type: string; hp?: number; maxHp?: number; boss?: boolean }): BossWeakPointDef[] {
  if (!enemy.boss || !isBossId(enemy.type)) return [];
  const definition = BOSS_DEFINITIONS[enemy.type];
  const phase = bossPhaseForEnemy(enemy);
  if (!phase) return definition.weakPoints;
  const active = definition.weakPoints.filter((weak) => {
    if (!weak.activePhaseLabels || weak.activePhaseLabels.length === 0) return true;
    return weak.activePhaseLabels.includes(phase.label);
  });
  return active.length > 0 ? active : definition.weakPoints;
}

function segmentDistanceToPoint(segment: Segment, px: number, py: number): number {
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

function isBossId(value: string): value is BossId {
  return value in BOSS_DEFINITIONS;
}

export const BossSystem: IBossSystem = new BossEncounterRuntime({
  enabled: false,
  bossEveryMs: 60000,
  bossEnemyType: "eclipse_core",
});
