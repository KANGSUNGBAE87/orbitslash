import { describe, expect, it } from "vitest";
import { APP_SHELL_VISUAL_ASSETS, runVisualAssetsFor } from "./AppVisualAssets";
import { earthAssetUrl } from "./EarthVisual";
import { assetManifestFor } from "./assets/AssetManifest";

describe("APP_SHELL_VISUAL_ASSETS", () => {
  it("preloads only boot-critical Earth assets and defers enemy textures", () => {
    expect(APP_SHELL_VISUAL_ASSETS).toContain(earthAssetUrl("core"));
    expect(APP_SHELL_VISUAL_ASSETS).toContain(earthAssetUrl("shield"));

    expect(assetManifestFor("boot").deferred.length).toBeGreaterThan(0);
  });

  it("does not contain duplicate preload URLs", () => {
    expect(new Set(APP_SHELL_VISUAL_ASSETS).size).toBe(APP_SHELL_VISUAL_ASSETS.length);
  });

  it("keeps gameplay-context visual assets out of boot and ready before Free Defense starts", () => {
    expect(runVisualAssetsFor("freeDefense").some((url) => url.includes("/special/"))).toBe(true);
    expect(runVisualAssetsFor("freeDefense").some((url) => url.includes("/skills/"))).toBe(true);
  });
});
