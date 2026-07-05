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

  it("returns no tutorial for Free Defense", () => {
    expect(buildTutorialHudState(buildRunConfig("freeDefense"))).toBeUndefined();
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
