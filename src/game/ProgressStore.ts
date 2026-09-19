import { MODE_DEFINITIONS, type DailyModifierId, type ModeId, type ModeResult, type StoryStageContract } from "./ModeConfig";
import type { IPlatformAdapter } from "../platform/PlatformAdapter";
import { defaultCollection, defaultUnlocks, type CollectionState, type ProgressUnlocks } from "./UnlockSystem";
import { getLocale, t } from "../i18n";
import { claimWeeklyReward, reduceProgressAfterRun, type ProgressRecordOutcome, type WeeklyRewardClaimOutcome } from "./progression/ProgressReducer";
import { migrateProgressSnapshot } from "./progression/ProgressMigration";
import { CURRENT_PROGRESS_VERSION } from "./progression/ProgressSchema";
import type { FirstSessionState } from "./onboarding/FirstSessionState";
import type { StageMedal } from "./retention/StageMedalRules";
import type { DailyRetentionState } from "./retention/DailyRetentionRules";
import { RemoteConfig } from "./RemoteConfig";
import type { RetentionConfig } from "./retention/RetentionConfig";

export interface ModeProgressRecord {
  plays: number;
  bestScore: number;
  bestSurvivalMs: number;
  bestCombo: number;
  bestKills: number;
  bestBossKills: number;
}

export interface ProgressProfile {
  totalRuns: number;
  totalKills: number;
  totalBossKills: number;
  totalScore: number;
}

export interface StoryProgressState {
  clearedStageIds: Array<StoryStageContract["id"]>;
}

export interface DailyProgressState {
  completedModifierIds: DailyModifierId[];
  clearCount: number;
}

export interface FreeDefenseProgressState {
  dailyPlayDate: string | null;
  dailyPlayCount: number;
}

export interface RetentionProgressState {
  stageMedals: Record<string, StageMedal>;
  daily: DailyRetentionState;
  claimedWeeklyKeys: string[];
}

export interface ProgressSnapshot {
  version: typeof CURRENT_PROGRESS_VERSION;
  profile: ProgressProfile;
  records: Partial<Record<ModeId, ModeProgressRecord>>;
  unlocks: ProgressUnlocks;
  collection: CollectionState;
  story: StoryProgressState;
  daily: DailyProgressState;
  freeDefense: FreeDefenseProgressState;
  onboarding: FirstSessionState;
  retention: RetentionProgressState;
}

export interface ModeProgressSummary {
  modeId: ModeId;
  unlocked: boolean;
  comingSoon: boolean;
  plays: number;
  bestScore: number;
  bestSurvivalMs: number;
  bestCombo: number;
  bestKills: number;
  bestBossKills: number;
  bestLabel: string;
  progressLabel: string;
}

const STORAGE_KEY = "orbitslash.progress.v1";
export const FREE_DEFENSE_DAILY_PLAY_LIMIT = 5;

export class ProgressStore {
  constructor(
    private readonly platform: Pick<IPlatformAdapter, "storageGet" | "storageSet">,
    private readonly clock: () => Date = () => new Date(),
    private readonly retentionConfig: () => RetentionConfig = () => RemoteConfig.getRetention(),
  ) {}

  async load(): Promise<ProgressSnapshot> {
    const raw = await this.platform.storageGet(STORAGE_KEY);
    if (!raw) return defaultProgressSnapshot();
    try {
      const parsed = JSON.parse(raw) as Partial<ProgressSnapshot>;
      return normalizeSnapshot(parsed);
    } catch {
      return defaultProgressSnapshot();
    }
  }

  async recordResult(result: ModeResult): Promise<ProgressRecordOutcome> {
    const outcome = reduceProgressAfterRun(await this.load(), result, this.clock(), this.retentionConfig());
    await this.platform.storageSet(STORAGE_KEY, JSON.stringify(outcome.snapshot));
    return outcome;
  }

  async saveOnboarding(onboarding: FirstSessionState): Promise<ProgressSnapshot> {
    const snapshot = await this.load();
    const next = { ...snapshot, onboarding };
    await this.platform.storageSet(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  async claimWeeklyReward(): Promise<WeeklyRewardClaimOutcome> {
    const outcome = claimWeeklyReward(await this.load(), this.clock(), this.retentionConfig().weekly);
    if (outcome.claimed) await this.platform.storageSet(STORAGE_KEY, JSON.stringify(outcome.snapshot));
    return outcome;
  }

  /** Used only after a deterministic local/cloud merge has produced a full snapshot. */
  async replace(snapshot: ProgressSnapshot): Promise<void> {
    await this.platform.storageSet(STORAGE_KEY, JSON.stringify(normalizeSnapshot(snapshot)));
  }
}

function defaultProgressSnapshot(): ProgressSnapshot {
  return {
    version: CURRENT_PROGRESS_VERSION,
    profile: {
      totalRuns: 0,
      totalKills: 0,
      totalBossKills: 0,
      totalScore: 0,
    },
    records: {},
    unlocks: defaultUnlocks(),
    collection: defaultCollection(),
    story: {
      clearedStageIds: [],
    },
    daily: {
      completedModifierIds: [],
      clearCount: 0,
    },
    freeDefense: {
      dailyPlayDate: null,
      dailyPlayCount: 0,
    },
    onboarding: migrateProgressSnapshot({}).onboarding,
    retention: {
      stageMedals: {},
      daily: { firstClearAwards: [], clearDayKeys: [] },
      claimedWeeklyKeys: [],
    },
  };
}

function normalizeSnapshot(parsed: Partial<ProgressSnapshot>): ProgressSnapshot {
  const base = defaultProgressSnapshot();
  const migrated = migrateProgressSnapshot(parsed as Record<string, unknown>);
  const records: Partial<Record<ModeId, ModeProgressRecord>> = {};
  for (const [modeId, record] of Object.entries(parsed.records ?? {}) as Array<[ModeId, Partial<ModeProgressRecord>]>) {
    records[modeId] = {
      plays: record.plays ?? 0,
      bestScore: record.bestScore ?? 0,
      bestSurvivalMs: record.bestSurvivalMs ?? 0,
      bestCombo: record.bestCombo ?? 0,
      bestKills: record.bestKills ?? 0,
      bestBossKills: record.bestBossKills ?? 0,
    };
  }
  return {
    version: CURRENT_PROGRESS_VERSION,
    profile: { ...base.profile, ...(parsed.profile ?? {}) },
    records,
    unlocks: {
      modes: mergeUnique(base.unlocks.modes, parsed.unlocks?.modes),
      skills: mergeUnique(base.unlocks.skills, parsed.unlocks?.skills),
      bosses: mergeUnique(base.unlocks.bosses, parsed.unlocks?.bosses),
      storyStages: mergeUnique(base.unlocks.storyStages, parsed.unlocks?.storyStages),
    },
    collection: {
      bossCodex: mergeUnique(base.collection.bossCodex, parsed.collection?.bossCodex),
      specialObjectCodex: mergeUnique(base.collection.specialObjectCodex, parsed.collection?.specialObjectCodex),
      titles: mergeUnique(base.collection.titles, parsed.collection?.titles),
    },
    story: {
      clearedStageIds: mergeUnique(base.story.clearedStageIds, parsed.story?.clearedStageIds),
    },
    daily: {
      completedModifierIds: mergeUnique(base.daily.completedModifierIds, parsed.daily?.completedModifierIds),
      clearCount: parsed.daily?.clearCount ?? 0,
    },
    freeDefense: normalizeFreeDefenseProgress(parsed.freeDefense),
    onboarding: migrated.onboarding,
    retention: normalizeRetentionProgress(parsed.retention),
  };
}

export function canStartFreeDefenseRun(snapshot: ProgressSnapshot, now = new Date()): boolean {
  const today = freeDefenseDateKey(now);
  const count = snapshot.freeDefense.dailyPlayDate === today ? snapshot.freeDefense.dailyPlayCount : 0;
  return count < FREE_DEFENSE_DAILY_PLAY_LIMIT;
}

export function freeDefenseDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeFreeDefenseProgress(parsed: Partial<FreeDefenseProgressState> | undefined): FreeDefenseProgressState {
  return {
    dailyPlayDate: parsed?.dailyPlayDate ?? null,
    dailyPlayCount: parsed?.dailyPlayCount ?? 0,
  };
}

function normalizeRetentionProgress(parsed: Partial<RetentionProgressState> | undefined): RetentionProgressState {
  const medals: Record<string, StageMedal> = {};
  for (const [stageId, medal] of Object.entries(parsed?.stageMedals ?? {})) {
    if (medal === "bronze" || medal === "silver" || medal === "gold") medals[stageId] = medal;
  }
  return {
    stageMedals: medals,
    daily: {
      firstClearAwards: mergeUnique([], parsed?.daily?.firstClearAwards),
      clearDayKeys: mergeUnique([], parsed?.daily?.clearDayKeys),
    },
    claimedWeeklyKeys: mergeUnique([], parsed?.claimedWeeklyKeys),
  };
}

export function buildModeProgressSummary(snapshot: ProgressSnapshot, modeId: ModeId): ModeProgressSummary {
  const definition = MODE_DEFINITIONS[modeId];
  const record = snapshot.records[modeId] ?? {
    plays: 0,
    bestScore: 0,
    bestSurvivalMs: 0,
    bestCombo: 0,
    bestKills: 0,
    bestBossKills: 0,
  };
  const comingSoon = definition.unlockState === "comingSoon" || !definition.available;
  const unlocked = !comingSoon && snapshot.unlocks.modes.includes(modeId);
  return {
    modeId,
    unlocked,
    comingSoon,
    plays: record.plays,
    bestScore: record.bestScore,
    bestSurvivalMs: record.bestSurvivalMs,
    bestCombo: record.bestCombo,
    bestKills: record.bestKills,
    bestBossKills: record.bestBossKills,
    bestLabel: record.bestScore > 0 ? t("progress.bestScore", { score: formatNumber(record.bestScore) }) : t("progress.noRecord"),
    progressLabel: progressLabelFor(modeId, record),
  };
}

function progressLabelFor(modeId: ModeId, record: ModeProgressRecord): string {
  if (modeId === "bossRush") {
    if (record.bestBossKills > 0) return t("progress.bestBoss", { count: formatNumber(record.bestBossKills) });
    if (record.plays > 0) return t("progress.noBossKill", { plays: formatNumber(record.plays) });
    return t("progress.bossReady");
  }
  if (record.plays > 0) return t("progress.plays", { count: formatNumber(record.plays) });
  if (modeId === "ranked") return t("progress.rankedPending");
  if (modeId === "daily") return t("progress.dailyWaiting");
  return t("progress.firstPlay");
}

function formatNumber(value: number): string {
  return value.toLocaleString(getLocale() === "ko" ? "ko-KR" : "en-US");
}

function mergeUnique<T>(base: T[], extra: T[] | undefined): T[] {
  const out = [...base];
  for (const item of extra ?? []) {
    if (!out.includes(item)) out.push(item);
  }
  return out;
}
