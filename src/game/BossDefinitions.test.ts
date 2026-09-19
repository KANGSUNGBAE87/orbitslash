import { describe, expect, it } from "vitest";
import enemiesJson from "../data/enemies.json";
import { BOSS_DEFINITIONS, BOSS_IDS } from "./BossDefinitions";
import type { EnemyTable } from "./types";

const enemies = enemiesJson as unknown as EnemyTable;

describe("BossDefinitions", () => {
  it("defines five release boss planets backed by enemy data", () => {
    expect(BOSS_IDS).toHaveLength(5);
    for (const bossId of BOSS_IDS) {
      expect(BOSS_DEFINITIONS[bossId]).toBeDefined();
      expect(enemies[bossId]).toMatchObject({ boss: true, ignoreSpeedScale: true });
    }
  });

  it("keeps the active five-boss roster isolated from future live-ops content", () => {
    expect(BOSS_IDS).toEqual(["eclipse_core", "ringed_destroyer", "lava_titan", "ice_colossus", "dark_planet"]);
    expect(Object.keys(BOSS_DEFINITIONS)).toEqual(BOSS_IDS);
  });

  it("gives every boss phases and weak point metadata", () => {
    for (const bossId of BOSS_IDS) {
      const boss = BOSS_DEFINITIONS[bossId];
      expect(boss.phases.length).toBeGreaterThanOrEqual(2);
      expect(boss.weakPoints.length).toBeGreaterThanOrEqual(1);
      expect(boss.phases[0]?.atHpRatio).toBe(1);
    }
  });

  it("gives release bosses themed attack spawn identities", () => {
    expect(BOSS_DEFINITIONS.eclipse_core.shardPattern?.shardEnemyType).toBe("shard_meteor");
    expect(BOSS_DEFINITIONS.ringed_destroyer.shardPattern?.shardEnemyType).toBe("shard_meteor");
    expect(BOSS_DEFINITIONS.lava_titan.shardPattern?.shardEnemyType).toBe("fire_meteor");
    expect(BOSS_DEFINITIONS.ice_colossus.shardPattern?.shardEnemyType).toBe("ice_comet");
    expect(BOSS_DEFINITIONS.dark_planet.shardPattern?.shardEnemyType).toBe("dark_meteor");
  });

  it("gives every boss an explicit visual theme for weak-point and pattern readability", () => {
    for (const bossId of BOSS_IDS) {
      const theme = BOSS_DEFINITIONS[bossId].visualTheme;
      expect(theme.weakRingColor).toBeGreaterThan(0);
      expect(theme.weakBodyColor).toBeGreaterThan(0);
      expect(theme.weakCoreColor).toBeGreaterThan(0);
      expect(theme.weakHaloColor).toBeGreaterThan(0);
      expect(theme.telegraphColor).toBeGreaterThan(0);
      expect(theme.telegraphAccentColor).toBeGreaterThan(0);
    }
    expect(BOSS_DEFINITIONS.lava_titan.visualTheme.telegraphColor).not.toBe(BOSS_DEFINITIONS.ice_colossus.visualTheme.telegraphColor);
  });
});
