import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import scriptSource from "../../scripts/check-release-prep.mjs?raw";

describe("release prep script", () => {
  it("bundles Edge drafts, keeps Deno optional, and reuses release-boundary checks", () => {
    expect(packageJson.scripts["preflight:release"]).toBe("node scripts/check-release-prep.mjs");
    expect(scriptSource).toContain("scripts/check-release-boundary.mjs");
    expect(scriptSource).toContain("--target=google_play");
    expect(scriptSource).toContain("--target=apps_in_toss");
    expect(scriptSource).toContain("orbitslash-ranked-run");
    expect(scriptSource).toContain("orbitslash-rewarded-ad-telemetry");
    expect(scriptSource).toContain("orbitslash-gameplay-telemetry");
    expect(scriptSource).toContain("--external:https://esm.sh/@supabase/supabase-js@2");
    expect(scriptSource).toContain("deno check skipped");
    expect(scriptSource).toContain("local release-prep checks ok");
    expect(scriptSource).toContain("no remote/app-store/GitHub verification");
  });
});
