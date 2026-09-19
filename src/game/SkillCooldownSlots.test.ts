import { describe, expect, it } from "vitest";
import { buildSkillCooldownSlots } from "./SkillCooldownSlots";

describe("buildSkillCooldownSlots", () => {
  it("does not show gauge progress on inactive future slots", () => {
    const slots = buildSkillCooldownSlots(
      [
        { id: "solar_lance", label: "솔", cost: 80, cooldownSec: 12, active: true },
        { id: "reserve_slot", label: "예", cost: 100, cooldownSec: 0, active: false },
      ],
      () => 80,
      () => 0,
    );

    expect(slots[0]).toMatchObject({ id: "solar_lance", ratio: 1, ready: true });
    expect(slots[1]).toMatchObject({ id: "reserve_slot", ratio: 0, ready: false, visualState: "locked" });
  });

  it("separates ready, charging, and cooldown visual states", () => {
    const defs = [
      { id: "solar_lance", label: "솔", cost: 80, cooldownSec: 12, active: true },
      { id: "gravity_slow", label: "중", cost: 70, cooldownSec: 24, active: true },
    ];

    const slots = buildSkillCooldownSlots(defs, () => 80, (id) => (id === "gravity_slow" ? 12000 : 0));

    expect(slots[0]).toMatchObject({ visualState: "ready", cooldownRatio: 0 });
    expect(slots[1]).toMatchObject({ visualState: "cooldown", cooldownRatio: 0.5, ready: false });
  });

  it("keeps each slot's cooldown ring independent when the shared gauge changes", () => {
    const defs = [
      { id: "solar_lance", label: "솔", cost: 80, cooldownSec: 12, active: true },
      { id: "nova_pulse", label: "노", cost: 64, cooldownSec: 18, active: true },
    ];

    const slots = buildSkillCooldownSlots(defs, () => 10, (id) => (id === "solar_lance" ? 6000 : 0));

    expect(slots[0]).toMatchObject({
      id: "solar_lance",
      cooldownProgressRatio: 0.5,
      visualState: "cooldown",
    });
    expect(slots[1]).toMatchObject({
      id: "nova_pulse",
      cooldownProgressRatio: 1,
      visualState: "charging",
    });
  });

  it("uses each skill's own charge for ratio and ready state", () => {
    const defs = [
      { id: "solar_lance", label: "솔", cost: 80, cooldownSec: 12, active: true },
      { id: "nova_pulse", label: "노", cost: 64, cooldownSec: 18, active: true },
    ];

    const slots = buildSkillCooldownSlots(
      defs,
      (id) => (id === "nova_pulse" ? 100 : 0),
      (id) => (id === "solar_lance" ? 6000 : 0),
    );

    expect(slots[0]).toMatchObject({ id: "solar_lance", ratio: 0, ready: false, visualState: "cooldown" });
    expect(slots[1]).toMatchObject({ id: "nova_pulse", ratio: 1, ready: true, visualState: "ready" });
  });

  it("normalizes invalid and infinite cooldown inputs to finite bounded slot state", () => {
    const defs = [
      { id: "nan", label: "N", cost: 10, cooldownSec: Number.NaN, active: true },
      { id: "infinite_total", label: "I", cost: 10, cooldownSec: Number.POSITIVE_INFINITY, active: true },
      { id: "infinite_remaining", label: "R", cost: 10, cooldownSec: 12, active: true },
    ];

    const slots = buildSkillCooldownSlots(
      defs,
      () => 10,
      (id) => (id === "nan" ? Number.NaN : Number.POSITIVE_INFINITY),
    );

    expect(slots[0]).toMatchObject({ cooldownMs: 0, cooldownRatio: 0, cooldownProgressRatio: 1 });
    expect(slots[1]).toMatchObject({ cooldownMs: 0, cooldownRatio: 0, cooldownProgressRatio: 1 });
    expect(slots[2]).toMatchObject({ cooldownMs: 12000, cooldownRatio: 1, cooldownProgressRatio: 0 });
    for (const slot of slots) {
      expect(Number.isFinite(slot.cooldownMs)).toBe(true);
      expect(slot.cooldownRatio).toBeGreaterThanOrEqual(0);
      expect(slot.cooldownRatio).toBeLessThanOrEqual(1);
      expect(slot.cooldownProgressRatio).toBeGreaterThanOrEqual(0);
      expect(slot.cooldownProgressRatio).toBeLessThanOrEqual(1);
    }
  });
});
