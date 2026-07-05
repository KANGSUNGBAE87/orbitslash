import { describe, expect, it } from "vitest";
import { buildRunConfig } from "./ModeConfig";
import { modeSpawnIntervalMultiplierAt, resolveModeRuntimeRules } from "./ModeRuleEngine";

describe("resolveModeRuntimeRules", () => {
  it("turns boss rush into a sequence scheduler instead of a periodic boss timer", () => {
    const rules = resolveModeRuntimeRules(buildRunConfig("bossRush"));

    expect(rules.bossSequence).toEqual(["ringed_destroyer", "eclipse_core", "lava_titan", "ice_colossus", "dark_planet"]);
    expect(rules.bossFirstDelayMs).toBe(1500);
    expect(rules.bossRespawnDelayMs).toBe(8000);
    expect(rules.periodicBossEveryMs).toBeNull();
  });

  it("makes blitz faster and keeps it score-first", () => {
    const rules = resolveModeRuntimeRules(buildRunConfig("blitz60"));

    expect(rules.spawnIntervalMultiplier).toBeLessThan(1);
    expect(rules.specialObjectMaxActive).toBe(1);
    expect(rules.endOnBossSequenceComplete).toBe(false);
    expect(rules.blitzBands?.map((band) => band.fromMs)).toEqual([0, 10000, 20000, 30000, 40000, 50000]);
    expect(modeSpawnIntervalMultiplierAt(rules, 55000)).toBeLessThan(modeSpawnIntervalMultiplierAt(rules, 5000));
  });

  it("turns story stages and daily modifiers into runtime hints", () => {
    const story = resolveModeRuntimeRules(buildRunConfig("story"));
    const daily = resolveModeRuntimeRules(buildRunConfig("daily", { seed: 20260701 }));

    expect(story.storyStages?.[2]?.objective).toBe("protectObjects");
    expect(daily.activeDailyModifier?.id).toBe("rescueDay");
    expect(daily.activeDailyModifier?.specialObjectPolicy.friendlyRescue).toBe(true);
  });

  it("lets selected Story and Daily content profiles change runtime pressure", () => {
    const storyStarter = resolveModeRuntimeRules(buildRunConfig("story", { storyStageId: "story-1" }));
    const storyFinale = resolveModeRuntimeRules(buildRunConfig("story", { storyStageId: "story-32" }));
    const dailyNoSkill = resolveModeRuntimeRules(buildRunConfig("daily", { seed: 20260705 }));
    const dailyBoss = resolveModeRuntimeRules(buildRunConfig("daily", { seed: 20260703 }));

    expect(storyStarter.activeContentProfileId).toBe("starter");
    expect(storyFinale.activeContentProfileId).toBe("finale");
    expect(storyFinale.spawnIntervalMultiplier).toBeLessThan(storyStarter.spawnIntervalMultiplier);
    expect(storyFinale.specialObjectMaxActive).toBe(1);
    expect(storyFinale.enemyWeightBias?.dark_meteor).toBeGreaterThan(1);
    expect(storyStarter.enemyWeightBias?.directional_comet).toBe(0);
    expect(dailyNoSkill.activeContentProfileId).toBe("starter");
    expect(dailyBoss.activeContentProfileId).toBe("boss");
    expect(dailyBoss.periodicBossEveryMs).toBe(30000);
    expect(dailyBoss.enemyWeightBias?.fast_comet).toBeGreaterThan(1);
    expect(dailyBoss.spawnIntervalMultiplier).toBeLessThan(dailyNoSkill.spawnIntervalMultiplier);
  });

  it("makes Free Defense difficulty and practice presets affect live runtime pressure", () => {
    const rookie = resolveModeRuntimeRules(buildRunConfig("freeDefense", { difficulty: "rookie" }));
    const master = resolveModeRuntimeRules(buildRunConfig("freeDefense", { difficulty: "master" }));
    const bossPractice = resolveModeRuntimeRules(
      buildRunConfig("freeDefense", { difficulty: "defender", freeDefensePreset: "bossPractice" } as any),
    );
    const skillPractice = resolveModeRuntimeRules(
      buildRunConfig("freeDefense", { difficulty: "defender", freeDefensePreset: "skillPractice" } as any),
    );

    expect(master.spawnIntervalMultiplier).toBeLessThan(rookie.spawnIntervalMultiplier);
    expect(master.periodicBossEveryMs).toBeLessThan(rookie.periodicBossEveryMs ?? Number.POSITIVE_INFINITY);
    expect(bossPractice.periodicBossEveryMs).toBeLessThan(rookie.periodicBossEveryMs ?? Number.POSITIVE_INFINITY);
    expect(skillPractice.specialObjectMaxActive).toBeGreaterThan(rookie.specialObjectMaxActive);
  });
});
