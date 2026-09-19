import { describe, expect, it } from "vitest";
import { BASE_WIDTH, EARTH_CENTER_Y } from "./coords";
import { createRng } from "./Rng";
import { SpecialObjectRuntime } from "./SpecialObjectRuntime";
import type { SpecialObjectPolicy } from "./ModeConfig";

const policy: SpecialObjectPolicy = {
  friendlyRescue: true,
  satellite: true,
  energyCapsule: true,
  empMine: true,
};

describe("SpecialObjectRuntime", () => {
  it("defers an overdue schedule without creating an active object", () => {
    const runtime = new SpecialObjectRuntime(createRng(1), policy, {
      firstSpawnMs: 12_000,
      spawnIntervalMs: 14_000,
      maxActive: 1,
    });

    runtime.deferUntil(12_000);

    expect(runtime.getAlive()).toEqual([]);
    expect(runtime.next(25_999, { energy: 100, maxEnergy: 100 })).toEqual([]);
    expect(runtime.next(26_000, { energy: 100, maxEnergy: 100 })).toHaveLength(1);
  });

  it("spawns only objects enabled by mode policy and prioritizes capsules when energy is low", () => {
    const runtime = new SpecialObjectRuntime(createRng(1), policy, {
      firstSpawnMs: 1000,
      spawnIntervalMs: 1000,
      maxActive: 1,
    });

    expect(runtime.next(999, { energy: 40, maxEnergy: 100 })).toEqual([]);

    const spawned = runtime.next(1000, { energy: 40, maxEnergy: 100 });

    expect(spawned).toHaveLength(1);
    expect(spawned[0]?.type).toBe("energyCapsule");
    expect(runtime.getAlive()).toHaveLength(1);
  });

  it("applies a hit effect once and removes the object from the active set", () => {
    const runtime = new SpecialObjectRuntime(createRng(2), policy, {
      firstSpawnMs: 1000,
      spawnIntervalMs: 1000,
      maxActive: 1,
      forcedTypes: ["satellite"],
    });
    const [object] = runtime.next(1000, { energy: 100, maxEnergy: 100 });

    const effect = runtime.applyHit(object!.id);

    expect(effect).toMatchObject({ kind: "penalty", damage: 8, comboBreak: true });
    expect(runtime.applyHit(object!.id)).toBeNull();
    expect(runtime.getAlive()).toEqual([]);
  });

  it("returns a rescue bonus when friendly rescue expires uncut", () => {
    const runtime = new SpecialObjectRuntime(createRng(3), policy, {
      firstSpawnMs: 1000,
      spawnIntervalMs: 1000,
      maxActive: 1,
      forcedTypes: ["friendlyRescue"],
    });
    const [object] = runtime.next(1000, { energy: 100, maxEnergy: 100 });

    const expired = runtime.expire(object!.expiresAtMs + 1);

    expect(expired).toEqual([{ id: object!.id, type: "friendlyRescue", score: 80, gauge: 5 }]);
    expect(runtime.getAlive()).toEqual([]);
  });

  it("returns protected-object rewards when satellites or capsules expire uncut", () => {
    const runtime = new SpecialObjectRuntime(createRng(4), policy, {
      firstSpawnMs: 1000,
      spawnIntervalMs: 1000,
      maxActive: 2,
      forcedTypes: ["satellite", "energyCapsule"],
    });
    const [satellite] = runtime.next(1000, { energy: 100, maxEnergy: 100 });
    const [capsule] = runtime.next(2600, { energy: 100, maxEnergy: 100 });

    const expired = runtime.expire(Math.max(satellite!.expiresAtMs, capsule!.expiresAtMs) + 1);

    expect(expired).toEqual([
      { id: satellite!.id, type: "satellite", score: 120, gauge: 6 },
      { id: capsule!.id, type: "energyCapsule", score: 60, gauge: 14, heal: 14 },
    ]);
    expect(runtime.getAlive()).toEqual([]);
  });

  it("moves friendly rescue objects gently toward earth", () => {
    const runtime = new SpecialObjectRuntime(createRng(5), policy, {
      firstSpawnMs: 1000,
      spawnIntervalMs: 1000,
      maxActive: 1,
      forcedTypes: ["friendlyRescue"],
    });
    const [object] = runtime.next(1000, { energy: 100, maxEnergy: 100 });
    const beforeDistance = Math.hypot(object!.x - BASE_WIDTH / 2, object!.y - EARTH_CENTER_Y);

    runtime.step(4000);

    const afterDistance = Math.hypot(object!.x - BASE_WIDTH / 2, object!.y - EARTH_CENTER_Y);
    expect(object!.motion.kind).toBe("rescueDrift");
    expect(afterDistance).toBeLessThan(beforeDistance);
    expect(object!.previousX).not.toBe(object!.x);
  });

  it("orbits satellites while leaving capsules and mines static", () => {
    const satelliteRuntime = new SpecialObjectRuntime(createRng(6), policy, {
      firstSpawnMs: 1000,
      forcedTypes: ["satellite"],
    });
    const [satellite] = satelliteRuntime.next(1000, { energy: 100, maxEnergy: 100 });
    const startSatellite = { x: satellite!.x, y: satellite!.y };

    satelliteRuntime.step(3500);

    expect(satellite!.motion.kind).toBe("satelliteOrbit");
    expect(Math.hypot(satellite!.x - startSatellite.x, satellite!.y - startSatellite.y)).toBeGreaterThan(8);

    const staticRuntime = new SpecialObjectRuntime(createRng(7), policy, {
      firstSpawnMs: 1000,
      spawnIntervalMs: 1000,
      maxActive: 2,
      forcedTypes: ["energyCapsule", "empMine"],
    });
    const [capsule] = staticRuntime.next(1000, { energy: 100, maxEnergy: 100 });
    const [mine] = staticRuntime.next(2600, { energy: 100, maxEnergy: 100 });
    const before = [
      { x: capsule!.x, y: capsule!.y },
      { x: mine!.x, y: mine!.y },
    ];

    staticRuntime.step(5000);

    expect(capsule!.motion.kind).toBe("static");
    expect(mine!.motion.kind).toBe("static");
    expect({ x: capsule!.x, y: capsule!.y }).toEqual(before[0]);
    expect({ x: mine!.x, y: mine!.y }).toEqual(before[1]);
  });
});
