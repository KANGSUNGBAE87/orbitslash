import { earthAssetUrl } from "../EarthVisual";
import { allEnemyAssetUrls, enemyAssetUrl } from "../EnemyVisual";
import { allSpecialObjectAssetUrls } from "../SpecialVisual";
import { allSkillAssetUrls, skillAssetUrl } from "../SkillVisual";
import type { ModeId } from "../../game/ModeConfig";

export const BOOT_CRITICAL_ASSETS = [earthAssetUrl("core"), earthAssetUrl("shield")] as const;

export interface AssetManifest {
  boot: readonly string[];
  requested: readonly string[];
  deferred: readonly string[];
}

export function assetManifestFor(mode: "boot" | ModeId): AssetManifest {
  const allEnemies = allEnemyAssetUrls();
  const specialAssets = allSpecialObjectAssetUrls();
  const skillAssets = allSkillAssetUrls();
  const allGameplayAssets = [...allEnemies, ...specialAssets, ...skillAssets];
  const bossAssets = [
    enemyAssetUrl("ringed_destroyer"),
    enemyAssetUrl("eclipse_core"),
    enemyAssetUrl("lava_titan"),
    enemyAssetUrl("ice_colossus"),
    enemyAssetUrl("dark_planet"),
  ];
  if (mode === "boot") return { boot: BOOT_CRITICAL_ASSETS, requested: [], deferred: allGameplayAssets };
  if (mode === "bossRush") return requestedManifest(bossAssets, allGameplayAssets);
  if (mode === "story") return requestedManifest([...specialAssets, skillAssetUrl("solar_lance")], allGameplayAssets);
  if (mode === "ranked") return requestedManifest(skillAssets, allGameplayAssets);
  return requestedManifest([...specialAssets, ...skillAssets], allGameplayAssets);
}

function requestedManifest(requested: readonly string[], allGameplayAssets: readonly string[]): AssetManifest {
  const uniqueRequested = [...new Set(requested)];
  return {
    boot: BOOT_CRITICAL_ASSETS,
    requested: uniqueRequested,
    deferred: allGameplayAssets.filter((url) => !uniqueRequested.includes(url)),
  };
}
