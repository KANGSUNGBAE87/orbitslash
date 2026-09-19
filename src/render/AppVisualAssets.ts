import { preloadTextures } from "./TextureAssets";
import { BOOT_CRITICAL_ASSETS } from "./assets/AssetManifest";
import { assetManifestFor } from "./assets/AssetManifest";
import type { ModeId } from "../game/ModeConfig";

export const APP_SHELL_VISUAL_ASSETS = BOOT_CRITICAL_ASSETS;

export function preloadAppVisualAssets(): Promise<void> {
  return preloadTextures(APP_SHELL_VISUAL_ASSETS);
}

export function runVisualAssetsFor(modeId: ModeId): readonly string[] {
  return assetManifestFor(modeId).requested;
}

export function preloadRunVisualAssets(modeId: ModeId): Promise<void> {
  return preloadTextures(runVisualAssetsFor(modeId));
}
