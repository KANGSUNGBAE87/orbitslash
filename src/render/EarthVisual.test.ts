import { describe, expect, it } from "vitest";
import { earthAssetUrl } from "./EarthVisual";

describe("EarthVisual", () => {
  it("maps Earth core and shield to shipped PNG assets", () => {
    expect(earthAssetUrl("core")).toBe("./assets/earth/earth-core.png");
    expect(earthAssetUrl("shield")).toBe("./assets/earth/earth-shield.png");
  });
});
