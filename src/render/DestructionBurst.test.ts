import { describe, expect, it } from "vitest";
import { DestructionBurst } from "./DestructionBurst";

describe("DestructionBurst", () => {
  it("spawns a particle burst and clears it after its lifetime", () => {
    const burst = new DestructionBurst();
    burst.spawn(100, 120, { radius: 50, particleCount: 10, lifeMs: 120 });

    expect(burst.container.children.length).toBe(1);
    expect(burst.container.children[0]?.children.length).toBeGreaterThanOrEqual(11);

    burst.update(121);
    expect(burst.container.children.length).toBe(0);
  });

  it("uses a larger default burst for Last Save events", () => {
    const normal = new DestructionBurst();
    const lastSave = new DestructionBurst();

    normal.spawn(0, 0, { radius: 40 });
    lastSave.spawn(0, 0, { radius: 40, isLastSave: true });

    expect(lastSave.container.children[0]?.children.length ?? 0).toBeGreaterThan(normal.container.children[0]?.children.length ?? 0);
  });
});
