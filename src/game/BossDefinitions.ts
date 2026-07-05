export const BOSS_IDS = ["eclipse_core", "ringed_destroyer", "lava_titan", "ice_colossus", "dark_planet"] as const;

export type BossId = (typeof BOSS_IDS)[number];

export interface BossPhaseDef {
  atHpRatio: number;
  label: "approach" | "pressure" | "enrage";
  spawnWeightMul: number;
  patternKind: "ring_shards" | "lane_pressure" | "core_open";
  objectiveKey?: string;
}

export interface BossWeakPointDef {
  id?: string;
  zone?: "ring" | "body" | "core";
  angleDeg: number;
  radiusRatio: number;
  damageMultiplier: number;
  activePhaseLabels?: Array<BossPhaseDef["label"]>;
}

export interface BossDefinition {
  id: BossId;
  labelKey: string;
  enemyType: BossId;
  phases: BossPhaseDef[];
  weakPoints: BossWeakPointDef[];
  visualTheme: BossVisualTheme;
  requiresWeakPointDamage?: boolean;
  shardPattern?: BossShardPatternDef;
}

export interface BossVisualTheme {
  weakRingColor: number;
  weakBodyColor: number;
  weakCoreColor: number;
  weakHaloColor: number;
  telegraphColor: number;
  telegraphAccentColor: number;
}

export interface BossShardPatternDef {
  shardEnemyType: string;
  warningLeadMs: number;
  volleyIntervalMs: number;
  count: number;
  spreadDeg: number;
  spawnRadiusOffset: number;
}

const DEFAULT_PHASES: BossPhaseDef[] = [
  { atHpRatio: 1, label: "approach", spawnWeightMul: 1, patternKind: "ring_shards" },
  { atHpRatio: 0.62, label: "pressure", spawnWeightMul: 1.2, patternKind: "lane_pressure" },
  { atHpRatio: 0.28, label: "enrage", spawnWeightMul: 1.45, patternKind: "core_open" },
];

export const BOSS_DEFINITIONS: Record<BossId, BossDefinition> = {
  eclipse_core: {
    id: "eclipse_core",
    labelKey: "boss.eclipse_core",
    enemyType: "eclipse_core",
    phases: DEFAULT_PHASES,
    weakPoints: [
      { angleDeg: 0, radiusRatio: 0.28, damageMultiplier: 1.35 },
      { angleDeg: 180, radiusRatio: 0.42, damageMultiplier: 1.2 },
    ],
    visualTheme: {
      weakRingColor: 0xffc14d,
      weakBodyColor: 0xffedd5,
      weakCoreColor: 0xff5a2e,
      weakHaloColor: 0xfef3c7,
      telegraphColor: 0xffc14d,
      telegraphAccentColor: 0xffffff,
    },
    shardPattern: {
      shardEnemyType: "shard_meteor",
      warningLeadMs: 1400,
      volleyIntervalMs: 6800,
      count: 4,
      spreadDeg: 110,
      spawnRadiusOffset: 150,
    },
  },
  ringed_destroyer: {
    id: "ringed_destroyer",
    labelKey: "boss.ringed_destroyer",
    enemyType: "ringed_destroyer",
    phases: [
      {
        atHpRatio: 1,
        label: "approach",
        spawnWeightMul: 1,
        patternKind: "ring_shards",
        objectiveKey: "boss.objective.ringed_destroyer.ring",
      },
      {
        atHpRatio: 0.62,
        label: "pressure",
        spawnWeightMul: 1.25,
        patternKind: "lane_pressure",
        objectiveKey: "boss.objective.ringed_destroyer.body",
      },
      {
        atHpRatio: 0.28,
        label: "enrage",
        spawnWeightMul: 1.55,
        patternKind: "core_open",
        objectiveKey: "boss.objective.ringed_destroyer.core",
      },
    ],
    weakPoints: [
      {
        id: "ring-a",
        zone: "ring",
        angleDeg: 45,
        radiusRatio: 0.78,
        damageMultiplier: 1.45,
        activePhaseLabels: ["approach"],
      },
      {
        id: "ring-b",
        zone: "ring",
        angleDeg: 225,
        radiusRatio: 0.82,
        damageMultiplier: 1.45,
        activePhaseLabels: ["approach"],
      },
      {
        id: "body-core",
        zone: "body",
        angleDeg: 180,
        radiusRatio: 0.24,
        damageMultiplier: 1.8,
        activePhaseLabels: ["pressure", "enrage"],
      },
    ],
    visualTheme: {
      weakRingColor: 0x67e8f9,
      weakBodyColor: 0xffc14d,
      weakCoreColor: 0xff5a2e,
      weakHaloColor: 0xfff7ad,
      telegraphColor: 0xff9f6e,
      telegraphAccentColor: 0x67e8f9,
    },
    requiresWeakPointDamage: true,
    shardPattern: {
      shardEnemyType: "shard_meteor",
      warningLeadMs: 1500,
      volleyIntervalMs: 6500,
      count: 5,
      spreadDeg: 78,
      spawnRadiusOffset: 190,
    },
  },
  lava_titan: {
    id: "lava_titan",
    labelKey: "boss.lava_titan",
    enemyType: "lava_titan",
    phases: [
      {
        atHpRatio: 1,
        label: "approach",
        spawnWeightMul: 1.05,
        patternKind: "core_open",
        objectiveKey: "boss.objective.lava_titan.cores",
      },
      {
        atHpRatio: 0.62,
        label: "pressure",
        spawnWeightMul: 1.3,
        patternKind: "lane_pressure",
        objectiveKey: "boss.objective.lava_titan.lanes",
      },
      {
        atHpRatio: 0.28,
        label: "enrage",
        spawnWeightMul: 1.65,
        patternKind: "ring_shards",
        objectiveKey: "boss.objective.lava_titan.enrage",
      },
    ],
    weakPoints: [
      { id: "lava-core-a", zone: "core", angleDeg: 30, radiusRatio: 0.38, damageMultiplier: 1.35, activePhaseLabels: ["approach"] },
      { id: "lava-core-b", zone: "core", angleDeg: 150, radiusRatio: 0.42, damageMultiplier: 1.35, activePhaseLabels: ["approach"] },
      { id: "lava-core-c", zone: "core", angleDeg: 270, radiusRatio: 0.46, damageMultiplier: 1.35, activePhaseLabels: ["approach"] },
      { id: "lava-heart", zone: "body", angleDeg: 180, radiusRatio: 0.22, damageMultiplier: 1.7, activePhaseLabels: ["pressure", "enrage"] },
    ],
    visualTheme: {
      weakRingColor: 0xffd166,
      weakBodyColor: 0xff8a3d,
      weakCoreColor: 0xfff7ad,
      weakHaloColor: 0xff5a2e,
      telegraphColor: 0xff5a2e,
      telegraphAccentColor: 0xffd166,
    },
    requiresWeakPointDamage: true,
    shardPattern: {
      shardEnemyType: "fire_meteor",
      warningLeadMs: 1200,
      volleyIntervalMs: 5600,
      count: 7,
      spreadDeg: 96,
      spawnRadiusOffset: 160,
    },
  },
  ice_colossus: {
    id: "ice_colossus",
    labelKey: "boss.ice_colossus",
    enemyType: "ice_colossus",
    phases: [
      {
        atHpRatio: 1,
        label: "approach",
        spawnWeightMul: 0.95,
        patternKind: "lane_pressure",
        objectiveKey: "boss.objective.ice_colossus.shield",
      },
      {
        atHpRatio: 0.62,
        label: "pressure",
        spawnWeightMul: 1.2,
        patternKind: "ring_shards",
        objectiveKey: "boss.objective.ice_colossus.cracks",
      },
      {
        atHpRatio: 0.28,
        label: "enrage",
        spawnWeightMul: 1.55,
        patternKind: "core_open",
        objectiveKey: "boss.objective.ice_colossus.core",
      },
    ],
    weakPoints: [
      { id: "ice-shield-a", zone: "ring", angleDeg: 70, radiusRatio: 0.72, damageMultiplier: 1.25, activePhaseLabels: ["approach"] },
      { id: "ice-shield-b", zone: "ring", angleDeg: 250, radiusRatio: 0.74, damageMultiplier: 1.25, activePhaseLabels: ["approach"] },
      { id: "ice-crack", zone: "body", angleDeg: 260, radiusRatio: 0.48, damageMultiplier: 1.45, activePhaseLabels: ["pressure"] },
      { id: "ice-core", zone: "core", angleDeg: 90, radiusRatio: 0.2, damageMultiplier: 1.75, activePhaseLabels: ["enrage"] },
    ],
    visualTheme: {
      weakRingColor: 0xbae6fd,
      weakBodyColor: 0x38bdf8,
      weakCoreColor: 0xffffff,
      weakHaloColor: 0x7dd3fc,
      telegraphColor: 0x38bdf8,
      telegraphAccentColor: 0xe0f2fe,
    },
    requiresWeakPointDamage: true,
    shardPattern: {
      shardEnemyType: "ice_comet",
      warningLeadMs: 1500,
      volleyIntervalMs: 7200,
      count: 4,
      spreadDeg: 120,
      spawnRadiusOffset: 210,
    },
  },
  dark_planet: {
    id: "dark_planet",
    labelKey: "boss.dark_planet",
    enemyType: "dark_planet",
    phases: [
      {
        atHpRatio: 1,
        label: "approach",
        spawnWeightMul: 1.05,
        patternKind: "lane_pressure",
        objectiveKey: "boss.objective.dark_planet.shadow",
      },
      {
        atHpRatio: 0.62,
        label: "pressure",
        spawnWeightMul: 1.35,
        patternKind: "core_open",
        objectiveKey: "boss.objective.dark_planet.falseWeak",
      },
      {
        atHpRatio: 0.28,
        label: "enrage",
        spawnWeightMul: 1.75,
        patternKind: "ring_shards",
        objectiveKey: "boss.objective.dark_planet.trueCore",
      },
    ],
    weakPoints: [
      { id: "dark-decoy-a", zone: "body", angleDeg: 120, radiusRatio: 0.44, damageMultiplier: 1.05, activePhaseLabels: ["approach", "pressure"] },
      { id: "dark-decoy-b", zone: "body", angleDeg: 240, radiusRatio: 0.44, damageMultiplier: 1.05, activePhaseLabels: ["approach", "pressure"] },
      { id: "dark-true-core", zone: "core", angleDeg: 0, radiusRatio: 0.24, damageMultiplier: 1.85, activePhaseLabels: ["enrage"] },
    ],
    visualTheme: {
      weakRingColor: 0xa855f7,
      weakBodyColor: 0xc084fc,
      weakCoreColor: 0xf0abfc,
      weakHaloColor: 0x818cf8,
      telegraphColor: 0x8b5cf6,
      telegraphAccentColor: 0xf0abfc,
    },
    requiresWeakPointDamage: true,
    shardPattern: {
      shardEnemyType: "dark_meteor",
      warningLeadMs: 1300,
      volleyIntervalMs: 6000,
      count: 6,
      spreadDeg: 180,
      spawnRadiusOffset: 170,
    },
  },
};
