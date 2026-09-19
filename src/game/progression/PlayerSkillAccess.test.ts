import { describe, expect, it } from "vitest";
import { effectiveSkills } from "./PlayerSkillAccess";

const releaseSkills = ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield", "nova_pulse"] as const;
const starterSkills = ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield"] as const;

describe("effectiveSkills", () => {
  it("keeps Nova out of normal player runs before progression unlock", () => {
    expect(effectiveSkills(releaseSkills, starterSkills, "play")).toEqual(starterSkills);
  });

  it("keeps authored content restrictions while DEV QA and practice can access all content skills", () => {
    expect(effectiveSkills(["solar_lance", "gravity_slow"], starterSkills, "play")).toEqual(["solar_lance", "gravity_slow"]);
    expect(effectiveSkills(releaseSkills, starterSkills, "devQa")).toEqual(releaseSkills);
    expect(effectiveSkills(releaseSkills, starterSkills, "practice")).toEqual(releaseSkills);
  });
});
