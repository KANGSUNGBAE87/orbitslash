import type { BossHudState } from "./BossHudState";
import type { RunConfig } from "./ModeConfig";
import { activeStoryStageForConfig } from "./ModeObjectiveSystem";
import { t } from "../i18n";

export interface TutorialHudState {
  title: string;
  message: string;
  tone: "story" | "boss" | "warning";
}

export function buildTutorialHudState(config: RunConfig, boss?: BossHudState): TutorialHudState | undefined {
  if (config.modeId === "story") {
    const stage = activeStoryStageForConfig(config);
    if (!stage) {
      return {
        title: t("story.tutorial.label"),
        message: t("story.tutorial.missing"),
        tone: "warning",
      };
    }
    return {
      title: `${t(stage.labelKey)} · ${t("story.tutorial.label")}`,
      message: t(stage.tutorialKey),
      tone: "story",
    };
  }

  if (config.modeId !== "bossRush") return undefined;

  if (boss?.active) {
    return {
      title: t("bossRush.tutorial.title"),
      message: t(boss.objectiveKey ?? "bossRush.tutorial.weakPoint"),
      tone: "boss",
    };
  }

  if (boss?.warning) {
    return {
      title: t("bossRush.tutorial.incomingTitle"),
      message: t("bossRush.tutorial.incoming"),
      tone: "warning",
    };
  }

  return {
    title: t("bossRush.tutorial.title"),
    message: t("bossRush.tutorial.prepare"),
    tone: "boss",
  };
}
