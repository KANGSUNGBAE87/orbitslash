import { describe, expect, it } from "vitest";
import { assetManifestFor, BOOT_CRITICAL_ASSETS } from "./AssetManifest";

describe("AssetManifest", () => {
  it("keeps boot limited to the Earth and home-critical assets", () => {
    expect(BOOT_CRITICAL_ASSETS).toHaveLength(2);
    expect(BOOT_CRITICAL_ASSETS.every((url) => url.includes("/earth/"))).toBe(true);
  });

  it("defers boss assets until a boss-containing run is requested", () => {
    expect(assetManifestFor("boot").deferred.some((url) => url.includes("ringed-destroyer"))).toBe(true);
    expect(assetManifestFor("bossRush").requested.some((url) => url.includes("ringed-destroyer"))).toBe(true);
  });

  it("preloads the special-object and skill visual sets before gameplay modes need them", () => {
    const freeDefense = assetManifestFor("freeDefense");
    expect(freeDefense.requested.some((url) => url.includes("/special/"))).toBe(true);
    expect(freeDefense.requested.some((url) => url.includes("/skills/"))).toBe(true);
    expect(assetManifestFor("boot").deferred.some((url) => url.includes("/special/"))).toBe(true);
  });
});
