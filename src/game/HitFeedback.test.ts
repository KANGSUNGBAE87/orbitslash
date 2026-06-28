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

  it("makes closer distance bands visually louder", () => {
    const outer = feedbackForHitBand("outer", cfg);
    const danger = feedbackForHitBand("danger", cfg);

    expect(danger.particleCount).toBeGreaterThan(outer.particleCount);
    expect(danger.labelScale).toBeGreaterThan(outer.labelScale);
  });

  it("marks Last Save as a stronger feedback event", () => {
    expect(feedbackForHitBand("lastSave", cfg)).toMatchObject({
      multiplier: 3.5,
      isLastSave: true,
    });
    expect(feedbackForHitBand("lastSave", cfg).particleCount).toBeGreaterThan(feedbackForHitBand("danger", cfg).particleCount);
  });

  it("falls back to x1.0 for impact or unknown multiplier bands", () => {
    expect(feedbackForHitBand("impact", cfg).multiplier).toBe(1.0);
  });
});
