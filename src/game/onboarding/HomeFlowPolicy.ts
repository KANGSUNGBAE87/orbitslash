import type { FirstSessionState } from "./FirstSessionState";

export type HomePrimaryAction =
  | { kind: "start_guided_story"; storyStageId: "story-1" }
  | { kind: "resume_guided_story"; storyStageId: "story-1"; step: FirstSessionState["step"] }
  | { kind: "open_recommended_mode" };

export function resolveHomePrimaryAction(firstSession: FirstSessionState): HomePrimaryAction {
  if (firstSession.step === "not_started") return { kind: "start_guided_story", storyStageId: "story-1" };
  if (firstSession.step === "complete") return { kind: "open_recommended_mode" };
  return { kind: "resume_guided_story", storyStageId: "story-1", step: firstSession.step };
}
