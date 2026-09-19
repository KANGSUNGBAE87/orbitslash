import type { ModeId, SkillId } from "../ModeConfig";
import type { ProgressSnapshot } from "../ProgressStore";

export interface PlayerUnlocks {
  modes: ModeId[];
  skills: SkillId[];
}

export interface ModeAvailability {
  playerUnlocked: boolean;
  serviceReady: boolean;
  startKind: "blocked" | "local_practice" | "server_verified";
}

export function evaluatePlayerUnlocks(progress: ProgressSnapshot): PlayerUnlocks {
  const modes = [...progress.unlocks.modes];
  const skills = [...progress.unlocks.skills];
  if (hasRankedMilestone(progress)) {
    addUnique(modes, "ranked");
    addUnique(skills, "nova_pulse");
  }
  return { modes, skills };
}

export function resolveModeAvailability(modeId: ModeId, progress: ProgressSnapshot, rankedServiceReady: boolean): ModeAvailability {
  const playerUnlocked = evaluatePlayerUnlocks(progress).modes.includes(modeId);
  if (!playerUnlocked) return { playerUnlocked: false, serviceReady: false, startKind: "blocked" };
  if (modeId !== "ranked") return { playerUnlocked: true, serviceReady: true, startKind: "local_practice" };
  return rankedServiceReady
    ? { playerUnlocked: true, serviceReady: true, startKind: "server_verified" }
    : { playerUnlocked: true, serviceReady: false, startKind: "local_practice" };
}

function hasRankedMilestone(progress: ProgressSnapshot): boolean {
  return progress.profile.totalBossKills >= 1 || progress.story.clearedStageIds.includes("story-8");
}

function addUnique<T>(items: T[], item: T): void {
  if (!items.includes(item)) items.push(item);
}
