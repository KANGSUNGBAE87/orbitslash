import { MODE_DEFINITIONS, STORY_STAGE_PLAN, type DailyModifierId, type ModeId, type ModeResult, type StoryStageContract } from "./ModeConfig";
import type { IPlatformAdapter } from "../platform/PlatformAdapter";
import {
  applyUnlockRules,
  defaultCollection,
  defaultUnlocks,
  type CollectionState,
  type ProgressUnlocks,
} from "./UnlockSystem";
import { getLocale, t } from "../i18n";

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

export interface ProgressSnapshot {
  version: 2;
  profile: ProgressProfile;
  records: Partial<Record<ModeId, ModeProgressRecord>>;
  unlocks: ProgressUnlocks;
  collection: CollectionState;
  story: StoryProgressState;
  daily: DailyProgressState;
  freeDefense: FreeDefenseProgressState;
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
  constructor(private readonly platform: Pick<IPlatformAdapter, "storageGet" | "storageSet">) {}

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

  async recordResult(result: ModeResult): Promise<ProgressSnapshot> {
    const snapshot = await this.load();
    const prev = snapshot.records[result.modeId] ?? {
      plays: 0,
      bestScore: 0,
      bestSurvivalMs: 0,
      bestCombo: 0,
      bestKills: 0,
      bestBossKills: 0,
    };
    const bossKills = result.bossKills ?? 0;
    snapshot.records[result.modeId] = {
      plays: prev.plays + 1,
      bestScore: Math.max(prev.bestScore, result.score),
      bestSurvivalMs: Math.max(prev.bestSurvivalMs, result.survivalMs),
      bestCombo: Math.max(prev.bestCombo, result.maxCombo),
      bestKills: Math.max(prev.bestKills, result.kills),
      bestBossKills: Math.max(prev.bestBossKills, bossKills),
    };
    snapshot.profile.totalRuns += 1;
    snapshot.profile.totalKills += result.kills;
    snapshot.profile.totalBossKills += bossKills;
    snapshot.profile.totalScore += result.score;
    if (result.modeId === "freeDefense") {
      recordFreeDefenseDailyPlay(snapshot.freeDefense);
    }
    if (result.modeId === "story" && result.objectiveOutcome === "cleared" && result.activeStoryStageId) {
      addUnique(snapshot.story.clearedStageIds, result.activeStoryStageId);
      const currentStageNumber = storyStageNumber(result.activeStoryStageId);
      if (currentStageNumber != null) {
        addUnique(snapshot.unlocks.storyStages, currentStageNumber);
        if (currentStageNumber < STORY_STAGE_PLAN.length) addUnique(snapshot.unlocks.storyStages, currentStageNumber + 1);
      }
    }
    if (result.modeId === "daily" && result.objectiveOutcome === "cleared") {
      snapshot.daily.clearCount += 1;
      if (result.activeDailyModifierId) addUnique(snapshot.daily.completedModifierIds, result.activeDailyModifierId);
    }
    applyUnlockRules({
      result,
      unlocks: snapshot.unlocks,
      collection: snapshot.collection,
      totalKills: snapshot.profile.totalKills,
      totalBossKills: snapshot.profile.totalBossKills,
    });
    await this.platform.storageSet(STORAGE_KEY, JSON.stringify(snapshot));
    return snapshot;
  }
}

function defaultProgressSnapshot(): ProgressSnapshot {
  return {
    version: 2,
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
  };
}

function normalizeSnapshot(parsed: Partial<ProgressSnapshot>): ProgressSnapshot {
  const base = defaultProgressSnapshot();
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
    version: 2,
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

function recordFreeDefenseDailyPlay(progress: FreeDefenseProgressState, now = new Date()): void {
  const today = freeDefenseDateKey(now);
  if (progress.dailyPlayDate !== today) {
    progress.dailyPlayDate = today;
    progress.dailyPlayCount = 0;
  }
  progress.dailyPlayCount += 1;
}

function normalizeFreeDefenseProgress(parsed: Partial<FreeDefenseProgressState> | undefined): FreeDefenseProgressState {
  return {
    dailyPlayDate: parsed?.dailyPlayDate ?? null,
    dailyPlayCount: parsed?.dailyPlayCount ?? 0,
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

function addUnique<T>(items: T[], item: T): void {
  if (!items.includes(item)) items.push(item);
}

function storyStageNumber(stageId: StoryStageContract["id"]): number | null {
  const match = /^story-(\d+)$/.exec(stageId);
  if (!match) return null;
  return Number.parseInt(match[1]!, 10);
}
