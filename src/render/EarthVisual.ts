import { Texture } from "pixi.js";
import { loadTextureForAsset, preloadTextures, textureFromAsset } from "./TextureAssets";

export type EarthAssetKind = "core" | "shield";

const EARTH_ASSETS: Record<EarthAssetKind, string> = {
  core: "./assets/earth/earth-core.png",
  shield: "./assets/earth/earth-shield.png",
};

export function earthAssetUrl(kind: EarthAssetKind): string {
  return EARTH_ASSETS[kind];
}

export function earthTexture(kind: EarthAssetKind): Texture | undefined {
  return textureFromAsset(earthAssetUrl(kind));
}

export function preloadEarthTextures(kinds: readonly EarthAssetKind[] = ["core", "shield"]): Promise<void> {
  return preloadTextures(kinds.map((kind) => earthAssetUrl(kind)));
}

export function loadEarthTexture(kind: EarthAssetKind): Promise<Texture | undefined> {
  return loadTextureForAsset(earthAssetUrl(kind));
}
