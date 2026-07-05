import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import productPlan from "../../ai/plans/product-plan.md?raw";
import roadmap from "../../ai/plans/master-roadmap.md?raw";
import releaseChecklist from "../../ai/reviews/release-checklist.md?raw";
import { RELEASE_TARGET_PLAN } from "./ReleaseTarget";

describe("release target SSOT", () => {
  it("keeps the current target manifest explicit", () => {
    expect(RELEASE_TARGET_PLAN).toEqual({
      currentImplementationTarget: "local_web_playable",
      firstPublicReleasePrepTarget: "google_play",
      appsInTossCompatibility: true,
      actualPublishingRequiresOwnerCommand: true,
    });
  });

  it("keeps package metadata aligned with the release target plan without claiming store readiness", () => {
    expect(packageJson.description).toContain("local web playable");
    expect(packageJson.description).toContain("Google Play-first");
    expect(packageJson.description).toContain("Apps in Toss-compatible");
    expect(packageJson.description).not.toMatch(/store release ready|google play-first ready|apps in toss ready/i);
  });

  it("keeps canonical release docs aligned with Google Play-first prep and Apps in Toss compatibility", () => {
    expect(productPlan).toContain("Current Release Target Addendum");
    expect(productPlan).toContain("src/platform/ReleaseTarget.ts");
    expect(productPlan).toContain("Google Play-first");
    expect(productPlan).toContain("Apps in Toss-compatible");
    expect(productPlan).toMatch(/actual publishing.*Owner\s+command/i);
    expect(roadmap).toContain("Google Play-first release prep");
    expect(roadmap).toContain("Apps in Toss compatibility");
    expect(roadmap).toMatch(/actual publishing.*Owner (release )?command/i);
    expect(releaseChecklist).toContain("Google Play-first release prep");
    expect(releaseChecklist).toContain("Apps in Toss compatibility");
    expect(releaseChecklist).toMatch(/actual publishing.*Owner (release )?command/i);
  });
});
