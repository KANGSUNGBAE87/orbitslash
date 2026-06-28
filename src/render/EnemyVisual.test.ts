import { describe, expect, it } from "vitest";
import { enemyAssetUrl, enemyVisualStyle } from "./EnemyVisual";

const enemyTypes = [
  "shard_meteor",
  "small_meteor",
  "basic_meteor",
  "fast_comet",
  "iron_planet",
  "directional_comet",
  "heavy_asteroid",
  "ancient_planet",
  "eclipse_core",
];

const shippedEnemyAssets = new Set([
  "./assets/enemies/shard-meteor.svg",
  "./assets/enemies/small-meteor.svg",
  "./assets/enemies/basic-meteor.svg",
  "./assets/enemies/fast-comet.svg",
  "./assets/enemies/iron-planet.svg",
  "./assets/enemies/directional-comet.svg",
  "./assets/enemies/heavy-asteroid.svg",
  "./assets/enemies/ancient-planet.svg",
  "./assets/enemies/eclipse-core.png",
]);

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

  it("maps every enemy type to a shipped unique visual asset", () => {
    const urls = enemyTypes.map((type) => enemyAssetUrl(type));
    expect(new Set(urls).size).toBe(enemyTypes.length);
    for (const url of urls) {
      expect(url).toMatch(/^\.\/assets\/enemies\/.+\.(svg|png)$/);
      expect(shippedEnemyAssets.has(url)).toBe(true);
    }
    expect(enemyAssetUrl("eclipse_core")).toBe("./assets/enemies/eclipse-core.png");
    expect(enemyAssetUrl("unknown")).toBe("./assets/enemies/basic-meteor.svg");
  });

  it("gives heavy enemies and the boss stronger damage readability tokens", () => {
    expect(enemyVisualStyle("iron_planet").crackColor).toBe(0x93c5fd);
    expect(enemyVisualStyle("ancient_planet").sparkleColor).toBe(0xfbbf24);
    expect(enemyVisualStyle("eclipse_core")).toMatchObject({
      boss: true,
      crackColor: 0xff5a2e,
      sparkleColor: 0xffc14d,
    });
  });
});
