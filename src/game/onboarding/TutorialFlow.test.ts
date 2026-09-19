import { describe, expect, it } from "vitest";
import { createGuidedTutorialFlow, reduceTutorialFlow } from "./TutorialFlow";

describe("Guided TutorialFlow", () => {
  it("teaches slash, Last Save, and Solar Lance in order", () => {
    let flow = createGuidedTutorialFlow();
    flow = reduceTutorialFlow(flow, { type: "slash_committed" });
    expect(flow.step).toBe("last_save");
    flow = reduceTutorialFlow(flow, { type: "enemy_killed", band: "lastSave" });
    expect(flow.step).toBe("solar_lance");
    flow = reduceTutorialFlow(flow, { type: "skill_fired", skillId: "solar_lance" });
    expect(flow.step).toBe("reward");
  });

  it("does not advance on an unrelated signal or duplicate event", () => {
    const flow = createGuidedTutorialFlow();
    expect(reduceTutorialFlow(flow, { type: "enemy_killed", band: "lastSave" })).toEqual(flow);
  });
});
