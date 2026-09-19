import { describe, expect, it } from "vitest";
import { resolveSolarLanceSnapshot } from "./SolarLanceResolver";

const line = { a: { x: 0, y: 0, t: 0 }, b: { x: 1000, y: 0, t: 1000 } };
const enemy = (id: number, x: number) => ({ id, x, y: 0, radiusPx: 20 });
const special = (id: number, type: "friendlyRescue" | "satellite" | "energyCapsule" | "empMine", x: number) => ({ id, type, x, y: 0, radiusPx: 30 });

describe("resolveSolarLanceSnapshot", () => {
  it("damages only enemies before the first protected object", () => {
    const resolved = resolveSolarLanceSnapshot(line, [enemy(1, 100), enemy(2, 300)], [special(10, "friendlyRescue", 200)]);

    expect(resolved.enemyIds).toEqual([1]);
    expect(resolved.specialObjectIds).toEqual([10]);
    expect(resolved.stop).toMatchObject({ objectId: 10, type: "friendlyRescue" });
    expect(resolved.vfxLine.b.x).toBeCloseTo(200);
  });

  it("uses a protected object as a stable tie break over an enemy at the same line position", () => {
    const resolved = resolveSolarLanceSnapshot(line, [enemy(1, 200)], [special(10, "satellite", 200)]);

    expect(resolved.enemyIds).toEqual([]);
    expect(resolved.specialObjectIds).toEqual([10]);
  });

  it("keeps non-protected specials before the stop but excludes objects behind it", () => {
    const resolved = resolveSolarLanceSnapshot(
      line,
      [enemy(1, 100), enemy(2, 500)],
      [special(20, "energyCapsule", 160), special(10, "friendlyRescue", 300), special(30, "empMine", 400)],
    );

    expect(resolved.enemyIds).toEqual([1]);
    expect(resolved.specialObjectIds).toEqual([20, 10]);
  });
});
