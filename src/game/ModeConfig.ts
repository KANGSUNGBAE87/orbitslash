import { BOSS_IDS, type BossId } from "./BossDefinitions";

export const MODE_IDS = ["story", "freeDefense", "ranked", "bossRush", "blitz60", "daily"] as const;

export type ModeId = (typeof MODE_IDS)[number];
export type DifficultyId = "rookie" | "defender" | "elite" | "master";
export type SeedPolicy = "random" | "fixedPattern" | "dailyFixed" | "weeklyRanked" | "serverAssigned";
export type ObjectiveType = "survival" | "score" | "bossKillCount" | "stageMission" | "dailyModifier";
export type RevivePolicy = "none" | "adRevive" | "retryTicket" | "storyRetry";
export type RunEndReason =
  | "earth_destroyed"
  | "timer_expired"
  | "stage_objective_complete"
  | "boss_sequence_complete"
  | "daily_challenge_failed"
  | "manual_restart";
export type SkillId = "solar_lance" | "orbital_cut" | "gravity_slow" | "delta_shield" | "nova_pulse";
export type StoryStageObjective = "basicSlash" | "lastSave" | "protectObjects" | "comboMaster" | "bossThreat";
export type ContentProfileId = "starter" | "lastSave" | "rescue" | "combo" | "boss" | "elemental" | "precision" | "gravity" | "finale";
export type StoryChapterId = `chapter-${number}`;
export type StoryStageId = `story-${number}`;
export type DailyModifierId = "noSkill" | "rescueDay" | "lastSaveDay" | "bossAlert" | "masterTrial";
export type FreeDefensePresetId = "standard" | "skillPractice" | "bossPractice";

export interface ModeDefinition {
  id: ModeId;
  labelKey: string;
  descriptionKey: string;
  available: boolean;
  unlockState: "unlocked" | "locked" | "comingSoon";
  defaultDifficulty: DifficultyId;
  themeToken: "blue" | "gold" | "red" | "violet" | "cyan" | "green";
}

export interface BossPolicy {
  enabled: boolean;
  bossEveryMs: number;
  bossEnemyType: string;
  sequence?: string[];
}

export interface SpecialObjectPolicy {
  friendlyRescue: boolean;
  satellite: boolean;
  energyCapsule: boolean;
  empMine: boolean;
}

export interface StoryStageContract {
  id: StoryStageId;
  chapterId: StoryChapterId;
  stageNumber: number;
  objective: StoryStageObjective;
  objectiveParams: StoryObjectiveParams;
  contentProfileId: ContentProfileId;
  seed: number;
  labelKey: string;
  tutorialKey: string;
}

export interface StoryObjectiveParams {
  killsTarget?: number;
  comboTarget?: number;
  lastSaveTarget?: number;
  protectTarget?: number;
  bossKillTarget?: number;
}

export interface StoryChapterContract {
  id: StoryChapterId;
  titleKey: string;
  stageIds: StoryStageId[];
}

export interface DailyModifierContract {
  id: DailyModifierId;
  labelKey: string;
  enabledSkills: SkillId[];
  contentProfileId: ContentProfileId;
  specialObjectPolicy: SpecialObjectPolicy;
  scoringHint: "survival" | "rescue" | "lastSave" | "boss" | "master";
}

export interface ModeContentProfile {
  id: ContentProfileId;
  spawnIntervalMultiplier: number;
  specialObjectMaxActive: number;
  enabledSkills?: SkillId[];
  specialObjectPolicy?: SpecialObjectPolicy;
  bossEveryMs?: number;
  bossEnemyType?: string;
  enemyWeightBias?: Record<string, number>;
}

export interface FreeDefensePresetContract {
  id: FreeDefensePresetId;
  labelKey: string;
  descriptionKey: string;
}

export interface RunRules {
  durationLimitMs: number | null;
  waveDurationMs: number;
  objective: ObjectiveType;
  revivePolicy: RevivePolicy;
  rankingEligible: boolean;
  scoringPriority: Array<"survivalMs" | "score" | "bossKills" | "stageStars">;
  enabledSkills: SkillId[];
  bossPolicy: BossPolicy;
  specialObjectPolicy: SpecialObjectPolicy;
  allowDevQaHarness: boolean;
  storyStages?: StoryStageContract[];
  storyChapters?: StoryChapterContract[];
  dailyModifiers?: DailyModifierContract[];
  activeDailyModifierId?: DailyModifierId;
  freeDefensePreset?: FreeDefensePresetId;
  activeContentProfileId?: ContentProfileId;
}

export interface RunConfig {
  modeId: ModeId;
  difficulty: DifficultyId;
  seed: number;
  seedPolicy: SeedPolicy;
  rules: RunRules;
  configVersion: string;
}

export interface ModeResult {
  modeId: ModeId;
  difficulty: DifficultyId;
  endReason: RunEndReason;
  survivalMs: number;
  score: number;
  kills: number;
  bossKills?: number;
  defeatedBossIds?: string[];
  lastSaveCount?: number;
  protectedCount?: number;
  failedProtectCount?: number;
  activeStoryStageId?: StoryStageContract["id"];
  activeDailyModifierId?: DailyModifierId;
  objectiveOutcome?: "cleared" | "failed" | "survived";
  rankingSubmissionState?: "notEligible" | "pending" | "submitted" | "localOnly" | "failed";
  maxCombo: number;
  remainingEnergy: number;
  rankingEligible: boolean;
  retryDestination: "sameRun" | "modeSelect" | "home";
}

export interface RunLaunchOptions {
  difficulty?: DifficultyId;
  freeDefensePreset?: FreeDefensePresetId;
  practiceBossId?: BossId;
  storyStageId?: StoryStageId;
}

export type ConfigLayer = "base" | "difficulty" | "mode" | "dailyModifier" | "serverRanked";

export const CONFIG_LAYER_ORDER: readonly ConfigLayer[] = ["base", "difficulty", "mode", "dailyModifier", "serverRanked"];

const DEFAULT_BOSS_POLICY: BossPolicy = {
  enabled: true,
  bossEveryMs: 60000,
  bossEnemyType: "eclipse_core",
};

const DEFAULT_SPECIAL_OBJECT_POLICY: SpecialObjectPolicy = {
  friendlyRescue: false,
  satellite: false,
  energyCapsule: false,
  empMine: false,
};

const RELEASE_SKILLS: SkillId[] = ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield", "nova_pulse"];

export const CONTENT_PROFILES: Record<ContentProfileId, ModeContentProfile> = {
  starter: {
    id: "starter",
    spawnIntervalMultiplier: 1.08,
    specialObjectMaxActive: 1,
    enabledSkills: ["solar_lance", "orbital_cut", "gravity_slow"],
    specialObjectPolicy: { friendlyRescue: false, satellite: false, energyCapsule: true, empMine: false },
    enemyWeightBias: { shard_meteor: 1.4, small_meteor: 1.25, fast_comet: 0.55, directional_comet: 0 },
  },
  lastSave: {
    id: "lastSave",
    spawnIntervalMultiplier: 0.96,
    specialObjectMaxActive: 1,
    enabledSkills: ["solar_lance", "gravity_slow", "delta_shield"],
    specialObjectPolicy: { friendlyRescue: false, satellite: false, energyCapsule: false, empMine: true },
    enemyWeightBias: { fast_comet: 1.35, small_meteor: 0.8, heavy_asteroid: 0.5 },
  },
  rescue: {
    id: "rescue",
    spawnIntervalMultiplier: 1.02,
    specialObjectMaxActive: 4,
    enabledSkills: ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield"],
    specialObjectPolicy: { friendlyRescue: true, satellite: true, energyCapsule: true, empMine: false },
    enemyWeightBias: { fast_comet: 0.65, directional_comet: 0.4, shield_rock: 0.5 },
  },
  combo: {
    id: "combo",
    spawnIntervalMultiplier: 0.9,
    specialObjectMaxActive: 2,
    enabledSkills: ["solar_lance", "orbital_cut", "gravity_slow", "nova_pulse"],
    specialObjectPolicy: { friendlyRescue: false, satellite: false, energyCapsule: true, empMine: true },
    enemyWeightBias: { small_meteor: 1.3, fast_comet: 1.2, heavy_asteroid: 0.45 },
  },
  boss: {
    id: "boss",
    spawnIntervalMultiplier: 0.94,
    specialObjectMaxActive: 1,
    enabledSkills: RELEASE_SKILLS,
    specialObjectPolicy: { friendlyRescue: false, satellite: false, energyCapsule: true, empMine: true },
    bossEveryMs: 30000,
    bossEnemyType: "ringed_destroyer",
    enemyWeightBias: { shard_meteor: 0.75, fast_comet: 1.15, heavy_asteroid: 0.65 },
  },
  elemental: {
    id: "elemental",
    spawnIntervalMultiplier: 0.84,
    specialObjectMaxActive: 2,
    enabledSkills: RELEASE_SKILLS,
    specialObjectPolicy: { friendlyRescue: false, satellite: true, energyCapsule: true, empMine: true },
    enemyWeightBias: { fire_meteor: 2.2, ice_comet: 2.2, crystal_meteor: 1.4, shield_rock: 1.2 },
  },
  precision: {
    id: "precision",
    spawnIntervalMultiplier: 0.88,
    specialObjectMaxActive: 1,
    enabledSkills: ["solar_lance", "orbital_cut", "gravity_slow", "nova_pulse"],
    specialObjectPolicy: { friendlyRescue: false, satellite: false, energyCapsule: true, empMine: true },
    enemyWeightBias: { directional_comet: 2.6, electric_meteor: 1.8, fast_comet: 1.15, shard_meteor: 0.45 },
  },
  gravity: {
    id: "gravity",
    spawnIntervalMultiplier: 0.82,
    specialObjectMaxActive: 1,
    enabledSkills: ["solar_lance", "gravity_slow", "delta_shield", "nova_pulse"],
    specialObjectPolicy: { friendlyRescue: false, satellite: true, energyCapsule: true, empMine: true },
    bossEveryMs: 36000,
    bossEnemyType: "dark_planet",
    enemyWeightBias: { graviton_core: 3, dark_meteor: 1.8, armored_fragment: 1.4, shard_meteor: 0.35 },
  },
  finale: {
    id: "finale",
    spawnIntervalMultiplier: 0.72,
    specialObjectMaxActive: 1,
    enabledSkills: RELEASE_SKILLS,
    specialObjectPolicy: { friendlyRescue: true, satellite: true, energyCapsule: true, empMine: true },
    bossEveryMs: 26000,
    bossEnemyType: "dark_planet",
    enemyWeightBias: { dark_meteor: 2.5, armored_fragment: 2, graviton_core: 1.8, directional_comet: 1.5, shard_meteor: 0.2 },
  },
};

const STORY_OBJECTIVE_PLAN: StoryStageObjective[] = [
  "basicSlash",
  "lastSave",
  "protectObjects",
  "comboMaster",
  "bossThreat",
  "basicSlash",
  "protectObjects",
  "comboMaster",
  "lastSave",
  "basicSlash",
  "protectObjects",
  "bossThreat",
  "comboMaster",
  "lastSave",
  "basicSlash",
  "bossThreat",
  "protectObjects",
  "comboMaster",
  "lastSave",
  "bossThreat",
  "bossThreat",
  "comboMaster",
  "protectObjects",
  "lastSave",
  "comboMaster",
  "bossThreat",
  "lastSave",
  "protectObjects",
  "protectObjects",
  "comboMaster",
  "bossThreat",
  "bossThreat",
];

export const STORY_STAGE_PLAN: StoryStageContract[] = STORY_OBJECTIVE_PLAN.map((objective, index) => {
  const stageIndex = index + 1;
  const chapterIndex = Math.floor(index / 4) + 1;
  return {
    id: `story-${stageIndex}`,
    chapterId: `chapter-${chapterIndex}`,
    stageNumber: (index % 4) + 1,
    objective,
    objectiveParams: storyObjectiveParams(objective, index),
    contentProfileId: storyContentProfileId(objective, index),
    seed: 1000 + stageIndex,
    labelKey: `story.stage${stageIndex}`,
    tutorialKey: `story.tutorial.${stageIndex}`,
  };
});

export const STORY_CHAPTERS: StoryChapterContract[] = Array.from({ length: 8 }, (_, index) => {
  const chapterIndex = index + 1;
  return {
    id: `chapter-${chapterIndex}`,
    titleKey: `story.chapter${chapterIndex}`,
    stageIds: STORY_STAGE_PLAN.slice(index * 4, index * 4 + 4).map((stage) => stage.id),
  };
});

export const STORY_STAGE_VERTICAL_SLICE: StoryStageContract[] = STORY_STAGE_PLAN;

export const DAILY_MODIFIERS: DailyModifierContract[] = [
  {
    id: "noSkill",
    labelKey: "daily.noSkill",
    enabledSkills: [],
    contentProfileId: "starter",
    specialObjectPolicy: { friendlyRescue: false, satellite: false, energyCapsule: true, empMine: true },
    scoringHint: "survival",
  },
  {
    id: "rescueDay",
    labelKey: "daily.rescueDay",
    enabledSkills: RELEASE_SKILLS,
    contentProfileId: "rescue",
    specialObjectPolicy: { friendlyRescue: true, satellite: true, energyCapsule: true, empMine: false },
    scoringHint: "rescue",
  },
  {
    id: "lastSaveDay",
    labelKey: "daily.lastSaveDay",
    enabledSkills: RELEASE_SKILLS,
    contentProfileId: "lastSave",
    specialObjectPolicy: { friendlyRescue: false, satellite: false, energyCapsule: false, empMine: true },
    scoringHint: "lastSave",
  },
  {
    id: "bossAlert",
    labelKey: "daily.bossAlert",
    enabledSkills: RELEASE_SKILLS,
    contentProfileId: "boss",
    specialObjectPolicy: { friendlyRescue: false, satellite: false, energyCapsule: true, empMine: true },
    scoringHint: "boss",
  },
  {
    id: "masterTrial",
    labelKey: "daily.masterTrial",
    enabledSkills: RELEASE_SKILLS,
    contentProfileId: "finale",
    specialObjectPolicy: { friendlyRescue: true, satellite: true, energyCapsule: true, empMine: true },
    scoringHint: "master",
  },
];

export const FREE_DEFENSE_PRESETS: FreeDefensePresetContract[] = [
  { id: "standard", labelKey: "freeDefense.preset.standard", descriptionKey: "freeDefense.preset.standard.description" },
  { id: "skillPractice", labelKey: "freeDefense.preset.skillPractice", descriptionKey: "freeDefense.preset.skillPractice.description" },
  { id: "bossPractice", labelKey: "freeDefense.preset.bossPractice", descriptionKey: "freeDefense.preset.bossPractice.description" },
];

export const MODE_DEFINITIONS: Record<ModeId, ModeDefinition> = {
  story: {
    id: "story",
    labelKey: "mode.story.title",
    descriptionKey: "mode.story.description",
    available: true,
    unlockState: "unlocked",
    defaultDifficulty: "rookie",
    themeToken: "blue",
  },
  freeDefense: {
    id: "freeDefense",
    labelKey: "mode.freeDefense.title",
    descriptionKey: "mode.freeDefense.description",
    available: true,
    unlockState: "unlocked",
    defaultDifficulty: "rookie",
    themeToken: "cyan",
  },
  ranked: {
    id: "ranked",
    labelKey: "mode.ranked.title",
    descriptionKey: "mode.ranked.description",
    available: true,
    unlockState: "unlocked",
    defaultDifficulty: "rookie",
    themeToken: "gold",
  },
  bossRush: {
    id: "bossRush",
    labelKey: "mode.bossRush.title",
    descriptionKey: "mode.bossRush.description",
    available: true,
    unlockState: "unlocked",
    defaultDifficulty: "defender",
    themeToken: "red",
  },
  blitz60: {
    id: "blitz60",
    labelKey: "mode.blitz60.title",
    descriptionKey: "mode.blitz60.description",
    available: true,
    unlockState: "unlocked",
    defaultDifficulty: "rookie",
    themeToken: "violet",
  },
  daily: {
    id: "daily",
    labelKey: "mode.daily.title",
    descriptionKey: "mode.daily.description",
    available: true,
    unlockState: "unlocked",
    defaultDifficulty: "defender",
    themeToken: "green",
  },
};

export function modeDefinitions(): ModeDefinition[] {
  return MODE_IDS.map((id) => MODE_DEFINITIONS[id]);
}

export function isModeId(value: string): value is ModeId {
  return (MODE_IDS as readonly string[]).includes(value);
}

export function defaultRunRules(modeId: ModeId, seed = defaultSeedForMode(modeId)): RunRules {
  const base: RunRules = {
    durationLimitMs: null,
    waveDurationMs: 7000,
    objective: "survival",
    revivePolicy: "adRevive",
    rankingEligible: false,
    scoringPriority: ["survivalMs", "score"],
    enabledSkills: RELEASE_SKILLS,
    bossPolicy: { ...DEFAULT_BOSS_POLICY },
    specialObjectPolicy: { ...DEFAULT_SPECIAL_OBJECT_POLICY },
    allowDevQaHarness: true,
  };

  if (modeId === "story") {
    return {
      ...base,
      objective: "stageMission",
      revivePolicy: "storyRetry",
      specialObjectPolicy: { friendlyRescue: true, satellite: false, energyCapsule: true, empMine: false },
      storyStages: STORY_STAGE_PLAN,
      storyChapters: STORY_CHAPTERS,
    };
  }

  if (modeId === "ranked") {
    return {
      ...base,
      revivePolicy: "none",
      rankingEligible: false,
      allowDevQaHarness: false,
      bossPolicy: { ...DEFAULT_BOSS_POLICY, bossEveryMs: 75000 },
      specialObjectPolicy: { friendlyRescue: false, satellite: false, energyCapsule: false, empMine: false },
      enabledSkills: RELEASE_SKILLS,
    };
  }

  if (modeId === "bossRush") {
    return {
      ...base,
      objective: "bossKillCount",
      revivePolicy: "none",
      enabledSkills: RELEASE_SKILLS,
      bossPolicy: {
        ...DEFAULT_BOSS_POLICY,
        bossEveryMs: 0,
        sequence: ["ringed_destroyer", "eclipse_core", "lava_titan", "ice_colossus", "dark_planet"],
      },
    };
  }

  if (modeId === "blitz60") {
    return {
      ...base,
      durationLimitMs: 60000,
      objective: "score",
      revivePolicy: "none",
      scoringPriority: ["score", "survivalMs"],
      enabledSkills: RELEASE_SKILLS,
      bossPolicy: { ...DEFAULT_BOSS_POLICY, bossEveryMs: 45000 },
    };
  }

  if (modeId === "daily") {
    const activeDailyModifierId = dailyModifierForSeed(seed).id;
    const modifier = dailyModifierById(activeDailyModifierId);
    return {
      ...base,
      objective: "dailyModifier",
      revivePolicy: "none",
      enabledSkills: modifier.enabledSkills,
      specialObjectPolicy: modifier.specialObjectPolicy,
      dailyModifiers: DAILY_MODIFIERS,
      activeDailyModifierId,
    };
  }

  return base;
}

export interface BuildRunConfigOptions {
  difficulty?: DifficultyId;
  seed?: number;
  configVersion?: string;
  freeDefensePreset?: FreeDefensePresetId;
  practiceBossId?: BossId;
  storyStageId?: StoryStageId;
}

export function seedPolicyForMode(modeId: ModeId): SeedPolicy {
  if (modeId === "story") return "fixedPattern";
  if (modeId === "ranked") return "serverAssigned";
  if (modeId === "blitz60") return "dailyFixed";
  if (modeId === "daily") return "dailyFixed";
  return "random";
}

export function buildRunConfig(modeId: ModeId, options: BuildRunConfigOptions = {}): RunConfig {
  const definition = MODE_DEFINITIONS[modeId];
  const configVersion = options.configVersion ?? "local";
  const requestedStoryStage = modeId === "story" && options.storyStageId ? storyStageById(options.storyStageId) : undefined;
  const storyStage = modeId === "story" ? (requestedStoryStage ?? storyStageBySeed(options.seed ?? defaultSeedForMode(modeId))) : undefined;
  const seed = storyStage?.seed ?? options.seed ?? defaultSeedForMode(modeId);
  const rules = defaultRunRules(modeId, seed);
  if (storyStage) {
    applyContentProfile(rules, storyStage.contentProfileId);
  }
  if (modeId === "freeDefense") {
    applyFreeDefensePreset(rules, options.freeDefensePreset ?? "standard", options.practiceBossId);
  }
  if (modeId === "daily" && rules.activeDailyModifierId) {
    const modifier = dailyModifierById(rules.activeDailyModifierId);
    applyContentProfile(rules, modifier.contentProfileId, { keepEnabledSkills: true });
  }
  if (modeId === "ranked") {
    rules.rankingEligible = configVersion.startsWith("server-ranked-");
  }
  return {
    modeId,
    difficulty: options.difficulty ?? definition.defaultDifficulty,
    seed,
    seedPolicy: seedPolicyForMode(modeId),
    rules,
    configVersion,
  };
}

export function dailyModifierForSeed(seed: number): DailyModifierContract {
  const day = Math.max(0, Math.floor(seed) % 100);
  return DAILY_MODIFIERS[day % DAILY_MODIFIERS.length] ?? DAILY_MODIFIERS[0]!;
}

export function dailyModifierById(id: DailyModifierId): DailyModifierContract {
  return DAILY_MODIFIERS.find((modifier) => modifier.id === id) ?? DAILY_MODIFIERS[0]!;
}

export function freeDefensePresetDefinitions(): FreeDefensePresetContract[] {
  return FREE_DEFENSE_PRESETS;
}

export function freeDefensePresetById(id: FreeDefensePresetId): FreeDefensePresetContract {
  return FREE_DEFENSE_PRESETS.find((preset) => preset.id === id) ?? FREE_DEFENSE_PRESETS[0]!;
}

export function storyStageById(id: StoryStageId): StoryStageContract | undefined {
  return STORY_STAGE_PLAN.find((stage) => stage.id === id);
}

export function contentProfileById(id: ContentProfileId): ModeContentProfile {
  return CONTENT_PROFILES[id];
}

export function storyStageBySeed(seed: number): StoryStageContract | undefined {
  return STORY_STAGE_PLAN.find((stage) => stage.seed === seed);
}

export function storyStageNumber(stageId: StoryStageId): number | null {
  const match = /^story-(\d+)$/.exec(stageId);
  if (!match) return null;
  return Number.parseInt(match[1]!, 10);
}

export function defaultSeedForMode(modeId: ModeId, now = new Date()): number {
  if (modeId === "ranked") return 0;
  if (modeId === "story") return 1001;
  if (modeId === "daily" || modeId === "blitz60") {
    return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  }
  return Date.now() >>> 0;
}

function storyObjectiveParams(objective: StoryStageObjective, index: number): StoryObjectiveParams {
  const chapterBand = Math.floor(index / 8);
  if (objective === "basicSlash") return { killsTarget: 3 + chapterBand, comboTarget: 2 + chapterBand };
  if (objective === "lastSave") return { lastSaveTarget: 1 };
  if (objective === "protectObjects") return { protectTarget: 2 + Math.min(1, chapterBand) };
  if (objective === "comboMaster") return { comboTarget: 6 + chapterBand };
  if (objective === "bossThreat") return { bossKillTarget: 1 };
  return {};
}

function storyContentProfileId(objective: StoryStageObjective, index: number): ContentProfileId {
  const chapterIndex = Math.floor(index / 4) + 1;
  if (chapterIndex === 4) return "elemental";
  if (chapterIndex === 5) return "precision";
  if (chapterIndex === 7) return "gravity";
  if (chapterIndex === 8) return "finale";
  if (objective === "lastSave") return "lastSave";
  if (objective === "protectObjects") return "rescue";
  if (objective === "comboMaster") return "combo";
  if (objective === "bossThreat") return "boss";
  return "starter";
}

function applyContentProfile(rules: RunRules, profileId: ContentProfileId, options: { keepEnabledSkills?: boolean } = {}): void {
  const profile = contentProfileById(profileId);
  rules.activeContentProfileId = profile.id;
  if (profile.enabledSkills && !options.keepEnabledSkills) {
    rules.enabledSkills = [...profile.enabledSkills];
  }
  if (profile.specialObjectPolicy) {
    rules.specialObjectPolicy = { ...profile.specialObjectPolicy };
  }
  if (profile.bossEveryMs != null || profile.bossEnemyType) {
    rules.bossPolicy = {
      ...rules.bossPolicy,
      bossEveryMs: profile.bossEveryMs ?? rules.bossPolicy.bossEveryMs,
      bossEnemyType: profile.bossEnemyType ?? rules.bossPolicy.bossEnemyType,
    };
  }
}

function applyFreeDefensePreset(rules: RunRules, preset: FreeDefensePresetId, practiceBossId?: BossId): void {
  rules.freeDefensePreset = preset;
  rules.rankingEligible = false;
  if (preset === "skillPractice") {
    rules.bossPolicy = { ...rules.bossPolicy, bossEveryMs: 90000, bossEnemyType: "eclipse_core" };
    rules.specialObjectPolicy = { friendlyRescue: false, satellite: false, energyCapsule: true, empMine: false };
    return;
  }
  if (preset === "bossPractice") {
    const bossEnemyType = practiceBossId && (BOSS_IDS as readonly string[]).includes(practiceBossId) ? practiceBossId : "ringed_destroyer";
    rules.bossPolicy = { ...rules.bossPolicy, bossEveryMs: 30000, bossEnemyType, sequence: [bossEnemyType] };
    rules.specialObjectPolicy = { friendlyRescue: false, satellite: false, energyCapsule: true, empMine: true };
    return;
  }
  rules.bossPolicy = { ...rules.bossPolicy, bossEveryMs: 60000, bossEnemyType: "eclipse_core" };
}

export type RunConfigValidation = { ok: true } | { ok: false; reason: "invalid_duration" | "invalid_boss_interval" | "missing_skill" };

export function validateRunConfig(config: RunConfig): RunConfigValidation {
  if (config.rules.durationLimitMs !== null && config.rules.durationLimitMs <= 0) {
    return { ok: false, reason: "invalid_duration" };
  }
  if (config.rules.bossPolicy.enabled && config.rules.bossPolicy.bossEveryMs < 0) {
    return { ok: false, reason: "invalid_boss_interval" };
  }
  if (config.modeId !== "bossRush" && config.rules.bossPolicy.enabled && config.rules.bossPolicy.bossEveryMs <= 0) {
    return { ok: false, reason: "invalid_boss_interval" };
  }
  if (config.rules.enabledSkills.length === 0 && !(config.modeId === "daily" && config.rules.activeDailyModifierId === "noSkill")) {
    return { ok: false, reason: "missing_skill" };
  }
  return { ok: true };
}
