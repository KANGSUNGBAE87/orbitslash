import { describe, expect, it } from "vitest";
import enemiesJson from "../../data/enemies.json";
import difficultyJson from "../../data/difficulty.json";
import { EARTH_ENEMY_IMPACT_RADIUS_PX, EARTH_GAMEPLAY_RADIUS } from "../coords";
import { guidedStoryScenario } from "./GuidedStoryScenario";

describe("guidedStoryScenario", () => {
  it("keeps Story 1 limited to slash, Last Save, then Solar Lance", () => {
    expect(guidedStoryScenario("story-1")).toEqual([
      { step: "basic_slash", target: "basic_meteor", count: 1 },
      { step: "last_save", target: "last_save_meteor", count: 1, startRadius: 300 },
      { step: "solar_lance", target: "solar_line", count: 2 },
    ]);
  });

  it("keeps the moving Last Save target visible for at least 2.5 seconds before impact", () => {
    const scenario = guidedStoryScenario("story-1").find((entry) => entry.step === "last_save");
    const impactRadius = difficultyJson.zones.impact * EARTH_GAMEPLAY_RADIUS + EARTH_ENEMY_IMPACT_RADIUS_PX;
    const visibleMs = (((scenario?.startRadius ?? 0) - impactRadius) / enemiesJson.basic_meteor.approachSpeed) * 1000;

    expect(enemiesJson.basic_meteor.approachSpeed).toBeGreaterThan(0);
    expect(visibleMs).toBeGreaterThanOrEqual(2500);
  });

  it("does not override later Story stages", () => {
    expect(guidedStoryScenario("story-2")).toEqual([]);
  });
});
