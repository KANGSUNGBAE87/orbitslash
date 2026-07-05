import { contentProfileById } from "./ModeConfig";
import type { ContentProfileId, DailyModifierContract, RunConfig, StoryStageContract } from "./ModeConfig";
import type { DifficultyId, FreeDefensePresetId } from "./ModeConfig";

export interface BlitzRuntimeBand {
  fromMs: number;
  label: "basic" | "fast" | "objects" | "directional" | "advanced" | "miniBoss";
  spawnIntervalMultiplier: number;
}

export interface ModeRuntimeRules {
  spawnIntervalMultiplier: number;
  specialObjectMaxActive: number;
  periodicBossEveryMs: number | null;
  bossSequence: string[];
  bossFirstDelayMs: number;
  bossRespawnDelayMs: number;
  endOnBossSequenceComplete: boolean;
  activeContentProfileId?: ContentProfileId;
  enemyWeightBias?: Record<string, number>;
  blitzBands?: BlitzRuntimeBand[];
  storyStages?: StoryStageContract[];
  activeDailyModifier?: DailyModifierContract;
}

const FULL_BOSS_SEQUENCE = ["eclipse_core", "ringed_destroyer", "lava_titan", "ice_colossus", "dark_planet"];
const BLITZ_BANDS: BlitzRuntimeBand[] = [
  { fromMs: 0, label: "basic", spawnIntervalMultiplier: 0.86 },
  { fromMs: 10000, label: "fast", spawnIntervalMultiplier: 0.78 },
  { fromMs: 20000, label: "objects", spawnIntervalMultiplier: 0.74 },
  { fromMs: 30000, label: "directional", spawnIntervalMultiplier: 0.7 },
  { fromMs: 40000, label: "advanced", spawnIntervalMultiplier: 0.66 },
  { fromMs: 50000, label: "miniBoss", spawnIntervalMultiplier: 0.58 },
];

const FREE_DEFENSE_DIFFICULTY_TUNING: Record<
  DifficultyId,
  { spawnIntervalMultiplier: number; bossIntervalMultiplier: number; specialObjectMaxActive: number }
> = {
  rookie: { spawnIntervalMultiplier: 1.08, bossIntervalMultiplier: 1.2, specialObjectMaxActive: 3 },
  defender: { spawnIntervalMultiplier: 1, bossIntervalMultiplier: 1, specialObjectMaxActive: 2 },
  elite: { spawnIntervalMultiplier: 0.86, bossIntervalMultiplier: 0.82, specialObjectMaxActive: 2 },
  master: { spawnIntervalMultiplier: 0.72, bossIntervalMultiplier: 0.66, specialObjectMaxActive: 1 },
};

const FREE_DEFENSE_PRESET_TUNING: Record<
  FreeDefensePresetId,
  { spawnIntervalMultiplier: number; bossIntervalMultiplier: number; specialObjectMaxActiveBonus: number }
> = {
  standard: { spawnIntervalMultiplier: 1, bossIntervalMultiplier: 1, specialObjectMaxActiveBonus: 0 },
  skillPractice: { spawnIntervalMultiplier: 1.08, bossIntervalMultiplier: 1, specialObjectMaxActiveBonus: 2 },
  bossPractice: { spawnIntervalMultiplier: 0.95, bossIntervalMultiplier: 1, specialObjectMaxActiveBonus: 0 },
};

export function resolveModeRuntimeRules(config: RunConfig): ModeRuntimeRules {
  const periodicBossEveryMs = config.rules.bossPolicy.enabled && config.rules.bossPolicy.bossEveryMs > 0
    ? config.rules.bossPolicy.bossEveryMs
    : null;
  const content = config.rules.activeContentProfileId ? contentProfileById(config.rules.activeContentProfileId) : null;
  const contentSpawnMul = content?.spawnIntervalMultiplier ?? 1;
  const contentSpecialMaxActive = content?.specialObjectMaxActive;

  if (config.modeId === "bossRush") {
    return {
      spawnIntervalMultiplier: 0.85 * contentSpawnMul,
      specialObjectMaxActive: contentSpecialMaxActive ?? 1,
      periodicBossEveryMs: null,
      bossSequence: config.rules.bossPolicy.sequence?.length ? config.rules.bossPolicy.sequence : FULL_BOSS_SEQUENCE,
      bossFirstDelayMs: 1500,
      bossRespawnDelayMs: 8000,
      endOnBossSequenceComplete: true,
      activeContentProfileId: config.rules.activeContentProfileId,
      enemyWeightBias: content?.enemyWeightBias,
    };
  }

  if (config.modeId === "blitz60") {
    return {
      spawnIntervalMultiplier: 0.72 * contentSpawnMul,
      specialObjectMaxActive: contentSpecialMaxActive ?? 1,
      periodicBossEveryMs: 45000,
      bossSequence: [],
      bossFirstDelayMs: 1500,
      bossRespawnDelayMs: 8000,
      endOnBossSequenceComplete: false,
      activeContentProfileId: config.rules.activeContentProfileId,
      enemyWeightBias: content?.enemyWeightBias,
      blitzBands: BLITZ_BANDS,
    };
  }

  if (config.modeId === "freeDefense") {
    const difficulty = FREE_DEFENSE_DIFFICULTY_TUNING[config.difficulty];
    const preset = FREE_DEFENSE_PRESET_TUNING[config.rules.freeDefensePreset ?? "standard"];
    return {
      spawnIntervalMultiplier: difficulty.spawnIntervalMultiplier * preset.spawnIntervalMultiplier,
      specialObjectMaxActive: difficulty.specialObjectMaxActive + preset.specialObjectMaxActiveBonus,
      periodicBossEveryMs: periodicBossEveryMs == null
        ? null
        : Math.max(1000, Math.round(periodicBossEveryMs * difficulty.bossIntervalMultiplier * preset.bossIntervalMultiplier)),
      bossSequence: [],
      bossFirstDelayMs: 1500,
      bossRespawnDelayMs: 8000,
      endOnBossSequenceComplete: false,
      activeContentProfileId: config.rules.activeContentProfileId,
      enemyWeightBias: content?.enemyWeightBias,
    };
  }

  if (config.modeId === "ranked") {
    return {
      spawnIntervalMultiplier: 0.9 * contentSpawnMul,
      specialObjectMaxActive: contentSpecialMaxActive ?? 0,
      periodicBossEveryMs: 75000,
      bossSequence: [],
      bossFirstDelayMs: 1500,
      bossRespawnDelayMs: 8000,
      endOnBossSequenceComplete: false,
      activeContentProfileId: config.rules.activeContentProfileId,
      enemyWeightBias: content?.enemyWeightBias,
    };
  }

  if (config.modeId === "daily") {
    return {
      spawnIntervalMultiplier: 0.82 * contentSpawnMul,
      specialObjectMaxActive: contentSpecialMaxActive ?? 3,
      periodicBossEveryMs,
      bossSequence: [],
      bossFirstDelayMs: 1500,
      bossRespawnDelayMs: 8000,
      endOnBossSequenceComplete: false,
      activeContentProfileId: config.rules.activeContentProfileId,
      enemyWeightBias: content?.enemyWeightBias,
      activeDailyModifier: config.rules.dailyModifiers?.find((modifier) => modifier.id === config.rules.activeDailyModifierId),
    };
  }

  return {
    spawnIntervalMultiplier: 1 * contentSpawnMul,
    specialObjectMaxActive: contentSpecialMaxActive ?? 2,
    periodicBossEveryMs,
    bossSequence: [],
    bossFirstDelayMs: 1500,
    bossRespawnDelayMs: 8000,
    endOnBossSequenceComplete: false,
    activeContentProfileId: config.rules.activeContentProfileId,
    enemyWeightBias: content?.enemyWeightBias,
    storyStages: config.rules.storyStages,
  };
}

export function modeSpawnIntervalMultiplierAt(rules: ModeRuntimeRules, elapsedMs: number): number {
  if (!rules.blitzBands || rules.blitzBands.length === 0) return rules.spawnIntervalMultiplier;
  let active = rules.blitzBands[0]!;
  for (const band of rules.blitzBands) {
    if (band.fromMs <= elapsedMs && band.fromMs >= active.fromMs) active = band;
  }
  return active.spawnIntervalMultiplier;
}
