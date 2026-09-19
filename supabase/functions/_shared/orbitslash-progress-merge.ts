/**
 * Deno/browser-neutral merge for the persisted progress snapshot. The server
 * uses this before advancing a revision so an older device cannot overwrite
 * unlocks or records produced by a newer one.
 */
type Snapshot = Record<string, unknown>;
type Dictionary = Record<string, unknown>;

const ONBOARDING_RANK: Record<string, number> = {
  not_started: 0,
  basic_slash: 1,
  last_save: 2,
  solar_lance: 3,
  reward: 4,
  complete: 5,
};

const MEDAL_RANK: Record<string, number> = { none: 0, bronze: 1, silver: 2, gold: 3 };
const PROFILE_KEYS = ["totalRuns", "totalKills", "totalBossKills", "totalScore"] as const;
const RECORD_KEYS = ["plays", "bestScore", "bestSurvivalMs", "bestCombo", "bestKills", "bestBossKills"] as const;

export function mergeProgressSnapshots(leftInput: Snapshot, rightInput: Snapshot): Snapshot {
  const left = objectOf(leftInput);
  const right = objectOf(rightInput);
  const leftRetention = objectOf(left.retention);
  const rightRetention = objectOf(right.retention);
  const leftDailyRetention = objectOf(leftRetention.daily);
  const rightDailyRetention = objectOf(rightRetention.daily);

  return {
    ...left,
    ...right,
    version: Math.max(numberOf(left.version), numberOf(right.version)),
    profile: mergeMaximumRecord(objectOf(left.profile), objectOf(right.profile), PROFILE_KEYS),
    records: mergeRecords(objectOf(left.records), objectOf(right.records)),
    unlocks: mergeStringArrayFields(objectOf(left.unlocks), objectOf(right.unlocks), ["modes", "skills", "bosses", "storyStages"]),
    collection: mergeStringArrayFields(objectOf(left.collection), objectOf(right.collection), ["bossCodex", "specialObjectCodex", "titles"]),
    story: mergeStringArrayFields(objectOf(left.story), objectOf(right.story), ["clearedStageIds"]),
    daily: {
      ...objectOf(left.daily),
      ...objectOf(right.daily),
      completedModifierIds: unionStrings(objectOf(left.daily).completedModifierIds, objectOf(right.daily).completedModifierIds),
      clearCount: Math.max(numberOf(objectOf(left.daily).clearCount), numberOf(objectOf(right.daily).clearCount)),
    },
    freeDefense: newerFreeDefense(objectOf(left.freeDefense), objectOf(right.freeDefense)),
    onboarding: newerOnboarding(objectOf(left.onboarding), objectOf(right.onboarding)),
    retention: {
      ...leftRetention,
      ...rightRetention,
      stageMedals: mergeMedals(objectOf(leftRetention.stageMedals), objectOf(rightRetention.stageMedals)),
      daily: {
        ...leftDailyRetention,
        ...rightDailyRetention,
        firstClearAwards: unionStrings(leftDailyRetention.firstClearAwards, rightDailyRetention.firstClearAwards),
        clearDayKeys: unionStrings(leftDailyRetention.clearDayKeys, rightDailyRetention.clearDayKeys),
      },
      claimedWeeklyKeys: unionStrings(leftRetention.claimedWeeklyKeys, rightRetention.claimedWeeklyKeys),
    },
  };
}

function mergeRecords(left: Dictionary, right: Dictionary): Dictionary {
  const merged: Dictionary = {};
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    merged[key] = mergeMaximumRecord(objectOf(left[key]), objectOf(right[key]), RECORD_KEYS);
  }
  return merged;
}

function mergeMaximumRecord(left: Dictionary, right: Dictionary, keys: readonly string[]): Dictionary {
  const merged: Dictionary = { ...left, ...right };
  for (const key of keys) merged[key] = Math.max(numberOf(left[key]), numberOf(right[key]));
  return merged;
}

function mergeStringArrayFields(left: Dictionary, right: Dictionary, keys: readonly string[]): Dictionary {
  const merged: Dictionary = { ...left, ...right };
  for (const key of keys) merged[key] = unionStrings(left[key], right[key]);
  return merged;
}

function mergeMedals(left: Dictionary, right: Dictionary): Dictionary {
  const merged: Dictionary = { ...left };
  for (const [key, value] of Object.entries(right)) {
    const previous = typeof merged[key] === "string" ? merged[key] as string : "none";
    const next = typeof value === "string" ? value : "none";
    merged[key] = (MEDAL_RANK[next] ?? 0) > (MEDAL_RANK[previous] ?? 0) ? next : previous;
  }
  return merged;
}

function newerOnboarding(left: Dictionary, right: Dictionary): Dictionary {
  const leftStep = typeof left.step === "string" ? left.step : "not_started";
  const rightStep = typeof right.step === "string" ? right.step : "not_started";
  return (ONBOARDING_RANK[leftStep] ?? 0) >= (ONBOARDING_RANK[rightStep] ?? 0) ? { ...left } : { ...right };
}

function newerFreeDefense(left: Dictionary, right: Dictionary): Dictionary {
  const leftDate = typeof left.dailyPlayDate === "string" ? left.dailyPlayDate : "";
  const rightDate = typeof right.dailyPlayDate === "string" ? right.dailyPlayDate : "";
  return leftDate >= rightDate ? { ...left } : { ...right };
}

function unionStrings(left: unknown, right: unknown): string[] {
  const values = [...arrayOfStrings(left), ...arrayOfStrings(right)];
  return [...new Set(values)];
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function objectOf(value: unknown): Dictionary {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Dictionary : {};
}

function numberOf(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}
