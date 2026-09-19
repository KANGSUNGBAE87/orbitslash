import { describe, expect, it } from "vitest";
import shellScript from "../../scripts/check-apps-in-toss-shell.mjs?raw";
import releasePrepScript from "../../scripts/check-release-prep.mjs?raw";
import packageJson from "../../package.json";
import packageLock from "../../package-lock.json";
import nodeVersionFile from "../../.nvmrc?raw";
import graniteConfig from "../../granite.config.ts?raw";
import { resolveAppsInTossGraniteConfig } from "../../granite.config";

describe("Apps in Toss shell configuration", () => {
  it("pins the repository to the Node 24 major required by Apps in Toss tooling", () => {
    expect(packageJson.engines).toEqual({ node: ">=24 <25" });
    expect(packageLock.packages[""]?.engines).toEqual({ node: ">=24 <25" });
    expect(nodeVersionFile.trim()).toBe("24");
    expect(shellScript).toContain("node24_required_external");
  });

  it("keeps local config parsing safe while AIT builds require console identity and icon values", () => {
    expect(graniteConfig).toContain("APPS_IN_TOSS_APP_NAME");
    expect(graniteConfig).toContain("APPS_IN_TOSS_CONSOLE_ICON_URL");
    expect(graniteConfig).toContain("AIT_BUILD");
    expect(graniteConfig).toContain("webViewProps");
    expect(graniteConfig).toContain('type: "game"');
    expect(resolveAppsInTossGraniteConfig({})).toMatchObject({
      appName: "Orbit Slash (local)",
      brand: { displayName: "Orbit Slash (local)" },
      webViewProps: { type: "game" },
    });
    expect(() => resolveAppsInTossGraniteConfig({ AIT_BUILD: "1" })).toThrow("APPS_IN_TOSS_APP_NAME");
    expect(() => resolveAppsInTossGraniteConfig({ AIT_BUILD: "1", APPS_IN_TOSS_APP_NAME: "Orbit Slash" })).toThrow(
      "APPS_IN_TOSS_CONSOLE_ICON_URL",
    );
    expect(
      resolveAppsInTossGraniteConfig({
        AIT_BUILD: "1",
        APPS_IN_TOSS_APP_NAME: "Orbit Slash",
        APPS_IN_TOSS_CONSOLE_ICON_URL: "https://cdn.console.example/orbitslash.png",
      }),
    ).toMatchObject({
      appName: "Orbit Slash",
      brand: { displayName: "Orbit Slash", icon: "https://cdn.console.example/orbitslash.png" },
    });
  });

  it("verifies SDK version, dedicated boundary, runtime channels, and an ad-load contract without claiming native ad binding", () => {
    expect(shellScript).toContain("@apps-in-toss/web-framework");
    expect(shellScript).toContain("2.10.5");
    expect(shellScript).toContain("AppsInTossBridge.ts");
    expect(shellScript).toContain("AdLoadCoordinator.ts");
    expect(shellScript).toContain("toss_private_test");
    expect(shellScript).toContain("toss_live");
    expect(shellScript).toContain("ad-load contract");
    expect(shellScript).not.toContain("serialized native ad loading");
    expect(releasePrepScript).toContain("scripts/check-apps-in-toss-shell.mjs");
  });
});
