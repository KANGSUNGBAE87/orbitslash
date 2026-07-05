import { describe, expect, it } from "vitest";
import enemiesJson from "../data/enemies.json";
import type { EnemyTable } from "./types";

const enemies = enemiesJson as unknown as typeof enemiesJson & EnemyTable;

describe("enemy balance data", () => {
  it("defines the normal tiers, advanced variants, and five boss planets", () => {
    expect(Object.keys(enemies)).toEqual([
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

  it("adds authored behavior metadata for advanced enemy variants", () => {
    expect(enemies.fire_meteor).toMatchObject({ attribute: "fire", behavior: "burn" });
    expect(enemies.ice_comet).toMatchObject({ attribute: "ice", behavior: "split", splitInto: "shard_meteor", splitCount: 3 });
    expect(enemies.crystal_meteor).toMatchObject({ attribute: "crystal", behavior: "precision_bonus", precisionBonus: true });
    expect(enemies.shield_rock).toMatchObject({ attribute: "metal", behavior: "shield", shieldHits: 2 });
    expect(enemies.electric_meteor).toMatchObject({ attribute: "electric", behavior: "emp", empOnWrongHit: true });
    expect(enemies.graviton_core).toMatchObject({ attribute: "gravity", behavior: "orbit_pull" });
    expect(enemies.graviton_core.gravityPullRadiusPx).toBeGreaterThan(0);
    expect(enemies.dark_meteor).toMatchObject({ attribute: "dark", behavior: "hidden", visibility: "dangerOnly" });
    expect(enemies.armored_fragment).toMatchObject({ attribute: "armored", behavior: "armor", armorHits: 2 });
  });

  it("keeps advanced variants between normal enemies and bosses", () => {
    const advancedIds = [
      "fire_meteor",
      "ice_comet",
      "crystal_meteor",
      "shield_rock",
      "electric_meteor",
      "graviton_core",
      "dark_meteor",
      "armored_fragment",
    ] as const;

    for (const id of advancedIds) {
      const def = enemies[id as string] as EnemyTable[string];
      expect(def.boss).not.toBe(true);
      expect(def.radiusPx).toBeGreaterThanOrEqual(enemies.fast_comet.radiusPx);
      expect(def.radiusPx).toBeLessThan(enemies.eclipse_core.radiusPx);
      expect(def.score).toBeGreaterThan(enemies.fast_comet.score);
    }
  });

  it("keeps eclipse core as the first 50-hit oversized boss with fixed speed", () => {
    expect(enemies.eclipse_core.boss).toBe(true);
    expect(enemies.eclipse_core.ignoreSpeedScale).toBe(true);
    expect(enemies.eclipse_core.hp).toBe(50);
    expect(enemies.eclipse_core.radiusPx).toBeGreaterThan(enemies.ancient_planet.radiusPx);
    expect(enemies.eclipse_core.radiusPx).toBeGreaterThanOrEqual(340);
    expect(enemies.eclipse_core.approachSpeed).toBe(24);
  });

  it("keeps later bosses larger than normal enemies and speed-scale independent", () => {
    for (const bossId of ["ringed_destroyer", "lava_titan", "ice_colossus", "dark_planet"] as const) {
      const boss = enemies[bossId];
      expect(boss.boss).toBe(true);
      expect(boss.ignoreSpeedScale).toBe(true);
      expect(boss.radiusPx).toBeGreaterThan(enemies.ancient_planet.radiusPx);
      expect(boss.approachSpeed).toBeLessThanOrEqual(enemies.eclipse_core.approachSpeed);
    }
  });
});
