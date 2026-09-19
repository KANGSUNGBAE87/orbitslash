/**
 * Deno/browser neutral ranked replay contract.  This directory deliberately
 * has no imports from src/game so an identical module graph can be generated
 * for the Edge runtime.
 */
export const RANKED_CORE_SCHEMA_VERSION = 2 as const;

export type RankedDifficultyId = "rookie" | "defender" | "elite" | "master";
export type RankedSkillId = "solar_lance" | "orbital_cut" | "gravity_slow" | "delta_shield" | "nova_pulse";
export type RankedDistanceBand = "outer" | "mid" | "danger" | "lastSave" | "impact";
export type RankedAccuracyKind = "normal" | "directional" | "weakCenter" | "bossWeak";
export type RankedSpawnSource = "wave" | "boss" | "split" | "boss_shard";

export interface RankedEnemyDef {
  startRadius: number;
  approachSpeed: number;
  angularSpeed: number;
  radiusPx: number;
  earthImpactRadiusPx?: number;
  hp: number;
  damage: number;
  score: number;
  directional: boolean;
  directionalSlashAngleDeg?: number;
  directionalToleranceDeg?: number;
  boss?: boolean;
  ignoreSpeedScale?: boolean;
  splitInto?: string;
  splitCount?: number;
  shieldHits?: number;
  armorHits?: number;
}

export type RankedEnemyTable = Record<string, RankedEnemyDef>;

export interface RankedDifficultyDef {
  gravitySwell: number;
  approachSpeedMul: number;
}

export interface RankedZones {
  outer: number;
  mid: number;
  danger: number;
  lastSave: number;
  impact: number;
}

export type RankedDifficultyTable = Record<string, RankedDifficultyDef | RankedZones> & {
  zones: RankedZones;
};

export interface RankedOrbitProfile {
  angularMul: number;
  dir: number;
}

export interface RankedWaveBand {
  fromMs: number;
  spawnIntervalMs?: number;
  approachSpeedMul?: number;
  weights: Record<string, number>;
  maxConsecutive?: Record<string, number>;
}

export type RankedWaveTable = Record<string, readonly RankedWaveBand[]>;

export interface RankedScoringConfig {
  distanceMultiplier: Record<string, number>;
  accuracyMultiplier: Record<string, number>;
  comboMultiplier: ReadonlyArray<{ min: number; mult: number }>;
  comboGainPerSlashCap: number | null;
  comboChainTimeoutMs?: number;
  combatGaugeGainMultiplier?: number;
  multiCutBonus: Record<string, number>;
  gaugeGain: Record<string, number>;
}

export interface RankedSkillDef {
  gaugeCost: number;
  cooldownSec: number;
  hitDamage?: number;
}

export type RankedSkillTable = Record<RankedSkillId, RankedSkillDef>;

export interface RankedCoreConstants {
  earthCenterX: number;
  earthCenterY: number;
  earthGameplayRadius: number;
  topHudSafeY: number;
  startVisualRadiusSafeScale: number;
  rankedSpawnIntervalMultiplier: number;
  periodicBossEveryMs: number;
  bossEnemyType: string;
  liveSegmentMinLengthPx: number;
  normalSlashHitInflatePx: number;
  solarLanceHitInflatePx: number;
  scoreSafetyRatio: number;
  scoreSafetyFlat: number;
  skillGaugeSafety: number;
  skillCooldownSafetyCount: number;
}

export interface RankedCoreRules {
  enemies: RankedEnemyTable;
  difficulty: RankedDifficultyTable;
  orbits: readonly RankedOrbitProfile[];
  waves: RankedWaveTable;
  scoring: RankedScoringConfig;
  skills: RankedSkillTable;
  ranked: RankedCoreConstants;
}

export interface RankedSpawnSpec {
  spawnOrdinal?: number;
  enemyType: string;
  spawnAtMs: number;
  startAngleRad: number;
  startRadius: number;
  angularSpeed: number;
  approachSpeed: number;
  source?: RankedSpawnSource;
  parentSpawnOrdinal?: number;
}

export interface RankedSpawnSummary {
  difficulty: RankedDifficultyId | string;
  seed: number;
  survivalMs: number;
}
