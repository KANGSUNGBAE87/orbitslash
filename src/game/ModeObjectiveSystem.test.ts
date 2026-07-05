import { describe, expect, it } from "vitest";
import { buildRunConfig } from "./ModeConfig";
import {
  activeStoryStageForConfig,
  evaluateDailyObjective,
  evaluateModeObjective,
  evaluateStoryObjective,
  isProtectObjectiveObject,
} from "./ModeObjectiveSystem";

describe("ModeObjectiveSystem", () => {
  it("selects the story stage by fixed stage seed", () => {
    const story2 = buildRunConfig("story", { seed: 1002 });
    const story32 = buildRunConfig("story", { seed: 1032 });

    expect(activeStoryStageForConfig(story2)?.id).toBe("story-2");
    expect(activeStoryStageForConfig(story32)).toMatchObject({
      id: "story-32",
      chapterId: "chapter-8",
      tutorialKey: "story.tutorial.32",
    });
  });

  it("does not silently fall back to story-1 when a Story seed is unknown", () => {
    const unknown = buildRunConfig("story", { seed: 9999 });

    expect(activeStoryStageForConfig(unknown)).toBeNull();
    expect(
      evaluateModeObjective(unknown, {
        elapsedMs: 12000,
        kills: 20,
        maxCombo: 10,
        lastSaveCount: 2,
        remainingEnergy: 80,
      }),
    ).toEqual({ status: "failed", reason: "missing_story_stage", endReason: "earth_destroyed" });
  });

  it("passes story basic slash once kills and combo target are met", () => {
    const result = evaluateModeObjective(buildRunConfig("story", { seed: 1001 }), {
      elapsedMs: 12000,
      kills: 3,
      maxCombo: 2,
      lastSaveCount: 0,
      remainingEnergy: 80,
    });

    expect(result).toEqual({ status: "passed", reason: "basic_slash_complete", endReason: "stage_objective_complete" });
  });

  it("passes story Last Save with one last-save hit", () => {
    const result = evaluateModeObjective(buildRunConfig("story", { seed: 1002 }), {
      elapsedMs: 12000,
      kills: 1,
      maxCombo: 1,
      lastSaveCount: 1,
      remainingEnergy: 80,
    });

    expect(result).toEqual({ status: "passed", reason: "last_save_complete", endReason: "stage_objective_complete" });
  });

  it("passes or fails protect-object story stages from explicit protection counters", () => {
    const stage = activeStoryStageForConfig(buildRunConfig("story", { seed: 1003 }));
    expect(
      evaluateStoryObjective(
        stage,
        { elapsedMs: 45000, kills: 0, maxCombo: 0, lastSaveCount: 0, remainingEnergy: 80, protectedCount: 2, failedProtectCount: 0 },
      ),
    ).toEqual({ status: "passed", reason: "protect_objects_complete", endReason: "stage_objective_complete" });

    expect(
      evaluateStoryObjective(
        stage,
        { elapsedMs: 45000, kills: 0, maxCombo: 0, lastSaveCount: 0, remainingEnergy: 80, protectedCount: 2, failedProtectCount: 1 },
      ),
    ).toEqual({ status: "failed", reason: "protected_object_failed", endReason: "earth_destroyed" });
  });

  it("passes advanced story stages from combo mastery and first boss kill", () => {
    expect(
      evaluateStoryObjective(
        activeStoryStageForConfig(buildRunConfig("story", { seed: 1004 })),
        { elapsedMs: 45000, kills: 8, maxCombo: 6, lastSaveCount: 0, remainingEnergy: 80 },
      ),
    ).toEqual({ status: "passed", reason: "combo_master_complete", endReason: "stage_objective_complete" });

    expect(
      evaluateStoryObjective(
        activeStoryStageForConfig(buildRunConfig("story", { seed: 1005 })),
        { elapsedMs: 45000, kills: 8, maxCombo: 4, lastSaveCount: 0, remainingEnergy: 80, bossKills: 1 },
      ),
    ).toEqual({ status: "passed", reason: "boss_threat_complete", endReason: "stage_objective_complete" });
  });

  it("passes no-skill daily only after the survival target and with no skill use", () => {
    expect(
      evaluateDailyObjective("noSkill", {
        elapsedMs: 60000,
        kills: 4,
        maxCombo: 2,
        lastSaveCount: 0,
        remainingEnergy: 75,
        skillUse: {},
      }),
    ).toEqual({ status: "passed", reason: "daily_no_skill_complete", endReason: "stage_objective_complete" });

    expect(
      evaluateDailyObjective("noSkill", {
        elapsedMs: 20000,
        kills: 4,
        maxCombo: 2,
        lastSaveCount: 0,
        remainingEnergy: 75,
        skillUse: { solar_lance: 1 },
      }),
    ).toEqual({ status: "failed", reason: "daily_no_skill_used_skill", endReason: "daily_challenge_failed" });
  });

  it("passes rescue daily from protected-object counters and fails missing target at time limit", () => {
    expect(
      evaluateDailyObjective("rescueDay", {
        elapsedMs: 60000,
        kills: 4,
        maxCombo: 2,
        lastSaveCount: 0,
        remainingEnergy: 75,
        protectedCount: 2,
        failedProtectCount: 0,
      }),
    ).toEqual({ status: "passed", reason: "daily_rescue_complete", endReason: "stage_objective_complete" });

    expect(
      evaluateDailyObjective("rescueDay", {
        elapsedMs: 60000,
        kills: 4,
        maxCombo: 2,
        lastSaveCount: 0,
        remainingEnergy: 75,
        protectedCount: 1,
        failedProtectCount: 0,
      }),
    ).toEqual({ status: "failed", reason: "daily_rescue_target_missing", endReason: "daily_challenge_failed" });

    expect(
      evaluateDailyObjective("rescueDay", {
        elapsedMs: 20000,
        kills: 4,
        maxCombo: 2,
        lastSaveCount: 0,
        remainingEnergy: 75,
        protectedCount: 2,
        failedProtectCount: 1,
      }),
    ).toEqual({ status: "failed", reason: "daily_rescue_failed_protect", endReason: "daily_challenge_failed" });
  });

  it("passes last-save daily with one Last Save and fails missing target or earth destruction", () => {
    expect(
      evaluateDailyObjective("lastSaveDay", {
        elapsedMs: 60000,
        kills: 4,
        maxCombo: 2,
        lastSaveCount: 1,
        remainingEnergy: 75,
      }),
    ).toEqual({ status: "passed", reason: "daily_last_save_complete", endReason: "stage_objective_complete" });

    expect(
      evaluateDailyObjective("lastSaveDay", {
        elapsedMs: 60000,
        kills: 4,
        maxCombo: 2,
        lastSaveCount: 0,
        remainingEnergy: 75,
      }),
    ).toEqual({ status: "failed", reason: "daily_last_save_missing", endReason: "daily_challenge_failed" });

    expect(
      evaluateDailyObjective("lastSaveDay", {
        elapsedMs: 20000,
        endReason: "earth_destroyed",
        kills: 4,
        maxCombo: 2,
        lastSaveCount: 1,
        remainingEnergy: 0,
      }),
    ).toEqual({ status: "failed", reason: "daily_earth_destroyed", endReason: "daily_challenge_failed" });
  });

  it("passes boss-alert and master-trial daily variants from boss and combined mastery targets", () => {
    expect(
      evaluateDailyObjective("bossAlert", {
        elapsedMs: 60000,
        kills: 8,
        maxCombo: 3,
        lastSaveCount: 0,
        bossKills: 1,
        remainingEnergy: 75,
      }),
    ).toEqual({ status: "passed", reason: "daily_boss_alert_complete", endReason: "stage_objective_complete" });

    expect(
      evaluateDailyObjective("masterTrial", {
        elapsedMs: 60000,
        kills: 14,
        maxCombo: 6,
        lastSaveCount: 1,
        protectedCount: 2,
        failedProtectCount: 0,
        bossKills: 1,
        remainingEnergy: 75,
      }),
    ).toEqual({ status: "passed", reason: "daily_master_trial_complete", endReason: "stage_objective_complete" });
  });

  it("fails boss-alert and master-trial daily variants when required targets are missing at time limit", () => {
    expect(
      evaluateDailyObjective("bossAlert", {
        elapsedMs: 60000,
        kills: 8,
        maxCombo: 3,
        lastSaveCount: 0,
        bossKills: 0,
        remainingEnergy: 75,
      }),
    ).toEqual({ status: "failed", reason: "daily_boss_alert_missing", endReason: "daily_challenge_failed" });

    expect(
      evaluateDailyObjective("masterTrial", {
        elapsedMs: 60000,
        kills: 14,
        maxCombo: 6,
        lastSaveCount: 1,
        protectedCount: 1,
        failedProtectCount: 0,
        bossKills: 1,
        remainingEnergy: 75,
      }),
    ).toEqual({ status: "failed", reason: "daily_master_trial_missing", endReason: "daily_challenge_failed" });

    expect(
      evaluateDailyObjective("masterTrial", {
        elapsedMs: 20000,
        kills: 14,
        maxCombo: 6,
        lastSaveCount: 1,
        protectedCount: 2,
        failedProtectCount: 1,
        bossKills: 1,
        remainingEnergy: 75,
      }),
    ).toEqual({ status: "failed", reason: "daily_master_trial_failed_protect", endReason: "daily_challenge_failed" });
  });

  it("keeps protection-object type checks narrow", () => {
    expect(isProtectObjectiveObject("friendlyRescue")).toBe(true);
    expect(isProtectObjectiveObject("satellite")).toBe(true);
    expect(isProtectObjectiveObject("energyCapsule")).toBe(false);
    expect(isProtectObjectiveObject("empMine")).toBe(false);
  });
});
