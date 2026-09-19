import { STORY_STAGE_PLAN, type ModeResult, type StoryStageContract } from "../ModeConfig";
import type { FreeDefenseProgressState, ModeProgressRecord, ProgressSnapshot } from "../ProgressStore";
import { applyUnlockRules } from "../UnlockSystem";
import { applyDailyClear } from "../retention/DailyRetentionRules";
import { LOCAL_RETENTION_CONFIG, stageMedalThresholds, type RetentionConfig } from "../retention/RetentionConfig";
import { bestMedal, evaluateMedal } from "../retention/StageMedalRules";
import { claimWeeklyGoal, DEFAULT_WEEKLY_GOAL_RULE, kstDayKey, type WeeklyGoalRule } from "../retention/WeeklyGoalRules";

export interface CollectionEntry {
  kind: "boss" | "specialObject" | "title";
  id: string;
}

export interface ProgressDelta {
  newModes: ProgressSnapshot["unlocks"]["modes"];
  newSkills: ProgressSnapshot["unlocks"]["skills"];
  newBosses: string[];
  newStoryStages: number[];
  newCollectionEntries: CollectionEntry[];
}

export interface ProgressRecordOutcome {
  snapshot: ProgressSnapshot;
  delta: ProgressDelta;
}

export interface WeeklyRewardClaimOutcome {
  snapshot: ProgressSnapshot;
  claimed: boolean;
  weekKey: string;
  titleId?: string;
}

export function emptyProgressDelta(): ProgressDelta {
  return {
    newModes: [],
    newSkills: [],
    newBosses: [],
    newStoryStages: [],
    newCollectionEntries: [],
  };
}

export function reduceProgressAfterRun(
  current: ProgressSnapshot,
  result: ModeResult,
  now: Date,
  retentionConfig: RetentionConfig = LOCAL_RETENTION_CONFIG,
): ProgressRecordOutcome {
  const snapshot = cloneProgressSnapshot(current);
  const prev = snapshot.records[result.modeId] ?? emptyRecord();
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

  if (result.modeId === "freeDefense") recordFreeDefenseDailyPlay(snapshot.freeDefense, now);
  if (result.modeId === "story" && result.objectiveOutcome === "cleared" && result.activeStoryStageId) {
    addUnique(snapshot.story.clearedStageIds, result.activeStoryStageId);
    const stage = storyStageNumber(result.activeStoryStageId);
    const thresholds = stageMedalThresholds(retentionConfig, result.activeStoryStageId);
    if (stage != null) {
      addUnique(snapshot.unlocks.storyStages, stage);
      if (stage < STORY_STAGE_PLAN.length) addUnique(snapshot.unlocks.storyStages, stage + 1);
      if (thresholds) {
        snapshot.retention.stageMedals[result.activeStoryStageId] = bestMedal(
          snapshot.retention.stageMedals[result.activeStoryStageId] ?? "none",
          evaluateMedal(
            { cleared: true, score: result.score, remainingEnergy: result.remainingEnergy, maxCombo: result.maxCombo },
            thresholds,
          ),
        );
      }
    }
  }
  if (result.modeId === "daily" && result.objectiveOutcome === "cleared") {
    snapshot.daily.clearCount += 1;
    if (result.activeDailyModifierId) addUnique(snapshot.daily.completedModifierIds, result.activeDailyModifierId);
    snapshot.retention.daily = applyDailyClear(snapshot.retention.daily, dateKey(now));
  }
  applyUnlockRules({
    result,
    unlocks: snapshot.unlocks,
    collection: snapshot.collection,
    totalKills: snapshot.profile.totalKills,
    totalBossKills: snapshot.profile.totalBossKills,
  });

  return { snapshot, delta: progressDelta(current, snapshot) };
}

export function claimWeeklyReward(
  current: ProgressSnapshot,
  now: Date,
  rule: WeeklyGoalRule = DEFAULT_WEEKLY_GOAL_RULE,
): WeeklyRewardClaimOutcome {
  const snapshot = cloneProgressSnapshot(current);
  const claim = claimWeeklyGoal(
    {
      clearDayKeys: snapshot.retention.daily.clearDayKeys,
      claimedWeekKeys: snapshot.retention.claimedWeeklyKeys,
    },
    now,
    rule,
  );
  if (!claim.claimed) return { snapshot: current, claimed: false, weekKey: claim.weekKey };

  snapshot.retention.claimedWeeklyKeys = claim.claimedWeekKeys;
  addUnique(snapshot.collection.titles, claim.titleId);
  return { snapshot, claimed: true, weekKey: claim.weekKey, titleId: claim.titleId };
}

function cloneProgressSnapshot(current: ProgressSnapshot): ProgressSnapshot {
  return {
    ...current,
    profile: { ...current.profile },
    records: Object.fromEntries(Object.entries(current.records).map(([mode, record]) => [mode, { ...record }])),
    unlocks: {
      modes: [...current.unlocks.modes],
      skills: [...current.unlocks.skills],
      bosses: [...current.unlocks.bosses],
      storyStages: [...current.unlocks.storyStages],
    },
    collection: {
      bossCodex: [...current.collection.bossCodex],
      specialObjectCodex: [...current.collection.specialObjectCodex],
      titles: [...current.collection.titles],
    },
    story: { clearedStageIds: [...current.story.clearedStageIds] },
    daily: { completedModifierIds: [...current.daily.completedModifierIds], clearCount: current.daily.clearCount },
    freeDefense: { ...current.freeDefense },
    retention: {
      stageMedals: { ...current.retention.stageMedals },
      daily: {
        firstClearAwards: [...current.retention.daily.firstClearAwards],
        clearDayKeys: [...current.retention.daily.clearDayKeys],
      },
      claimedWeeklyKeys: [...current.retention.claimedWeeklyKeys],
    },
  };
}

function progressDelta(before: ProgressSnapshot, after: ProgressSnapshot): ProgressDelta {
  const entries: CollectionEntry[] = [
    ...newItems(before.collection.bossCodex, after.collection.bossCodex).map((id) => ({ kind: "boss" as const, id })),
    ...newItems(before.collection.specialObjectCodex, after.collection.specialObjectCodex).map((id) => ({ kind: "specialObject" as const, id })),
    ...newItems(before.collection.titles, after.collection.titles).map((id) => ({ kind: "title" as const, id })),
  ];
  return {
    newModes: newItems(before.unlocks.modes, after.unlocks.modes),
    newSkills: newItems(before.unlocks.skills, after.unlocks.skills),
    newBosses: newItems(before.unlocks.bosses, after.unlocks.bosses),
    newStoryStages: newItems(before.unlocks.storyStages, after.unlocks.storyStages),
    newCollectionEntries: entries,
  };
}

function newItems<T>(before: readonly T[], after: readonly T[]): T[] {
  return after.filter((item) => !before.includes(item));
}

function emptyRecord(): ModeProgressRecord {
  return { plays: 0, bestScore: 0, bestSurvivalMs: 0, bestCombo: 0, bestKills: 0, bestBossKills: 0 };
}

function recordFreeDefenseDailyPlay(progress: FreeDefenseProgressState, now: Date): void {
  const today = dateKey(now);
  if (progress.dailyPlayDate !== today) {
    progress.dailyPlayDate = today;
    progress.dailyPlayCount = 0;
  }
  progress.dailyPlayCount += 1;
}

function dateKey(now: Date): string {
  return kstDayKey(now);
}

function storyStageNumber(stageId: StoryStageContract["id"]): number | null {
  const match = /^story-(\d+)$/.exec(stageId);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

function addUnique<T>(items: T[], item: T): void {
  if (!items.includes(item)) items.push(item);
}
