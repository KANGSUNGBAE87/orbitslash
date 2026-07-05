#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const forbiddenGameImports = ["@supabase/supabase-js", "billing", "admob", "toss", "apps-in-toss"];
const serverSecretTokens = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_ACCESS_TOKEN",
  "DEEPSEEK_API_KEY",
  "APPS_IN_TOSS_CONSOLE_API_KEY",
];
const rawIdentityTokens = [
  "userKey",
  "tossUserKey",
  "providerUserId",
  "provider_user_id",
  "advertisingId",
  "deviceId",
  "inviteCode",
  "nickname",
];
const devQaProductionTokens = ["qaMode", "qaPreset", "qaGauge"];
const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
const releaseTarget = targetArg ? targetArg.slice("--target=".length) : process.env.VITE_TARGET;
const targetSpecificTokens = {
  google_play: [
    { pattern: /window\.close\s*\(/, token: "window.close" },
    { pattern: /intoss:\/\//i, token: "intoss://" },
    { pattern: /intoss-private:\/\//i, token: "intoss-private://" },
    { pattern: /apps\.tossmini\.com/i, token: "apps.tossmini.com" },
    { pattern: /private-apps\.tossmini\.com/i, token: "private-apps.tossmini.com" },
  ],
  apps_in_toss: [
    { pattern: /play\.google\.com/i, token: "play.google.com" },
    { pattern: /market:\/\//i, token: "market://" },
    { pattern: /GooglePlayBilling/i, token: "GooglePlayBilling" },
    { pattern: /CredentialManager/i, token: "CredentialManager" },
    { pattern: /AdMob/i, token: "AdMob" },
  ],
};
const misleadingReleaseClaimPatterns = [
  { pattern: /global\s+(leaderboard|ranking)/i, token: "global leaderboard" },
  { pattern: /world\s+(leaderboard|ranking)/i, token: "world leaderboard" },
  { pattern: /online\s+(leaderboard|ranking)/i, token: "online leaderboard" },
  { pattern: /cloud\s+sync/i, token: "cloud sync" },
  { pattern: /cross-device/i, token: "cross-device" },
  { pattern: /buy\s+now|purchase\s+now|billing\s+ready/i, token: "iap live claim" },
  { pattern: /전세계\s*랭킹|글로벌\s*랭킹|온라인\s*랭킹/, token: "public ranking claim" },
  { pattern: /클라우드\s*동기화|기기\s*간\s*동기화/, token: "sync claim" },
  { pattern: /구매하기|결제\s*가능/, token: "iap live claim" },
  { pattern: /광고\s*보고\s*부활/, token: "ad revive live claim" },
];

const root = process.cwd();
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], { cwd: root, encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean)
  .filter((path) => /\.(ts|tsx|js|jsx|json)$/.test(path))
  .filter((path) => !/(\.test\.[tj]sx?|\.spec\.[tj]sx?)$/.test(path))
  .filter((path) => path !== "src/platform/ReleaseBoundary.ts")
  .map((path) => ({ path, content: readFileSync(join(root, path), "utf8") }));

const violations = [];
for (const file of files) {
  if (file.path.startsWith("src/game/") || file.path.startsWith("src/render/") || file.path.startsWith("src/data/")) {
    for (const token of forbiddenGameImports) {
      if (file.content.includes(token)) {
        violations.push({ path: file.path, reason: "forbidden_import_in_game_code", token });
      }
    }
  }
  for (const token of serverSecretTokens) {
    if (file.content.includes(token)) {
      violations.push({ path: file.path, reason: "server_secret_in_client_code", token });
    }
  }
  for (const token of rawIdentityTokens) {
    if (file.content.includes(token)) {
      violations.push({ path: file.path, reason: "raw_identity_in_client_code", token });
    }
  }
  if (releaseTarget) {
    if (!Object.hasOwn(targetSpecificTokens, releaseTarget)) {
      violations.push({ path: "env", reason: "unsupported_release_target", token: releaseTarget });
    } else if (!isAllowedPlatformSpecificFile(file.path, releaseTarget)) {
      for (const { pattern, token } of targetSpecificTokens[releaseTarget]) {
        if (pattern.test(file.content)) {
          violations.push({ path: file.path, reason: "target_specific_api_in_wrong_bundle", token });
        }
      }
    }
  }
  if (file.path.startsWith("src/i18n/")) {
    for (const claim of misleadingReleaseClaimPatterns) {
      if (claim.pattern.test(file.content)) {
        violations.push({ path: file.path, reason: "misleading_release_claim", token: claim.token });
      }
    }
  }
}

const distRoot = join(root, "dist");
if (existsSync(distRoot)) {
  const distFiles = listFiles(distRoot)
    .filter((path) => /\.(js|css|html|json)$/.test(path))
    .map((path) => ({ path, content: readFileSync(join(root, path), "utf8") }));

  for (const file of distFiles) {
    for (const token of devQaProductionTokens) {
      if (file.content.includes(token)) {
        violations.push({ path: file.path, reason: "dev_qa_token_in_production_bundle", token });
      }
    }
  }
}

const result = { ok: violations.length === 0, violations };
if (!result.ok) {
  console.error(JSON.stringify(result.violations, null, 2));
  process.exit(1);
}

console.log("release boundary ok");

function isAllowedPlatformSpecificFile(path, target) {
  if (target === "google_play") return path === "src/platform/AppsInTossAdapter.ts";
  if (target === "apps_in_toss") return path === "src/platform/GooglePlayAdapter.ts";
  return false;
}

function listFiles(dir) {
  const paths = [];
  for (const entry of readdirSync(dir)) {
    const absolute = join(dir, entry);
    const relative = absolute.slice(root.length + 1);
    if (statSync(absolute).isDirectory()) {
      paths.push(...listFiles(absolute));
    } else {
      paths.push(relative);
    }
  }
  return paths;
}
