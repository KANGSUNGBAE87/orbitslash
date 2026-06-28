import { describe, expect, it } from "vitest";
import { BASE_WIDTH, EARTH_BODY_DIAMETER } from "../game/coords";
import { topSkillSlotLayout } from "./Hud";

describe("topSkillSlotLayout", () => {
  it("lays out five large top skill slots across the screen width", () => {
    const layout = topSkillSlotLayout(5);

    expect(layout).toHaveLength(5);
    expect(layout[0]!.radius * 2).toBeGreaterThanOrEqual(EARTH_BODY_DIAMETER - 10);
    expect(layout[0]!.x - layout[0]!.radius).toBeGreaterThanOrEqual(32);
    expect(layout[4]!.x + layout[4]!.radius).toBeLessThanOrEqual(BASE_WIDTH - 32);
  });

  it("keeps slots in one horizontal row below the top stats", () => {
    const layout = topSkillSlotLayout(5);
    const y = layout[0]!.y;

    expect(layout.every((slot) => slot.y === y)).toBe(true);
    expect(y - layout[0]!.radius).toBeGreaterThanOrEqual(104);
    expect(y + layout[0]!.radius).toBeLessThanOrEqual(252);
  });
});
