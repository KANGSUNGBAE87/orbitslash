import { describe, expect, it } from "vitest";
import { EARTH_BODY_DIAMETER } from "./coords";
import { SOLAR_LANCE_HIT_INFLATE_PX, SOLAR_LANCE_VFX_WIDTH_PX } from "./input-tuning";
import skillsJson from "../data/skills.json";

describe("Solar Lance balance", () => {
  it("uses an earth-diameter inflate so the visual effect feels two earth diameters wide", () => {
    expect(SOLAR_LANCE_HIT_INFLATE_PX).toBe(EARTH_BODY_DIAMETER);
    expect(SOLAR_LANCE_VFX_WIDTH_PX).toBe(EARTH_BODY_DIAMETER * 2);
  });

  it("uses boosted damage while keeping the existing earth-linked gesture gate", () => {
    expect(skillsJson.solar_lance.hitDamage).toBe(5);
    expect(skillsJson.solar_lance.lineToEarthMaxR).toBe(0.6);
    expect(skillsJson.solar_lance.endpointOutsideR).toBe(1.5);
  });
});
