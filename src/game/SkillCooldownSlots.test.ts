import { describe, expect, it } from "vitest";
import { buildSkillCooldownSlots } from "./SkillCooldownSlots";

describe("buildSkillCooldownSlots", () => {
  it("does not show gauge progress on inactive future slots", () => {
    const slots = buildSkillCooldownSlots(
      [
        { id: "solar_lance", label: "솔", cost: 80, cooldownSec: 12, active: true },
        { id: "reserve_slot", label: "예", cost: 100, cooldownSec: 0, active: false },
      ],
      80,
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

    const slots = buildSkillCooldownSlots(defs, 80, (id) => (id === "gravity_slow" ? 12000 : 0));

    expect(slots[0]).toMatchObject({ visualState: "ready", cooldownRatio: 0 });
    expect(slots[1]).toMatchObject({ visualState: "cooldown", cooldownRatio: 0.5, ready: false });
  });
});
