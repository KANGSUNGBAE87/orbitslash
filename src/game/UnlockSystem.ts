import { dailyModifierById, type ModeId, type ModeResult, type SkillId } from "./ModeConfig";

export interface ProgressUnlocks {
  modes: ModeId[];
  skills: SkillId[];
  bosses: string[];
  storyStages: number[];
}

export interface CollectionState {
  bossCodex: string[];
  specialObjectCodex: string[];
  titles: string[];
}

export function defaultUnlocks(): ProgressUnlocks {
  return {
    modes: ["story", "freeDefense"],
    skills: ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield"],
    bosses: [],
    storyStages: [1],
  };
}

export function defaultCollection(): CollectionState {
  return {
    bossCodex: [],
    specialObjectCodex: [],
    titles: [],
  };
}

export function applyUnlockRules(input: {
  result: ModeResult;
  unlocks: ProgressUnlocks;
  collection: CollectionState;
  totalKills: number;
  totalBossKills: number;
}): void {
  const { result, unlocks, collection, totalKills, totalBossKills } = input;
  addUnique(unlocks.modes, "freeDefense");
  addUnique(unlocks.modes, "story");

  if (totalKills >= 80 || result.modeId === "blitz60") addUnique(unlocks.modes, "blitz60");
  if (totalBossKills >= 1 || (result.bossKills ?? 0) > 0) {
    addUnique(unlocks.modes, "bossRush");
    addUnique(unlocks.modes, "ranked");
    addUnique(unlocks.skills, "nova_pulse");
  }
  if (result.modeId === "story" && result.objectiveOutcome === "cleared" && result.activeStoryStageId === "story-8") {
    addUnique(unlocks.modes, "ranked");
    addUnique(unlocks.skills, "nova_pulse");
  }
  if (result.modeId === "daily" || totalBossKills >= 1) addUnique(unlocks.modes, "daily");

  for (const bossId of result.defeatedBossIds ?? []) {
    addUnique(unlocks.bosses, bossId);
    addUnique(collection.bossCodex, bossId);
  }

  for (const specialObjectId of specialObjectsFromResult(result)) {
    addUnique(collection.specialObjectCodex, specialObjectId);
  }

  if ((result.bossKills ?? 0) > 0) addUnique(collection.titles, "bossBreaker");
  if (result.modeId === "daily" && result.objectiveOutcome === "cleared") addUnique(collection.titles, "dailyClear");
  if (result.modeId === "blitz60" && result.objectiveOutcome === "survived") addUnique(collection.titles, "blitzSurvivor");
  if ((result.maxCombo ?? 0) >= 10) addUnique(collection.titles, "comboPilot");
}

function specialObjectsFromResult(result: ModeResult): string[] {
  const out: string[] = [];
  if ((result.protectedCount ?? 0) > 0) out.push("friendlyRescue");
  const modifier = result.activeDailyModifierId ? dailyModifierById(result.activeDailyModifierId) : null;
  if (result.modeId === "daily" && result.objectiveOutcome === "cleared" && modifier) {
    for (const [type, enabled] of Object.entries(modifier.specialObjectPolicy)) {
      if (enabled) out.push(type);
    }
  }
  return out;
}

function addUnique<T>(items: T[], item: T): void {
  if (!items.includes(item)) items.push(item);
}
