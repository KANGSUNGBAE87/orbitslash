#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { isAppsInTossNode24 } from "./apps-in-toss-node-version.mjs";

const root = process.cwd();
const minimumSdkVersion = "2.10.5";
const sdkPackage = "@apps-in-toss/web-framework";
const allowedSdkPaths = new Set(["src/platform/AppsInTossAdapter.ts"]);

if (!isAppsInTossNode24(process.version)) {
  console.error(`node24_required_external: Apps in Toss AIT tooling requires Node 24.x; current=${process.version}. Use nvm use 24 before this release gate.`);
  process.exit(2);
}

const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));
const installedPackage = JSON.parse(read("node_modules/@apps-in-toss/web-framework/package.json"));
const graniteConfig = read("granite.config.ts");
const bridge = read("src/platform/apps-in-toss/AppsInTossBridge.ts");
const coordinator = read("src/platform/apps-in-toss/AdLoadCoordinator.ts");
const adapter = read("src/platform/AppsInTossAdapter.ts");

assert(versionAtLeast(packageJson.dependencies?.[sdkPackage], minimumSdkVersion), `${sdkPackage} must be pinned at ${minimumSdkVersion} or newer.`);
assert(versionAtLeast(packageLock.packages?.["node_modules/@apps-in-toss/web-framework"]?.version, minimumSdkVersion), "package-lock SDK version is stale.");
assert(versionAtLeast(installedPackage.version, minimumSdkVersion), "node_modules SDK version is stale.");

assert(graniteConfig.includes('from "@apps-in-toss/web-framework/config"'), "granite config must use the Apps in Toss web-framework defineConfig boundary.");
assert(graniteConfig.includes("APPS_IN_TOSS_APP_NAME"), "granite config must require the Console app name for AIT builds.");
assert(graniteConfig.includes("APPS_IN_TOSS_CONSOLE_ICON_URL"), "granite config must require the Console icon URL for AIT builds.");
assert(graniteConfig.includes("AIT_BUILD"), "granite config must fail closed only in an AIT build.");
assert(graniteConfig.includes('type: "game"'), "granite config must set the WebView type to game.");
assert(graniteConfig.includes('outdir: "dist"'), "granite config must build into dist.");
assert(!graniteConfig.includes("APPS_IN_TOSS_CONSOLE_API_KEY"), "Console API keys must never enter the client build config.");

assert(bridge.includes("getVerifiedSession"), "Apps in Toss identity must come from a verified-session provider.");
assert(!/userKey|getUserKeyForGame|providerUserId/.test(bridge), "Raw Apps in Toss identities must not enter the bridge.");
assert(coordinator.includes("class AdLoadCoordinator"), "Apps in Toss ad-load contract module is missing.");
assert(coordinator.includes("this.tail"), "Apps in Toss ad-load contract must serialize explicit injected work.");
assert(!bridge.includes("AdLoadCoordinator"), "Default Apps in Toss bridge must not claim a native serialized ad binding.");
assert(adapter.includes('"sandbox"') && adapter.includes('"toss_private_test"') && adapter.includes('"toss_live"'), "Apps in Toss runtime channel classification is incomplete.");

for (const source of walk("src")) {
  if (source.endsWith(".test.ts")) continue;
  const content = read(source);
  if (!/(?:from|import)\s*["'][^"']*@apps-in-toss\//.test(content)) continue;
  assert(allowedSdkPaths.has(source) || source.startsWith("src/platform/apps-in-toss/"), `Apps in Toss SDK import escaped its platform boundary: ${source}`);
}

console.log("Apps in Toss shell boundary ok: Console-gated identity/config, runtime channels, and an ad-load contract; native ads remain disabled without an injected verified SDK bridge.");

function versionAtLeast(value, minimum) {
  if (typeof value !== "string") return false;
  const match = value.match(/\d+(?:\.\d+){0,2}/);
  if (!match) return false;
  const actual = match[0].split(".").map(Number);
  const expected = minimum.split(".").map(Number);
  for (let index = 0; index < expected.length; index += 1) {
    const actualPart = actual[index] ?? 0;
    const expectedPart = expected[index] ?? 0;
    if (actualPart > expectedPart) return true;
    if (actualPart < expectedPart) return false;
  }
  return true;
}

function walk(relativeDirectory) {
  const directory = resolve(root, relativeDirectory);
  return readdirSync(directory).flatMap((name) => {
    const relative = `${relativeDirectory}/${name}`;
    return statSync(resolve(root, relative)).isDirectory() ? walk(relative) : [relative];
  });
}

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
