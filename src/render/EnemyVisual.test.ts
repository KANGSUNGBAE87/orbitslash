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
  "fire_meteor",
  "ice_comet",
  "crystal_meteor",
  "shield_rock",
  "electric_meteor",
  "graviton_core",
  "dark_meteor",
  "armored_fragment",
  "eclipse_core",
  "ringed_destroyer",
  "lava_titan",
  "ice_colossus",
  "dark_planet",
];

const shippedEnemyAssets = new Set([
  "./assets/enemies/shard-meteor.png",
  "./assets/enemies/small-meteor.png",
  "./assets/enemies/basic-meteor.png",
  "./assets/enemies/fast-comet.png",
  "./assets/enemies/iron-planet.png",
  "./assets/enemies/directional-comet.png",
  "./assets/enemies/heavy-asteroid.png",
  "./assets/enemies/ancient-planet.png",
  "./assets/enemies/fire-meteor.svg",
  "./assets/enemies/ice-comet.svg",
  "./assets/enemies/crystal-meteor.svg",
  "./assets/enemies/shield-rock.svg",
  "./assets/enemies/electric-meteor.svg",
  "./assets/enemies/graviton-core.svg",
  "./assets/enemies/dark-meteor.svg",
  "./assets/enemies/armored-fragment.svg",
  "./assets/enemies/eclipse-core.png",
  "./assets/enemies/ringed-destroyer.png",
  "./assets/enemies/lava-titan.png",
  "./assets/enemies/ice-colossus.png",
  "./assets/enemies/dark-planet.png",
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
      expect(url).toMatch(/^\.\/assets\/enemies\/.+\.(png|svg)$/);
      expect(shippedEnemyAssets.has(url)).toBe(true);
    }
    expect(enemyAssetUrl("eclipse_core")).toBe("./assets/enemies/eclipse-core.png");
    expect(enemyAssetUrl("unknown")).toBe("./assets/enemies/basic-meteor.png");
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

  it("gives advanced variants readable behavior-coded visual styles", () => {
    expect(enemyVisualStyle("fire_meteor")).toMatchObject({ shape: "comet", fill: 0xff6b2e, rim: 0xffd166 });
    expect(enemyVisualStyle("ice_comet")).toMatchObject({ shape: "comet", fill: 0x7dd3fc, rim: 0xe0f2fe });
    expect(enemyVisualStyle("shield_rock")).toMatchObject({ shape: "asteroid", directionalGuide: false });
    expect(enemyVisualStyle("electric_meteor").sparkleColor).toBe(0xfacc15);
    expect(enemyVisualStyle("graviton_core").rim).toBe(0xc084fc);
    expect(enemyVisualStyle("dark_meteor").fill).toBe(0x0f172a);
    expect(enemyVisualStyle("armored_fragment").crackColor).toBe(0xfcd34d);
  });

  it("marks all boss planets as boss visuals instead of falling back to normal meteors", () => {
    for (const bossType of ["eclipse_core", "ringed_destroyer", "lava_titan", "ice_colossus", "dark_planet"]) {
      expect(enemyVisualStyle(bossType).boss).toBe(true);
    }
  });
});
