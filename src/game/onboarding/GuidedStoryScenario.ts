import type { StoryStageId } from "../ModeConfig";
import type { TutorialStep } from "./TutorialFlow";

export interface GuidedStoryScenarioStep {
  step: Exclude<TutorialStep, "reward" | "complete">;
  target: "basic_meteor" | "last_save_meteor" | "solar_line";
  count: number;
  startRadius?: number;
}

export function guidedStoryScenario(stageId: StoryStageId): GuidedStoryScenarioStep[] {
  if (stageId !== "story-1") return [];
  return [
    { step: "basic_slash", target: "basic_meteor", count: 1 },
    { step: "last_save", target: "last_save_meteor", count: 1, startRadius: 300 },
    { step: "solar_lance", target: "solar_line", count: 2 },
  ];
}
