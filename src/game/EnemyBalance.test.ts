import { describe, expect, it } from "vitest";
import enemiesJson from "../data/enemies.json";

const enemies = enemiesJson;

describe("enemy balance data", () => {
  it("defines eight normal enemy tiers plus the boss placeholder", () => {
    expect(Object.keys(enemies)).toEqual([
      "shard_meteor",
      "small_meteor",
      "basic_meteor",
      "fast_comet",
      "iron_planet",
      "directional_comet",
      "heavy_asteroid",
      "ancient_planet",
      "eclipse_core",
    ]);
  });

  it("uses odd-number HP tiers so enemies survive quick casual cuts", () => {
    expect(enemies.shard_meteor.hp).toBe(1);
    expect(enemies.small_meteor.hp).toBe(3);
    expect(enemies.basic_meteor.hp).toBe(5);
    expect(enemies.fast_comet.hp).toBe(7);
    expect(enemies.iron_planet.hp).toBe(9);
    expect(enemies.directional_comet.hp).toBe(11);
    expect(enemies.heavy_asteroid.hp).toBe(13);
    expect(enemies.ancient_planet.hp).toBe(15);
  });

  it("keeps boss as a 50-hit oversized scaffold with fixed speed", () => {
    expect(enemies.eclipse_core.boss).toBe(true);
    expect(enemies.eclipse_core.ignoreSpeedScale).toBe(true);
    expect(enemies.eclipse_core.hp).toBe(50);
    expect(enemies.eclipse_core.radiusPx).toBeGreaterThan(enemies.ancient_planet.radiusPx);
    expect(enemies.eclipse_core.radiusPx).toBeGreaterThanOrEqual(340);
    expect(enemies.eclipse_core.approachSpeed).toBe(24);
  });
});
