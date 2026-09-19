import type { ModeId } from '../../game/ModeConfig';
import type { ModeProgressRecord, ProgressSnapshot } from '../../game/ProgressStore';
import type { StageMedal } from '../../game/retention/StageMedalRules';

const MEDAL_RANK: Record<StageMedal, number> = { none: 0, bronze: 1, silver: 2, gold: 3 };
const ONBOARDING_RANK: Record<ProgressSnapshot['onboarding']['step'], number> = {
  not_started: 0,
  basic_slash: 1,
  last_save: 2,
  solar_lance: 3,
  reward: 4,
  complete: 5,
};

function union<T>(left: readonly T[], right: readonly T[]): T[] {
  return [...new Set([...left, ...right])];
}

function bestRecord(left: ModeProgressRecord, right: ModeProgressRecord): ModeProgressRecord {
  return {
    plays: Math.max(left.plays, right.plays),
    bestScore: Math.max(left.bestScore, right.bestScore),
    bestSurvivalMs: Math.max(left.bestSurvivalMs, right.bestSurvivalMs),
    bestCombo: Math.max(left.bestCombo, right.bestCombo),
    bestKills: Math.max(left.bestKills, right.bestKills),
    bestBossKills: Math.max(left.bestBossKills, right.bestBossKills),
  };
}

function mergeRecords(
  local: ProgressSnapshot['records'],
  remote: ProgressSnapshot['records'],
): ProgressSnapshot['records'] {
  const result: ProgressSnapshot['records'] = {};
  const modeIds = union(Object.keys(local) as ModeId[], Object.keys(remote) as ModeId[]);
  for (const modeId of modeIds) {
    const left = local[modeId];
    const right = remote[modeId];
    if (left && right) result[modeId] = bestRecord(left, right);
    else if (left) result[modeId] = { ...left };
    else if (right) result[modeId] = { ...right };
  }
  return result;
}

function mergeMedals(
  local: Record<string, StageMedal>,
  remote: Record<string, StageMedal>,
): Record<string, StageMedal> {
  const result = { ...local };
  for (const [stageId, medal] of Object.entries(remote)) {
    const previous = result[stageId];
    if (!previous || MEDAL_RANK[medal] > MEDAL_RANK[previous]) result[stageId] = medal;
  }
  return result;
}

/**
 * Deterministic, idempotent merge for independently saved device snapshots.
 * Counters take their highest known values instead of summing: without an
 * event ledger, summing a previously synced run would double-count it.
 */
export function mergeProgress(local: ProgressSnapshot, remote: ProgressSnapshot): ProgressSnapshot {
  const localOnboarding = ONBOARDING_RANK[local.onboarding.step];
  const remoteOnboarding = ONBOARDING_RANK[remote.onboarding.step];
  const newerOnboarding = localOnboarding >= remoteOnboarding ? local.onboarding : remote.onboarding;

  return {
    version: Math.max(local.version, remote.version) as ProgressSnapshot['version'],
    profile: {
      totalRuns: Math.max(local.profile.totalRuns, remote.profile.totalRuns),
      totalKills: Math.max(local.profile.totalKills, remote.profile.totalKills),
      totalBossKills: Math.max(local.profile.totalBossKills, remote.profile.totalBossKills),
      totalScore: Math.max(local.profile.totalScore, remote.profile.totalScore),
    },
    records: mergeRecords(local.records, remote.records),
    unlocks: {
      modes: union(local.unlocks.modes, remote.unlocks.modes),
      skills: union(local.unlocks.skills, remote.unlocks.skills),
      bosses: union(local.unlocks.bosses, remote.unlocks.bosses),
      storyStages: union(local.unlocks.storyStages, remote.unlocks.storyStages),
    },
    collection: {
      bossCodex: union(local.collection.bossCodex, remote.collection.bossCodex),
      specialObjectCodex: union(local.collection.specialObjectCodex, remote.collection.specialObjectCodex),
      titles: union(local.collection.titles, remote.collection.titles),
    },
    story: { clearedStageIds: union(local.story.clearedStageIds, remote.story.clearedStageIds) },
    daily: {
      completedModifierIds: union(local.daily.completedModifierIds, remote.daily.completedModifierIds),
      clearCount: Math.max(local.daily.clearCount, remote.daily.clearCount),
    },
    freeDefense: (local.freeDefense.dailyPlayDate ?? '') >= (remote.freeDefense.dailyPlayDate ?? '')
      ? { ...local.freeDefense }
      : { ...remote.freeDefense },
    onboarding: { ...newerOnboarding },
    retention: {
      stageMedals: mergeMedals(local.retention.stageMedals, remote.retention.stageMedals),
      daily: {
        firstClearAwards: union(local.retention.daily.firstClearAwards, remote.retention.daily.firstClearAwards),
        clearDayKeys: union(local.retention.daily.clearDayKeys, remote.retention.daily.clearDayKeys),
      },
      claimedWeeklyKeys: union(local.retention.claimedWeeklyKeys, remote.retention.claimedWeeklyKeys),
    },
  };
}
