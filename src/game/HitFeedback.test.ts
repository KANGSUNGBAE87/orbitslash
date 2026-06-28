import { describe, expect, it } from "vitest";
import { feedbackForHitBand } from "./HitFeedback";
import scoringJson from "../data/scoring.json";
import type { ScoringConfig } from "./types";

const cfg = scoringJson as unknown as ScoringConfig;

describe("feedbackForHitBand", () => {
  it("shows the distance multiplier for normal scoring bands", () => {
    expect(feedbackForHitBand("danger", cfg)).toMatchObject({
      multiplier: 2.2,
      isLastSave: false,
    });
  });

  it("marks Last Save as a stronger feedback event", () => {
    expect(feedbackForHitBand("lastSave", cfg)).toMatchObject({
      multiplier: 3.5,
      isLastSave: true,
    });
  });

  it("falls back to x1.0 for impact or unknown multiplier bands", () => {
    expect(feedbackForHitBand("impact", cfg).multiplier).toBe(1.0);
  });
});
