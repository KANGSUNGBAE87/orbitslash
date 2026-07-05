import { earthAssetUrl } from "./EarthVisual";
import { allEnemyAssetUrls } from "./EnemyVisual";
import { preloadTextures } from "./TextureAssets";

export const APP_SHELL_VISUAL_ASSETS = [
  earthAssetUrl("core"),
  earthAssetUrl("shield"),
  ...allEnemyAssetUrls(),
] as const;

export function preloadAppVisualAssets(): Promise<void> {
  return preloadTextures(APP_SHELL_VISUAL_ASSETS);
}
