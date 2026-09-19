import type {
  RankedCoreRules,
  RankedDifficultyTable,
  RankedEnemyTable,
  RankedOrbitProfile,
  RankedScoringConfig,
  RankedSkillTable,
  RankedWaveTable,
} from "./types.ts";

const DEFAULT_RANKED_CONSTANTS = {
  earthCenterX: 540,
  earthCenterY: 900,
  earthGameplayRadius: 58,
  topHudSafeY: 370,
  startVisualRadiusSafeScale: 0.7,
  rankedSpawnIntervalMultiplier: 0.9,
  periodicBossEveryMs: 75_000,
  bossEnemyType: "eclipse_core",
  liveSegmentMinLengthPx: 24,
  normalSlashHitInflatePx: 12,
  solarLanceHitInflatePx: 30,
  scoreSafetyRatio: 1.08,
  scoreSafetyFlat: 2_000,
  skillGaugeSafety: 120,
  skillCooldownSafetyCount: 1,
} as const;

function defaultOf<T>(value: unknown): T {
  return (typeof value === "object" && value !== null && "default" in value ? value.default : value) as T;
}

/**
 * The client injects JSON tables here; generated Edge code receives the same
 * immutable JSON snapshot.  No engine/runtime state participates in replay
 * validation.
 */
export function createRankedCoreRulesFromJson(
  enemiesSource: unknown,
  difficultySource: unknown,
  orbitsSource: unknown,
  wavesSource: unknown,
  scoringSource: unknown,
  skillsSource: unknown,
): RankedCoreRules {
  const orbits = defaultOf<{ profiles: RankedOrbitProfile[] }>(orbitsSource);
  return {
    enemies: defaultOf<RankedEnemyTable>(enemiesSource),
    difficulty: defaultOf<RankedDifficultyTable>(difficultySource),
    orbits: orbits.profiles,
    waves: defaultOf<RankedWaveTable>(wavesSource),
    scoring: defaultOf<RankedScoringConfig>(scoringSource),
    skills: defaultOf<RankedSkillTable>(skillsSource),
    ranked: { ...DEFAULT_RANKED_CONSTANTS },
  };
}

export const RANKED_SKILL_IDS = ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield", "nova_pulse"] as const;
export const RANKED_DIFFICULTY_IDS = ["rookie", "defender", "elite", "master"] as const;
