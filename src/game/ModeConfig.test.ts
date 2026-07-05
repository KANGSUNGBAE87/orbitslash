import { describe, expect, it } from "vitest";
import {
  buildRunConfig,
  MODE_DEFINITIONS,
  MODE_IDS,
  modeDefinitions,
  STORY_CHAPTERS,
  STORY_STAGE_PLAN,
  validateRunConfig,
  type ModeId,
} from "./ModeConfig";

describe("ModeConfig contracts", () => {
  it("defines the six planned release modes in a stable order", () => {
    expect(MODE_IDS).toEqual(["story", "freeDefense", "ranked", "bossRush", "blitz60", "daily"]);
    expect(modeDefinitions().map((mode) => mode.id)).toEqual(MODE_IDS);
  });

  it("keeps server-ranked runs server seeded, ranked eligible, and non-revivable", () => {
    const ranked = buildRunConfig("ranked", { difficulty: "elite", seed: 42, configVersion: "server-ranked-2026w27" });

    expect(ranked.modeId).toBe("ranked");
    expect(ranked.difficulty).toBe("elite");
    expect(ranked.seedPolicy).toBe("serverAssigned");
    expect(ranked.rules.revivePolicy).toBe("none");
    expect(ranked.rules.rankingEligible).toBe(true);
    expect(ranked.rules.scoringPriority).toEqual(["survivalMs", "score"]);
    expect(ranked.seed).toBe(42);
  });

  it("keeps local ranked runs unranked until a server seed is attached", () => {
    const ranked = buildRunConfig("ranked", { difficulty: "elite" });

    expect(ranked.seedPolicy).toBe("serverAssigned");
    expect(ranked.seed).toBe(0);
    expect(ranked.rules.rankingEligible).toBe(false);
  });

  it("does not treat server preview or stub config names as public ranking eligible", () => {
    expect(buildRunConfig("ranked", { seed: 42, configVersion: "server-preview-2026w27" }).rules.rankingEligible).toBe(false);
    expect(buildRunConfig("ranked", { seed: 42, configVersion: "server-stub-2026w27" }).rules.rankingEligible).toBe(false);
  });

  it("builds timer-limited blitz runs without ranking claims", () => {
    const blitz = buildRunConfig("blitz60", { seed: 7 });

    expect(blitz.rules.durationLimitMs).toBe(60000);
    expect(blitz.rules.objective).toBe("score");
    expect(blitz.rules.rankingEligible).toBe(false);
    expect(blitz.rules.revivePolicy).toBe("none");
  });

  it("enables the five release skills in normal play modes", () => {
    const free = buildRunConfig("freeDefense");

    expect(free.rules.enabledSkills).toEqual(["solar_lance", "orbital_cut", "gravity_slow", "delta_shield", "nova_pulse"]);
    expect(free.rules.enabledSkills).not.toContain("reserve_slot");
  });

  it("supports Free Defense practice presets without changing it into a ranked mode", () => {
    const standard = buildRunConfig("freeDefense");
    const bossPractice = buildRunConfig("freeDefense", { freeDefensePreset: "bossPractice" } as any);
    const skillPractice = buildRunConfig("freeDefense", { freeDefensePreset: "skillPractice" } as any);

    expect(standard.rules.freeDefensePreset).toBe("standard");
    expect(standard.rules.rankingEligible).toBe(false);
    expect(bossPractice.rules.freeDefensePreset).toBe("bossPractice");
    expect(bossPractice.rules.bossPolicy.bossEveryMs).toBeLessThan(standard.rules.bossPolicy.bossEveryMs);
    expect(bossPractice.rules.bossPolicy.bossEnemyType).toBe("ringed_destroyer");
    expect(skillPractice.rules.freeDefensePreset).toBe("skillPractice");
    expect(skillPractice.rules.specialObjectPolicy.energyCapsule).toBe(true);
    expect(skillPractice.rules.specialObjectPolicy.empMine).toBe(false);
    expect(skillPractice.rules.rankingEligible).toBe(false);
  });

  it("lets Boss Practice pin any release boss as the first practice target", () => {
    const lavaPractice = buildRunConfig("freeDefense", {
      freeDefensePreset: "bossPractice",
      practiceBossId: "lava_titan",
    });

    expect(lavaPractice.rules.freeDefensePreset).toBe("bossPractice");
    expect(lavaPractice.rules.bossPolicy.bossEnemyType).toBe("lava_titan");
    expect(lavaPractice.rules.bossPolicy.sequence).toEqual(["lava_titan"]);
    expect(lavaPractice.rules.rankingEligible).toBe(false);
  });

  it("defines the full Story plan as 8 chapters with 4 stages each", () => {
    const story = buildRunConfig("story");

    expect(STORY_CHAPTERS).toHaveLength(8);
    expect(STORY_CHAPTERS.map((chapter) => chapter.id)).toEqual([
      "chapter-1",
      "chapter-2",
      "chapter-3",
      "chapter-4",
      "chapter-5",
      "chapter-6",
      "chapter-7",
      "chapter-8",
    ]);
    expect(STORY_CHAPTERS.every((chapter) => chapter.stageIds.length === 4)).toBe(true);
    expect(STORY_STAGE_PLAN).toHaveLength(32);
    expect(story.rules.storyStages?.map((stage) => stage.id)).toEqual(Array.from({ length: 32 }, (_, index) => `story-${index + 1}`));
    expect(new Set(story.rules.storyStages?.map((stage) => stage.seed)).size).toBe(32);
    expect(story.rules.storyStages?.[0]?.objective).toBe("basicSlash");
    expect(story.rules.storyStages?.[1]?.objective).toBe("lastSave");
    expect(story.rules.storyStages?.[2]?.objective).toBe("protectObjects");
    expect(story.rules.storyStages?.[3]?.objective).toBe("comboMaster");
    expect(story.rules.storyStages?.[4]?.objective).toBe("bossThreat");
    expect(story.rules.storyStages?.[31]).toMatchObject({
      id: "story-32",
      chapterId: "chapter-8",
      tutorialKey: "story.tutorial.32",
    });
    expect(story.rules.storyChapters?.[7]?.titleKey).toBe("story.chapter8");
  });

  it("attaches authored content profiles to Story stages and applies the selected stage profile to run rules", () => {
    const first = buildRunConfig("story", { storyStageId: "story-1" });
    const rescue = buildRunConfig("story", { storyStageId: "story-3" });
    const precision = buildRunConfig("story", { storyStageId: "story-17" });
    const finale = buildRunConfig("story", { storyStageId: "story-32" });

    expect(first.rules.activeContentProfileId).toBe("starter");
    expect(first.rules.enabledSkills).toEqual(["solar_lance", "orbital_cut", "gravity_slow"]);
    expect(rescue.rules.activeContentProfileId).toBe("rescue");
    expect(rescue.rules.specialObjectPolicy).toMatchObject({ friendlyRescue: true, satellite: true });
    expect(precision.rules.activeContentProfileId).toBe("precision");
    expect(precision.rules.enabledSkills).toContain("nova_pulse");
    expect(finale.rules.activeContentProfileId).toBe("finale");
    expect(finale.rules.bossPolicy.bossEnemyType).toBe("dark_planet");
    expect(finale.rules.bossPolicy.bossEveryMs).toBeLessThan(first.rules.bossPolicy.bossEveryMs);
  });

  it("gives every Story stage a tutorial message key and chapter link", () => {
    for (const stage of STORY_STAGE_PLAN) {
      expect(stage.chapterId).toMatch(/^chapter-[1-8]$/);
      expect(stage.stageNumber).toBeGreaterThanOrEqual(1);
      expect(stage.stageNumber).toBeLessThanOrEqual(4);
      expect(stage.labelKey).toBe(`story.stage${stage.id.replace("story-", "")}`);
      expect(stage.tutorialKey).toBe(`story.tutorial.${stage.id.replace("story-", "")}`);
    }
  });

  it("defines the Daily preset rotation with boss and master variants", () => {
    const daily = buildRunConfig("daily", { seed: 20260704 });

    expect(daily.rules.dailyModifiers?.map((modifier) => modifier.id)).toEqual(["noSkill", "rescueDay", "lastSaveDay", "bossAlert", "masterTrial"]);
    expect(daily.rules.activeDailyModifierId).toBe("masterTrial");
  });

  it("applies Daily content profiles while preserving modifier skill locks", () => {
    const noSkill = buildRunConfig("daily", { seed: 20260705 });
    const bossAlert = buildRunConfig("daily", { seed: 20260703 });

    expect(noSkill.rules.activeDailyModifierId).toBe("noSkill");
    expect(noSkill.rules.activeContentProfileId).toBe("starter");
    expect(noSkill.rules.enabledSkills).toEqual([]);
    expect(bossAlert.rules.activeDailyModifierId).toBe("bossAlert");
    expect(bossAlert.rules.activeContentProfileId).toBe("boss");
    expect(bossAlert.rules.bossPolicy.bossEnemyType).toBe("ringed_destroyer");
    expect(bossAlert.rules.bossPolicy.bossEveryMs).toBe(30000);
  });

  it("keeps no-skill Daily runnable even though it intentionally disables all skills", () => {
    const daily = buildRunConfig("daily", { seed: 20260705 });

    expect(daily.rules.activeDailyModifierId).toBe("noSkill");
    expect(daily.rules.enabledSkills).toEqual([]);
    expect(validateRunConfig(daily)).toEqual({ ok: true });
  });

  it("starts Boss Rush with Ringed Destroyer as the authored Batch A boss", () => {
    const bossRush = buildRunConfig("bossRush");

    expect(bossRush.rules.bossPolicy.sequence?.[0]).toBe("ringed_destroyer");
  });

  it("validates config and catches missing boss policy fields", () => {
    const config = buildRunConfig("freeDefense");
    expect(validateRunConfig(config)).toEqual({ ok: true });

    const broken = {
      ...config,
      rules: { ...config.rules, bossPolicy: { ...config.rules.bossPolicy, bossEveryMs: 0 } },
    };
    expect(validateRunConfig(broken)).toEqual({ ok: false, reason: "invalid_boss_interval" });
  });

  it("has labels for every mode definition", () => {
    for (const modeId of MODE_IDS as readonly ModeId[]) {
      expect(MODE_DEFINITIONS[modeId].labelKey).toMatch(/^mode\./);
      expect(MODE_DEFINITIONS[modeId].descriptionKey).toMatch(/^mode\./);
    }
  });
});
