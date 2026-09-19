import { describe, expect, it } from "vitest";
import { preloadWithConcurrency } from "./AssetPreloader";

describe("preloadWithConcurrency", () => {
  it("limits concurrent requested loads", async () => {
    let active = 0;
    let peak = 0;
    await preloadWithConcurrency([1, 2, 3, 4, 5], 2, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
    });

    expect(peak).toBeLessThanOrEqual(2);
  });
});
