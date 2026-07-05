import type { DailyModifierId, RunConfig, RunEndReason, SkillId, StoryStageContract } from "./ModeConfig";

export interface ObjectiveSnapshot {
  elapsedMs: number;
  endReason?: RunEndReason;
  kills: number;
  maxCombo: number;
  lastSaveCount: number;
  remainingEnergy: number;
  skillUse?: Partial<Record<SkillId, number>>;
  protectedCount?: number;
  failedProtectCount?: number;
  bossKills?: number;
}

export type ObjectiveEvaluation =
  | { status: "in_progress"; reason: string }
  | { status: "passed"; reason: string; endReason: RunEndReason }
  | { status: "failed"; reason: string; endReason: RunEndReason };

const STORY_BASIC_KILLS = 3;
const STORY_BASIC_COMBO = 2;
const STORY_LAST_SAVE_COUNT = 1;
const STORY_PROTECT_TARGET = 2;
const STORY_COMBO_MASTER_TARGET = 6;
const STORY_BOSS_KILL_TARGET = 1;
const DAILY_GOAL_SURVIVAL_MS = 60000;
const DAILY_RESCUE_TARGET = 2;
const DAILY_LAST_SAVE_TARGET = 1;
const DAILY_BOSS_KILL_TARGET = 1;
const DAILY_MASTER_KILL_TARGET = 12;
const DAILY_MASTER_COMBO_TARGET = 6;

export function evaluateModeObjective(config: RunConfig, snapshot: ObjectiveSnapshot): ObjectiveEvaluation {
  if (config.modeId === "story") {
    return evaluateStoryObjective(activeStoryStageForConfig(config), snapshot);
  }
  if (config.modeId === "daily") {
    return evaluateDailyObjective(config.rules.activeDailyModifierId, snapshot);
  }
  return { status: "in_progress", reason: "mode_has_no_stage_objective" };
}

export function activeStoryStageForConfig(config: RunConfig): StoryStageContract | null {
  const stages = config.rules.storyStages ?? [];
  return stages.find((stage) => stage.seed === config.seed) ?? null;
}

export function evaluateStoryObjective(stage: StoryStageContract | null, snapshot: ObjectiveSnapshot): ObjectiveEvaluation {
  if (!stage) return { status: "failed", reason: "missing_story_stage", endReason: "earth_destroyed" };
  const params = stage.objectiveParams ?? {};

  if (stage.objective === "basicSlash") {
    if (snapshot.kills >= (params.killsTarget ?? STORY_BASIC_KILLS) && snapshot.maxCombo >= (params.comboTarget ?? STORY_BASIC_COMBO)) {
      return { status: "passed", reason: "basic_slash_complete", endReason: "stage_objective_complete" };
    }
    return { status: "in_progress", reason: "basic_slash_pending" };
  }

  if (stage.objective === "lastSave") {
    if (snapshot.lastSaveCount >= (params.lastSaveTarget ?? STORY_LAST_SAVE_COUNT)) {
      return { status: "passed", reason: "last_save_complete", endReason: "stage_objective_complete" };
    }
    return { status: "in_progress", reason: "last_save_pending" };
  }

  if (stage.objective === "protectObjects") {
    if ((snapshot.failedProtectCount ?? 0) > 0) {
      return { status: "failed", reason: "protected_object_failed", endReason: "earth_destroyed" };
    }
    if ((snapshot.protectedCount ?? 0) >= (params.protectTarget ?? STORY_PROTECT_TARGET)) {
      return { status: "passed", reason: "protect_objects_complete", endReason: "stage_objective_complete" };
    }
    return { status: "in_progress", reason: "protect_objects_pending" };
  }

  if (stage.objective === "comboMaster") {
    if (snapshot.maxCombo >= (params.comboTarget ?? STORY_COMBO_MASTER_TARGET)) {
      return { status: "passed", reason: "combo_master_complete", endReason: "stage_objective_complete" };
    }
    return { status: "in_progress", reason: "combo_master_pending" };
  }

  if (stage.objective === "bossThreat") {
    if ((snapshot.bossKills ?? 0) >= (params.bossKillTarget ?? STORY_BOSS_KILL_TARGET)) {
      return { status: "passed", reason: "boss_threat_complete", endReason: "stage_objective_complete" };
    }
    return { status: "in_progress", reason: "boss_threat_pending" };
  }

  return { status: "in_progress", reason: "unknown_story_objective" };
}

export function evaluateDailyObjective(modifierId: DailyModifierId | undefined, snapshot: ObjectiveSnapshot): ObjectiveEvaluation {
  if (!modifierId) return { status: "in_progress", reason: "missing_daily_modifier" };
  if (snapshot.endReason === "earth_destroyed") {
    return { status: "failed", reason: "daily_earth_destroyed", endReason: "daily_challenge_failed" };
  }

  if (modifierId === "noSkill") {
    if (totalSkillUse(snapshot.skillUse) > 0) {
      return { status: "failed", reason: "daily_no_skill_used_skill", endReason: "daily_challenge_failed" };
    }
    if (snapshot.elapsedMs >= DAILY_GOAL_SURVIVAL_MS) {
      return { status: "passed", reason: "daily_no_skill_complete", endReason: "stage_objective_complete" };
    }
    return { status: "in_progress", reason: "daily_no_skill_pending" };
  }

  if (modifierId === "rescueDay") {
    if ((snapshot.failedProtectCount ?? 0) > 0) {
      return { status: "failed", reason: "daily_rescue_failed_protect", endReason: "daily_challenge_failed" };
    }
    if ((snapshot.protectedCount ?? 0) >= DAILY_RESCUE_TARGET && snapshot.elapsedMs >= DAILY_GOAL_SURVIVAL_MS) {
      return { status: "passed", reason: "daily_rescue_complete", endReason: "stage_objective_complete" };
    }
    if (snapshot.elapsedMs >= DAILY_GOAL_SURVIVAL_MS) {
      return { status: "failed", reason: "daily_rescue_target_missing", endReason: "daily_challenge_failed" };
    }
    return { status: "in_progress", reason: "daily_rescue_pending" };
  }

  if (modifierId === "lastSaveDay") {
    if (snapshot.lastSaveCount >= DAILY_LAST_SAVE_TARGET && snapshot.elapsedMs >= DAILY_GOAL_SURVIVAL_MS) {
      return { status: "passed", reason: "daily_last_save_complete", endReason: "stage_objective_complete" };
    }
    if (snapshot.elapsedMs >= DAILY_GOAL_SURVIVAL_MS) {
      return { status: "failed", reason: "daily_last_save_missing", endReason: "daily_challenge_failed" };
    }
    return { status: "in_progress", reason: "daily_last_save_pending" };
  }

  if (modifierId === "bossAlert") {
    if ((snapshot.bossKills ?? 0) >= DAILY_BOSS_KILL_TARGET && snapshot.elapsedMs >= DAILY_GOAL_SURVIVAL_MS) {
      return { status: "passed", reason: "daily_boss_alert_complete", endReason: "stage_objective_complete" };
    }
    if (snapshot.elapsedMs >= DAILY_GOAL_SURVIVAL_MS) {
      return { status: "failed", reason: "daily_boss_alert_missing", endReason: "daily_challenge_failed" };
    }
    return { status: "in_progress", reason: "daily_boss_alert_pending" };
  }

  if (modifierId === "masterTrial") {
    if ((snapshot.failedProtectCount ?? 0) > 0) {
      return { status: "failed", reason: "daily_master_trial_failed_protect", endReason: "daily_challenge_failed" };
    }
    const masteryMet =
      snapshot.kills >= DAILY_MASTER_KILL_TARGET &&
      snapshot.maxCombo >= DAILY_MASTER_COMBO_TARGET &&
      snapshot.lastSaveCount >= DAILY_LAST_SAVE_TARGET &&
      (snapshot.protectedCount ?? 0) >= DAILY_RESCUE_TARGET &&
      (snapshot.bossKills ?? 0) >= DAILY_BOSS_KILL_TARGET;
    if (masteryMet && snapshot.elapsedMs >= DAILY_GOAL_SURVIVAL_MS) {
      return { status: "passed", reason: "daily_master_trial_complete", endReason: "stage_objective_complete" };
    }
    if (snapshot.elapsedMs >= DAILY_GOAL_SURVIVAL_MS) {
      return { status: "failed", reason: "daily_master_trial_missing", endReason: "daily_challenge_failed" };
    }
    return { status: "in_progress", reason: "daily_master_trial_pending" };
  }

  return { status: "in_progress", reason: "unknown_daily_modifier" };
}

function totalSkillUse(skillUse: Partial<Record<SkillId, number>> | undefined): number {
  return Object.values(skillUse ?? {}).reduce((sum, value) => sum + Math.max(0, value ?? 0), 0);
}

export function isProtectObjectiveObject(type: string): boolean {
  return type === "friendlyRescue" || type === "satellite";
}
