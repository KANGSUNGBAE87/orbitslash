import type { DistanceBand } from "../types";
import type { SkillId } from "../ModeConfig";

export type TutorialStep = "basic_slash" | "last_save" | "solar_lance" | "reward" | "complete";

export interface TutorialFlowState {
  step: TutorialStep;
}

export type TutorialSignal =
  | { type: "slash_committed" }
  | { type: "enemy_killed"; band: DistanceBand }
  | { type: "skill_fired"; skillId: SkillId }
  | { type: "reward_claimed" };

export function createGuidedTutorialFlow(initialStep: TutorialStep = "basic_slash"): TutorialFlowState {
  return { step: initialStep };
}

export function reduceTutorialFlow(flow: TutorialFlowState, signal: TutorialSignal): TutorialFlowState {
  if (flow.step === "basic_slash" && signal.type === "slash_committed") return { step: "last_save" };
  if (flow.step === "last_save" && signal.type === "enemy_killed" && signal.band === "lastSave") return { step: "solar_lance" };
  if (flow.step === "solar_lance" && signal.type === "skill_fired" && signal.skillId === "solar_lance") return { step: "reward" };
  if (flow.step === "reward" && signal.type === "reward_claimed") return { step: "complete" };
  return flow;
}
