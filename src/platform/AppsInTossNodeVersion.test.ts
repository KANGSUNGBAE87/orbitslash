import { describe, expect, it } from "vitest";

describe("Apps in Toss Node version policy", () => {
  it("accepts only Node 24 majors for AIT tooling", async () => {
    const { isAppsInTossNode24 } = (await import(["../../scripts/", "apps-in-toss-node-version.mjs"].join(""))) as {
      isAppsInTossNode24(version: string): boolean;
    };

    expect(isAppsInTossNode24("v22.22.3")).toBe(false);
    expect(isAppsInTossNode24("24.0.0")).toBe(true);
    expect(isAppsInTossNode24("v24.7.1")).toBe(true);
    expect(isAppsInTossNode24("25.0.0")).toBe(false);
    expect(isAppsInTossNode24("not-a-version")).toBe(false);
  });
});
