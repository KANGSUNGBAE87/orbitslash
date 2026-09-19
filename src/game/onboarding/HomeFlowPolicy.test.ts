import { describe, expect, it } from "vitest";
import { createFirstSessionState } from "./FirstSessionState";
import { resolveHomePrimaryAction } from "./HomeFlowPolicy";

describe("resolveHomePrimaryAction", () => {
  it("resumes an unfinished guided Story 1 session", () => {
    expect(resolveHomePrimaryAction({ ...createFirstSessionState(), step: "solar_lance" })).toEqual({
      kind: "resume_guided_story",
      storyStageId: "story-1",
      step: "solar_lance",
    });
  });

  it("starts Guided Story 1 for a new player and recommends a mode after completion", () => {
    expect(resolveHomePrimaryAction(createFirstSessionState())).toEqual({ kind: "start_guided_story", storyStageId: "story-1" });
    expect(resolveHomePrimaryAction({ ...createFirstSessionState(), step: "complete", completedAt: "2031-02-03T10:00:00.000Z" })).toEqual({ kind: "open_recommended_mode" });
  });
});
