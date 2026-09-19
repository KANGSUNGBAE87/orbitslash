const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function kstDayKey(now: Date): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return kst.toISOString().slice(0, 10);
}

export function weekKeyFor(now: Date): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const day = kst.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const hour = kst.getUTCHours();
  const beforeMondayReset = daysSinceMonday === 0 && hour < 6;
  const start = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - daysSinceMonday - (beforeMondayReset ? 7 : 0)));
  return start.toISOString().slice(0, 10);
}

export interface WeeklyGoalRule {
  requiredDistinctClearDays: number;
  titleId: string;
}

export const DEFAULT_WEEKLY_GOAL_RULE: WeeklyGoalRule = {
  requiredDistinctClearDays: 5,
  titleId: "weekly_five_day",
};

export interface WeeklyGoalStatus {
  weekKey: string;
  clearCount: number;
  complete: boolean;
  claimable: boolean;
  claimed: boolean;
}

export interface WeeklyGoalClaimState {
  clearDayKeys: readonly string[];
  claimedWeekKeys: readonly string[];
}

export type WeeklyGoalClaim =
  | { claimed: true; weekKey: string; titleId: string; claimedWeekKeys: string[] }
  | { claimed: false; weekKey: string; claimedWeekKeys: string[] };

/**
 * Backward-compatible two-argument form is retained for old callers while
 * product paths pass claim keys and a KST-aware clock.
 */
export function weeklyGoalStatus(
  clearDayKeys: readonly string[],
  claimed: boolean,
): { complete: boolean; claimable: boolean; clearCount: number };
export function weeklyGoalStatus(
  clearDayKeys: readonly string[],
  claimedWeekKeys: readonly string[],
  now: Date,
  rule: WeeklyGoalRule,
): WeeklyGoalStatus;
export function weeklyGoalStatus(
  clearDayKeys: readonly string[],
  claimedOrWeekKeys: boolean | readonly string[],
  now?: Date,
  rule: WeeklyGoalRule = DEFAULT_WEEKLY_GOAL_RULE,
): { complete: boolean; claimable: boolean; clearCount: number } | WeeklyGoalStatus {
  if (typeof claimedOrWeekKeys === "boolean") {
    const clearCount = new Set(clearDayKeys).size;
    const complete = clearCount >= DEFAULT_WEEKLY_GOAL_RULE.requiredDistinctClearDays;
    return { complete, claimable: complete && !claimedOrWeekKeys, clearCount };
  }

  const at = now ?? new Date();
  const weekKey = weekKeyFor(at);
  const clearCount = currentWeekClearDayKeys(clearDayKeys, at).length;
  const complete = clearCount >= rule.requiredDistinctClearDays;
  const claimed = claimedOrWeekKeys.includes(weekKey);
  return { weekKey, clearCount, complete, claimable: complete && !claimed, claimed };
}

/** Daily keys are KST calendar dates; only the active Monday-06 KST cycle counts. */
export function currentWeekClearDayKeys(clearDayKeys: readonly string[], now: Date): string[] {
  const start = new Date(`${weekKeyFor(now)}T00:00:00.000Z`).getTime();
  const end = start + 7 * 24 * 60 * 60 * 1000;
  return [...new Set(clearDayKeys)].filter((dayKey) => {
    const value = Date.parse(`${dayKey}T00:00:00.000Z`);
    return Number.isFinite(value) && value >= start && value < end;
  });
}

export function claimWeeklyGoal(state: WeeklyGoalClaimState, now: Date, rule: WeeklyGoalRule): WeeklyGoalClaim {
  const status = weeklyGoalStatus(state.clearDayKeys, state.claimedWeekKeys, now, rule);
  if (!status.claimable) {
    return { claimed: false, weekKey: status.weekKey, claimedWeekKeys: [...state.claimedWeekKeys] };
  }
  return {
    claimed: true,
    weekKey: status.weekKey,
    titleId: rule.titleId,
    claimedWeekKeys: [...state.claimedWeekKeys, status.weekKey],
  };
}
