import { describe, expect, it } from "vitest";
import { HitBurst } from "./HitBurst";

describe("HitBurst", () => {
  it("clear removes active burst objects", () => {
    const burst = new HitBurst();
    burst.spawn(100, 100, "x2.2", 0xffc14d, 46);

    expect(burst.container.children.length).toBe(1);
    burst.clear();
    expect(burst.container.children.length).toBe(0);
  });

  it("clears expired bursts during update", () => {
    const burst = new HitBurst();
    burst.spawn(100, 100, "x3.5", 0x3fd8ff, 64, true, { lifeMs: 120, labelScale: 1.25 });

    burst.update(121);
    expect(burst.container.children.length).toBe(0);
  });
});
