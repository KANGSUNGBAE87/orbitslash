import { describe, expect, it } from "vitest";
import { buildBossHudState } from "./BossHudState";
import { buildRunConfig } from "./ModeConfig";
import { buildTutorialHudState } from "./TutorialHudState";
import { t } from "../i18n";

describe("buildTutorialHudState", () => {
  it("surfaces the active Story stage tutorial during gameplay", () => {
    const state = buildTutorialHudState(buildRunConfig("story", { storyStageId: "story-6" }));

    expect(state).toMatchObject({
      tone: "story",
      title: `${t("story.stage6")} · ${t("story.tutorial.label")}`,
      message: t("story.tutorial.6"),
    });
  });

  it("returns no tutorial for Free Defense after the opening skill hint window", () => {
    expect(buildTutorialHudState(buildRunConfig("freeDefense"))).toBeUndefined();
  });

  it("teaches skill gestures during the opening hint window", () => {
    const state = buildTutorialHudState(buildRunConfig("freeDefense"), undefined, 1_000);

    expect(state).toMatchObject({
      tone: "story",
      title: t("skillTutorial.title"),
      message: t("skillTutorial.novaPulse.opening"),
    });
  });

  it("keeps the generic skill summary when Nova Pulse is disabled", () => {
    const config = buildRunConfig("freeDefense");
    config.rules.enabledSkills = config.rules.enabledSkills.filter((skillId) => skillId !== "nova_pulse");

    expect(buildTutorialHudState(config, undefined, 1_000)).toMatchObject({
      message: t("skillTutorial.summary"),
    });
  });

  it("adds the opening skill hint to Story tutorials without replacing stage guidance", () => {
    const config = buildRunConfig("story", { storyStageId: "story-6" });
    config.rules.enabledSkills = [...config.rules.enabledSkills, "nova_pulse"];
    const state = buildTutorialHudState(config, undefined, 1_000);

    expect(state?.message).toContain(t("story.tutorial.6"));
    expect(state?.message).toContain(t("skillTutorial.novaPulse.opening"));
  });

  it("keeps guided Story 1 instructions above the Nova opening hint", () => {
    const state = buildTutorialHudState(
      buildRunConfig("story", { storyStageId: "story-1" }),
      undefined,
      1_000,
      { step: "basic_slash" },
    );

    expect(state?.message).toBe(t("story.guided.basic_slash"));
    expect(state?.message).not.toContain(t("skillTutorial.novaPulse.opening"));
  });

  it("teaches Ringed Destroyer ring, body, and core weak-point phases", () => {
    const config = buildRunConfig("bossRush");
    const ring = buildBossHudState([{ type: "ringed_destroyer", boss: true, alive: true, hp: 58, maxHp: 58 }], 1500, 60000);
    const body = buildBossHudState([{ type: "ringed_destroyer", boss: true, alive: true, hp: 20, maxHp: 58 }], 1500, 60000);
    const core = buildBossHudState([{ type: "ringed_destroyer", boss: true, alive: true, hp: 10, maxHp: 58 }], 1500, 60000);

    expect(buildTutorialHudState(config, ring)).toMatchObject({
      tone: "boss",
      title: t("bossRush.tutorial.title"),
      message: t("boss.objective.ringed_destroyer.ring"),
    });
    expect(buildTutorialHudState(config, ring)?.message).not.toContain(t("skillTutorial.novaPulse.opening"));
    expect(buildTutorialHudState(config, body)).toMatchObject({
      tone: "boss",
      title: t("bossRush.tutorial.title"),
      message: t("boss.objective.ringed_destroyer.body"),
    });
    expect(buildTutorialHudState(config, core)).toMatchObject({
      tone: "boss",
      title: t("bossRush.tutorial.title"),
      message: t("boss.objective.ringed_destroyer.core"),
    });
  });
});
