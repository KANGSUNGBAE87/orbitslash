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
});
