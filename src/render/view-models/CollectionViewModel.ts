import { STORY_STAGE_PLAN } from "../../game/ModeConfig";
import type { ProgressSnapshot } from "../../game/ProgressStore";
import { LOCAL_RETENTION_CONFIG, type RetentionConfig } from "../../game/retention/RetentionConfig";
import { weeklyGoalStatus } from "../../game/retention/WeeklyGoalRules";

export interface CollectionMedalSummary {
  gold: number;
  silver: number;
  bronze: number;
  unearned: number;
}

export interface CollectionViewModel {
  medals: CollectionMedalSummary;
  dailyClearDays: number;
  weeklyClaims: number;
  weekly: {
    weekKey: string;
    clearCount: number;
    requiredClearDays: number;
    claimable: boolean;
    claimed: boolean;
    titleId: string;
  };
}

export function buildCollectionViewModel(
  progress: ProgressSnapshot,
  now: Date = new Date(),
  retentionConfig: RetentionConfig = LOCAL_RETENTION_CONFIG,
): CollectionViewModel {
  const medals: CollectionMedalSummary = { gold: 0, silver: 0, bronze: 0, unearned: 0 };
  for (const stage of STORY_STAGE_PLAN) {
    const medal = progress.retention.stageMedals[stage.id];
    if (medal === "gold" || medal === "silver" || medal === "bronze") medals[medal] += 1;
    else medals.unearned += 1;
  }
  const weekly = weeklyGoalStatus(
    progress.retention.daily.clearDayKeys,
    progress.retention.claimedWeeklyKeys,
    now,
    retentionConfig.weekly,
  );
  return {
    medals,
    dailyClearDays: progress.retention.daily.clearDayKeys.length,
    weeklyClaims: progress.retention.claimedWeeklyKeys.length,
    weekly: {
      weekKey: weekly.weekKey,
      clearCount: weekly.clearCount,
      requiredClearDays: retentionConfig.weekly.requiredDistinctClearDays,
      claimable: weekly.claimable,
      claimed: weekly.claimed,
      titleId: retentionConfig.weekly.titleId,
    },
  };
}
