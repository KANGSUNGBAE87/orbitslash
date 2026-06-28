import { describe, expect, it } from "vitest";
import { enemyAssetUrl, enemyVisualStyle } from "./EnemyVisual";

describe("enemyVisualStyle", () => {
  it("uses a distinct readable style for directional comet", () => {
    expect(enemyVisualStyle("directional_comet")).toMatchObject({
      shape: "comet",
      directionalGuide: true,
    });
  });

  it("falls back to a meteor style for unknown asset types", () => {
    expect(enemyVisualStyle("unknown")).toMatchObject({
      shape: "meteor",
      directionalGuide: false,
    });
  });

  it("maps enemy types to shipped SVG sprite assets", () => {
    expect(enemyAssetUrl("directional_comet")).toBe("./assets/enemies/directional-comet.svg");
    expect(enemyAssetUrl("unknown")).toBe("./assets/enemies/basic-meteor.svg");
  });
});
