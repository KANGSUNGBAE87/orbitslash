import { describe, expect, it } from "vitest";
import { BOSS_IDS } from "../game/BossDefinitions";
import { APP_SHELL_VISUAL_ASSETS } from "./AppVisualAssets";
import { earthAssetUrl } from "./EarthVisual";
import { allEnemyAssetUrls, enemyAssetUrl } from "./EnemyVisual";

describe("APP_SHELL_VISUAL_ASSETS", () => {
  it("preloads Earth plus every shipped enemy and boss asset", () => {
    expect(APP_SHELL_VISUAL_ASSETS).toContain(earthAssetUrl("core"));
    expect(APP_SHELL_VISUAL_ASSETS).toContain(earthAssetUrl("shield"));

    for (const url of allEnemyAssetUrls()) {
      expect(APP_SHELL_VISUAL_ASSETS).toContain(url);
    }

    const fallbackUrl = enemyAssetUrl("__missing_enemy_asset__");
    for (const bossId of BOSS_IDS) {
      const bossAssetUrl = enemyAssetUrl(bossId);
      expect(bossAssetUrl).not.toBe(fallbackUrl);
      expect(APP_SHELL_VISUAL_ASSETS).toContain(bossAssetUrl);
    }
  });

  it("does not contain duplicate preload URLs", () => {
    expect(new Set(APP_SHELL_VISUAL_ASSETS).size).toBe(APP_SHELL_VISUAL_ASSETS.length);
  });
});
