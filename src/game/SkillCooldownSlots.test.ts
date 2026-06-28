import { describe, expect, it } from "vitest";
import { buildSkillCooldownSlots } from "./SkillCooldownSlots";

describe("buildSkillCooldownSlots", () => {
  it("does not show gauge progress on inactive future slots", () => {
    const slots = buildSkillCooldownSlots(
      [
        { id: "solar_lance", label: "솔", cost: 80, active: true },
        { id: "reserve_slot", label: "예", cost: 100, active: false },
      ],
      80,
      () => 0,
    );

    expect(slots[0]).toMatchObject({ id: "solar_lance", ratio: 1, ready: true });
    expect(slots[1]).toMatchObject({ id: "reserve_slot", ratio: 0, ready: false });
  });
});
