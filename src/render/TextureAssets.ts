import { Assets, Texture } from "pixi.js";

const TEXTURE_CACHE = new Map<string, Texture>();
const TEXTURE_LOADING = new Map<string, Promise<Texture | undefined>>();
const TEXTURE_FAILED = new Set<string>();

export function textureFromAsset(url: string): Texture | undefined {
  const cached = TEXTURE_CACHE.get(url);
  if (cached) return cached;
  if (TEXTURE_FAILED.has(url)) return undefined;
  void loadTextureForAsset(url);
  return undefined;
}

export async function loadTextureForAsset(url: string): Promise<Texture | undefined> {
  const cached = TEXTURE_CACHE.get(url);
  if (cached) return cached;
  if (TEXTURE_FAILED.has(url)) return undefined;

  const loading = TEXTURE_LOADING.get(url);
  if (loading) return loading;

  const promise = Assets.load<Texture>(url)
    .then((texture) => {
      TEXTURE_CACHE.set(url, texture);
      return texture;
    })
    .catch(() => {
      TEXTURE_FAILED.add(url);
      return undefined;
    })
    .finally(() => {
      TEXTURE_LOADING.delete(url);
    });

  TEXTURE_LOADING.set(url, promise);
  return promise;
}

export async function preloadTextures(urls: readonly string[]): Promise<void> {
  await Promise.all(urls.map((url) => loadTextureForAsset(url)));
}

export function textureAssetReady(url: string): boolean {
  return TEXTURE_CACHE.has(url);
}

export function resetTextureAssetsForTests(): void {
  TEXTURE_CACHE.clear();
  TEXTURE_LOADING.clear();
  TEXTURE_FAILED.clear();
}
