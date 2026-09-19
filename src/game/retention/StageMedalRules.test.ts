import { describe, expect, it } from "vitest";
import { bestMedal, evaluateMedal } from "./StageMedalRules";

describe("Stage medals", () => {
  it("never downgrades a stage medal", () => {
    expect(bestMedal("gold", evaluateMedal({ cleared: true, score: 1, remainingEnergy: 0, maxCombo: 0 }, { silverScore: 100, goldScore: 200 }))).toBe("gold");
  });

  it("awards Bronze for a clear and higher medals for mastery thresholds", () => {
    expect(evaluateMedal({ cleared: true, score: 220, remainingEnergy: 80, maxCombo: 6 }, { silverScore: 100, goldScore: 200, goldEnergy: 50, goldCombo: 5 })).toBe("gold");
  });
});
