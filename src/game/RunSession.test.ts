import { describe, expect, it } from "vitest";
import { RunSession } from "./RunSession";

describe("RunSession", () => {
  it("collects a submit-ready run summary from scoring and skill counters", () => {
    const session = new RunSession({ difficulty: "rookie", runToken: "local-42", seed: 42 });
    session.recordSkillUse("solar_lance");
    session.recordSkillUse("gravity_slow");

    const summary = session.finish({
      survivalMs: 65000,
      score: 9000,
      kills: 24,
      maxCombo: 8,
      lastSaveCount: 2,
      remainingEnergy: 61,
    });

    expect(summary).toMatchObject({
      runToken: "local-42",
      seed: 42,
      difficulty: "rookie",
      skillUse: { solar_lance: 1, gravity_slow: 1 },
    });
  });
});
