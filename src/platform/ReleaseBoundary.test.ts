import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
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

  it("allows Google SDK imports only inside the Google Play bridge boundary", () => {
    const result = scanReleaseBoundary([
      { path: "src/platform/google-play/GooglePlayBridge.ts", content: 'import { Capacitor } from "@capacitor/core";' },
      { path: "src/platform/BadGoogleSdk.ts", content: 'import { Capacitor } from "@capacitor/core";' },
    ]);

    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual({
      path: "src/platform/BadGoogleSdk.ts",
      reason: "platform_sdk_in_wrong_boundary",
      token: "@capacitor/",
    });
    expect(result.violations).not.toContainEqual(expect.objectContaining({ path: "src/platform/google-play/GooglePlayBridge.ts" }));
  });

  it("allows Apps in Toss SDK imports only inside its dedicated boundary or adapter", () => {
    const result = scanReleaseBoundary([
      { path: "src/platform/AppsInTossAdapter.ts", content: 'import "@apps-in-toss/web-framework";' },
      { path: "src/platform/apps-in-toss/AppsInTossBridge.ts", content: 'import "@apps-in-toss/web-framework";' },
      { path: "src/platform/BadTossSdk.ts", content: 'import "@apps-in-toss/web-framework";' },
    ]);

    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual({
      path: "src/platform/BadTossSdk.ts",
      reason: "platform_sdk_in_wrong_boundary",
      token: "@apps-in-toss/",
    });
    expect(result.violations).not.toContainEqual(expect.objectContaining({ path: "src/platform/AppsInTossAdapter.ts" }));
    expect(result.violations).not.toContainEqual(expect.objectContaining({ path: "src/platform/apps-in-toss/AppsInTossBridge.ts" }));
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
        {
          path: "src/platform/apps-in-toss/AppsInTossBridge.ts",
          content: "const scheme = 'intoss://app';",
        },
      ],
      "google_play",
    );

    expect(result.ok).toBe(true);
  });

  it("allows the Google Play bridge directory while scanning Apps in Toss", () => {
    const result = scanTargetSpecificBoundary(
      [
        {
          path: "src/platform/GooglePlayAdapter.ts",
          content: "location.href = 'market://details?id=com.example';",
        },
        {
          path: "src/platform/google-play/GooglePlayBridge.ts",
          content: "location.href = 'market://details?id=com.example';",
        },
      ],
      "apps_in_toss",
    );

    expect(result.ok).toBe(true);
  });

  it("rejects target-specific SDK behavior in generic platform paths", () => {
    const googlePlayTarget = scanTargetSpecificBoundary(
      [{ path: "src/platform/BadPlatform.ts", content: "const scheme = 'intoss://app';" }],
      "google_play",
    );
    const appsInTossTarget = scanTargetSpecificBoundary(
      [{ path: "src/platform/BadPlatform.ts", content: "location.href = 'market://details?id=com.example';" }],
      "apps_in_toss",
    );

    expect(googlePlayTarget.ok).toBe(false);
    expect(appsInTossTarget.ok).toBe(false);
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
  it.each([undefined, "google_play", "apps_in_toss"])("runs shared rules against the repository for %s", (target) => {
    const args = ["scripts/check-release-boundary.mjs", ...(target ? [`--target=${target}`] : [])];
    const result = spawnSync(process.execPath, args, { encoding: "utf8", env: { ...process.env, VITE_TARGET: undefined } });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("release boundary ok");
  });
  it("rejects unsupported targets before scanning", () => {
    const result = spawnSync(process.execPath, ["scripts/check-release-boundary.mjs", "--target=invalid"], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unsupported_release_target");
  });
});
