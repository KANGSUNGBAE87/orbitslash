import { describe, expect, it } from "vitest";
import designPlan from "../../ai/plans/design-plan.md?raw";
import designSystem from "../../ai/plans/design-system.md?raw";
import implementationPlan from "../../ai/plans/implementation-plan.md?raw";
import productPlan from "../../ai/plans/product-plan.md?raw";
import { EARTH_BODY_DIAMETER, EARTH_SHIELD_DIAMETER, LAST_SAVE_RING_DIAMETER } from "./coords";

describe("documentation SSOT alignment", () => {
  it("documents the current gameplay Earth visual size constants", () => {
    for (const doc of [designPlan, designSystem, implementationPlan]) {
      expect(doc).toContain(`Earth body diameter = ${EARTH_BODY_DIAMETER}`);
      expect(doc).toContain(`Earth shield diameter = ${EARTH_SHIELD_DIAMETER}`);
      expect(doc).toContain(`Last Save ring diameter = ${LAST_SAVE_RING_DIAMETER}`);
      expect(doc).not.toContain("Earth body diameter = 100");
      expect(doc).not.toContain("Earth shield diameter = 140");
      expect(doc).not.toContain("Last Save ring diameter = 174");
      expect(doc).not.toContain("body 280~330");
    }
  });

  it("documents five canonical release skills, not the stale four-skill release scope", () => {
    expect(productPlan).toContain("스킬 5종");
    expect(productPlan).not.toContain("스킬 4종");
    expect(designSystem).toContain("CANONICAL skills = exactly 5");
    expect(designSystem).not.toContain("CANONICAL skills = exactly 4");
  });

  it("documents Eclipse Core as the current first survival boss and Black Core as deprecated", () => {
    for (const doc of [productPlan, designPlan]) {
      expect(doc).toContain("Eclipse Core");
      expect(doc).toContain("Black Core");
      expect(doc).toContain("deprecated");
    }
  });
});
