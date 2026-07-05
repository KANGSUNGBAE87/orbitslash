import { describe, expect, it } from "vitest";
import { BASE_HEIGHT, BASE_WIDTH, computeRootFit, computeScale } from "./coords";

describe("responsive root fit", () => {
  it("keeps the 1080x1920 playfield centered in a tall mobile viewport", () => {
    const fit = computeRootFit(390, 844);

    expect(fit.scale).toBe(computeScale(390, 844));
    expect(fit.x).toBeGreaterThanOrEqual(0);
    expect(fit.y).toBeGreaterThanOrEqual(0);
    expect(fit.x + BASE_WIDTH * fit.scale).toBeLessThanOrEqual(390);
    expect(fit.y + BASE_HEIGHT * fit.scale).toBeLessThanOrEqual(844);
  });

  it("respects safe-area insets before centering the scaled root", () => {
    const fit = computeRootFit(430, 932, { top: 54, right: 0, bottom: 34, left: 0 });

    expect(fit.x).toBeGreaterThanOrEqual(0);
    expect(fit.y).toBeGreaterThanOrEqual(54);
    expect(fit.x + BASE_WIDTH * fit.scale).toBeLessThanOrEqual(430);
    expect(fit.y + BASE_HEIGHT * fit.scale).toBeLessThanOrEqual(932 - 34);
  });
});
