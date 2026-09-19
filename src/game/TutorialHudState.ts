import type { BossHudState } from "./BossHudState";
import type { RunConfig } from "./ModeConfig";
import { activeStoryStageForConfig } from "./ModeObjectiveSystem";
import { t } from "../i18n";
import type { TutorialFlowState } from "./onboarding/TutorialFlow";

export interface TutorialHudState {
  title: string;
  message: string;
  tone: "story" | "boss" | "warning";
}

export const SKILL_TUTORIAL_DURATION_MS = 12_000;

export function buildTutorialHudState(config: RunConfig, boss?: BossHudState, elapsedMs = Infinity, guidedFlow?: TutorialFlowState): TutorialHudState | undefined {
  const skillTutorial = buildSkillTutorialState(config, elapsedMs);

  if (config.modeId === "story") {
    const stage = activeStoryStageForConfig(config);
    if (!stage) {
      return {
        title: t("story.tutorial.label"),
        message: t("story.tutorial.missing"),
        tone: "warning",
      };
    }
    if (stage.id === "story-1" && guidedFlow) {
      return {
        title: `${t(stage.labelKey)} · ${t("story.tutorial.label")}`,
        message: t(`story.guided.${guidedFlow.step}`),
        tone: "story",
      };
    }
    return {
      title: `${t(stage.labelKey)} · ${t("story.tutorial.label")}`,
      message: skillTutorial ? `${t(stage.tutorialKey)}\n${skillTutorial.message}` : t(stage.tutorialKey),
      tone: "story",
    };
  }

  if (config.modeId !== "bossRush") return skillTutorial;

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
    message: skillTutorial ? `${t("bossRush.tutorial.prepare")}\n${skillTutorial.message}` : t("bossRush.tutorial.prepare"),
    tone: "boss",
  };
}

function buildSkillTutorialState(config: RunConfig, elapsedMs: number): TutorialHudState | undefined {
  if (elapsedMs > SKILL_TUTORIAL_DURATION_MS) return undefined;
  if (config.rules.enabledSkills.length === 0) return undefined;
  return {
    title: t("skillTutorial.title"),
    message: config.rules.enabledSkills.includes("nova_pulse")
      ? t("skillTutorial.novaPulse.opening")
      : t("skillTutorial.summary"),
    tone: "story",
  };
}
