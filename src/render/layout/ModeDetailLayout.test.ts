import { describe, expect, it } from "vitest";
import { modeDetailLayout, rectsOverlap } from "./ModeDetailLayout";

describe("Free Defense mobile mode-detail layout", () => {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ]) {
    it(`keeps controls readable at ${viewport.width}x${viewport.height}`, () => {
      const layout = modeDetailLayout(viewport, "freeDefense");

      expect(rectsOverlap(layout.body, layout.difficultyControls)).toBe(false);
      expect(rectsOverlap(layout.difficultyControls, layout.practiceControls)).toBe(false);
      expect(rectsOverlap(layout.practiceControls, layout.bossControls)).toBe(false);
      expect(rectsOverlap(layout.bossControls, layout.start)).toBe(false);
      expect(rectsOverlap(layout.start, layout.secondaryActions)).toBe(false);
      expect(layout.minimumCssTouchHeight).toBeGreaterThanOrEqual(48);
      expect(layout.start.y + layout.start.h).toBeLessThanOrEqual(1920 - 90);
      expect(layout.secondaryActions.y + layout.secondaryActions.h).toBeLessThanOrEqual(1920 - 90);
    });
  }

  it("derives control size from the actual short viewport and safe area", () => {
    const full = modeDetailLayout({ width: 360, height: 800 }, "freeDefense");
    const constrained = modeDetailLayout(
      { width: 272, height: 520, safeArea: { top: 24, right: 0, bottom: 20, left: 0 } },
      "freeDefense",
    );

    expect(constrained.rootFitScale).toBeLessThan(full.rootFitScale);
    expect(constrained.start.h).toBeGreaterThan(full.start.h);
    expect(constrained.minimumCssTouchHeight).toBeGreaterThanOrEqual(48);
    expect(rectsOverlap(constrained.bossControls, constrained.start)).toBe(false);
  });
});
