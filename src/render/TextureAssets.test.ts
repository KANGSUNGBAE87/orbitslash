import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("pixi.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("pixi.js")>();
  return {
    ...actual,
    Assets: {
      ...actual.Assets,
      load: vi.fn(),
    },
  };
});

import { Assets, Texture } from "pixi.js";
import { loadTextureForAsset, preloadTextures, resetTextureAssetsForTests, textureFromAsset } from "./TextureAssets";

const loadMock = vi.mocked(Assets.load);

describe("TextureAssets", () => {
  beforeEach(() => {
    resetTextureAssetsForTests();
    loadMock.mockReset();
  });

  it("loads an asset once and then serves it from cache", async () => {
    loadMock.mockResolvedValue(Texture.EMPTY as never);

    expect(textureFromAsset("./assets/enemies/basic-meteor.png")).toBeUndefined();
    expect(loadMock).toHaveBeenCalledTimes(1);

    await loadTextureForAsset("./assets/enemies/basic-meteor.png");

    expect(textureFromAsset("./assets/enemies/basic-meteor.png")).toBe(Texture.EMPTY);
    expect(loadMock).toHaveBeenCalledTimes(1);
  });

  it("records failed assets so a bad path does not retry every frame", async () => {
    loadMock.mockRejectedValue(new Error("missing"));

    await loadTextureForAsset("./assets/enemies/missing.png");
    expect(textureFromAsset("./assets/enemies/missing.png")).toBeUndefined();

    await preloadTextures(["./assets/enemies/missing.png"]);

    expect(loadMock).toHaveBeenCalledTimes(1);
  });
});
