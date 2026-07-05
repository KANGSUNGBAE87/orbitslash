import { describe, expect, it } from "vitest";
import { applySpecialObjectHit, createSpecialObject, SPECIAL_OBJECT_DEFINITIONS } from "./SpecialObjectSystem";

describe("SpecialObjectSystem", () => {
  it("defines the four release judgment objects", () => {
    expect(Object.keys(SPECIAL_OBJECT_DEFINITIONS)).toEqual(["friendlyRescue", "satellite", "energyCapsule", "empMine"]);
  });

  it("treats cutting an energy capsule as a lost protection opportunity", () => {
    const capsule = createSpecialObject({ id: 1, type: "energyCapsule", x: 540, y: 700, nowMs: 1000 });

    expect(capsule.radiusPx).toBeGreaterThan(0);
    expect(applySpecialObjectHit(capsule)).toMatchObject({
      kind: "penalty",
      damage: 0,
      comboBreak: false,
    });
  });

  it("marks rescue objects as fail-on-cut judgment objects", () => {
    const rescue = createSpecialObject({ id: 2, type: "friendlyRescue", x: 540, y: 700, nowMs: 1000 });

    expect(applySpecialObjectHit(rescue)).toMatchObject({
      kind: "penalty",
      comboBreak: true,
      damage: SPECIAL_OBJECT_DEFINITIONS.friendlyRescue.damage,
    });
  });

  it("makes satellites and EMP mines avoid-on-cut judgment objects", () => {
    const satellite = createSpecialObject({ id: 3, type: "satellite", x: 540, y: 700, nowMs: 1000 });
    const mine = createSpecialObject({ id: 4, type: "empMine", x: 540, y: 700, nowMs: 1000 });

    expect(applySpecialObjectHit(satellite)).toMatchObject({
      kind: "penalty",
      comboBreak: true,
      damage: SPECIAL_OBJECT_DEFINITIONS.satellite.damage,
    });
    expect(applySpecialObjectHit(mine)).toMatchObject({
      kind: "penalty",
      comboBreak: true,
      damage: SPECIAL_OBJECT_DEFINITIONS.empMine.damage,
    });
  });
});
