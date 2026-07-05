import { describe, expect, it } from "vitest";
import boundaryScriptSource from "../../scripts/check-release-boundary.mjs?raw";
import { scanMisleadingReleaseClaims, scanProductionBundleForDevQaTokens, scanReleaseBoundary, scanTargetSpecificBoundary } from "./ReleaseBoundary";

describe("scanReleaseBoundary", () => {
  it("flags platform SDK imports from game code", () => {
    const result = scanReleaseBoundary([
      {
        path: "src/game/Bad.ts",
        content: 'import { createClient } from "@supabase/supabase-js";',
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.violations[0]?.reason).toBe("forbidden_import_in_game_code");
  });

  it("flags server-only secret names in client code", () => {
    const result = scanReleaseBoundary([
      {
        path: "src/platform/Bad.ts",
        content: "const key = 'SUPABASE_SERVICE_ROLE_KEY';",
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.violations[0]?.reason).toBe("server_secret_in_client_code");
  });

  it("flags raw platform identity fields in client code", () => {
    const result = scanReleaseBoundary([
      {
        path: "src/platform/Bad.ts",
        content: "const raw = payload.userKey;",
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatchObject({
      reason: "raw_identity_in_client_code",
      token: "userKey",
    });
  });
});

describe("scanProductionBundleForDevQaTokens", () => {
  it("flags dev QA query params in production bundle files", () => {
    const result = scanProductionBundleForDevQaTokens([
      { path: "dist/assets/index.js", content: "const key = 'qaMode';" },
    ]);

    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatchObject({
      reason: "dev_qa_token_in_production_bundle",
      token: "qaMode",
    });
  });
});

describe("scanTargetSpecificBoundary", () => {
  it("keeps Toss miniapp-only exit behavior out of Google Play target code", () => {
    const result = scanTargetSpecificBoundary(
      [
        {
          path: "src/render/AppShell.ts",
          content: "window.close();",
        },
      ],
      "google_play",
    );

    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatchObject({
      reason: "target_specific_api_in_wrong_bundle",
      token: "window.close",
    });
  });

  it("allows Toss-specific implementation details inside the Toss adapter while scanning Google Play", () => {
    const result = scanTargetSpecificBoundary(
      [
        {
          path: "src/platform/AppsInTossAdapter.ts",
          content: "window.close(); const scheme = 'intoss://app';",
        },
      ],
      "google_play",
    );

    expect(result.ok).toBe(true);
  });

  it("keeps Google Play store-only references out of Apps in Toss target code", () => {
    const result = scanTargetSpecificBoundary(
      [
        {
          path: "src/game/Bad.ts",
          content: "location.href = 'market://details?id=com.example';",
        },
      ],
      "apps_in_toss",
    );

    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatchObject({
      reason: "target_specific_api_in_wrong_bundle",
      token: "market://",
    });
  });
});

describe("scanMisleadingReleaseClaims", () => {
  it("flags unreleased public leaderboard claims in i18n copy", () => {
    const result = scanMisleadingReleaseClaims([
      {
        path: "src/i18n/bad.json",
        content: JSON.stringify({ ranking: "global leaderboard" }),
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatchObject({
      reason: "misleading_release_claim",
      token: "global leaderboard",
    });
  });

  it("ignores the same wording outside i18n user-facing copy", () => {
    const result = scanMisleadingReleaseClaims([
      {
        path: "ai/plans/backend-contract.md",
        content: "global leaderboard remains remote-gated",
      },
    ]);

    expect(result.ok).toBe(true);
  });
});

describe("release boundary script", () => {
  it("scans i18n copy for misleading release claims", () => {
    expect(boundaryScriptSource).toContain("misleading_release_claim");
    expect(boundaryScriptSource).toContain("global");
    expect(boundaryScriptSource).toContain("cross-device");
    expect(boundaryScriptSource).toContain("ad revive live claim");
  });

  it("supports platform target-specific boundary scans", () => {
    expect(boundaryScriptSource).toContain("--target=");
    expect(boundaryScriptSource).toContain("google_play");
    expect(boundaryScriptSource).toContain("apps_in_toss");
    expect(boundaryScriptSource).toContain("target_specific_api_in_wrong_bundle");
  });
});
