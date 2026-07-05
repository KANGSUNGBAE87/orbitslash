export interface SourceFileForScan {
  path: string;
  content: string;
}

export interface ReleaseBoundaryViolation {
  path: string;
  reason:
    | "forbidden_import_in_game_code"
    | "server_secret_in_client_code"
    | "raw_identity_in_client_code"
    | "dev_qa_token_in_production_bundle"
    | "target_specific_api_in_wrong_bundle"
    | "misleading_release_claim";
  token: string;
}

export interface ReleaseBoundaryResult {
  ok: boolean;
  violations: ReleaseBoundaryViolation[];
}

const FORBIDDEN_GAME_IMPORTS = [
  "@supabase/supabase-js",
  "billing",
  "admob",
  "toss",
  "apps-in-toss",
];

const SERVER_SECRET_TOKENS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_ACCESS_TOKEN",
  "DEEPSEEK_API_KEY",
  "APPS_IN_TOSS_CONSOLE_API_KEY",
];

const RAW_IDENTITY_TOKENS = [
  "userKey",
  "tossUserKey",
  "providerUserId",
  "provider_user_id",
  "advertisingId",
  "deviceId",
  "inviteCode",
  "nickname",
];

const DEV_QA_PRODUCTION_TOKENS = ["qaMode", "qaPreset", "qaGauge"];
export type ReleaseTarget = "google_play" | "apps_in_toss";

const GOOGLE_PLAY_FORBIDDEN_TOSS_TOKENS = [
  { token: "window.close", pattern: /window\.close\s*\(/ },
  { token: "intoss://", pattern: /intoss:\/\//i },
  { token: "intoss-private://", pattern: /intoss-private:\/\//i },
  { token: "apps.tossmini.com", pattern: /apps\.tossmini\.com/i },
  { token: "private-apps.tossmini.com", pattern: /private-apps\.tossmini\.com/i },
];

const APPS_IN_TOSS_FORBIDDEN_GOOGLE_TOKENS = [
  { token: "play.google.com", pattern: /play\.google\.com/i },
  { token: "market://", pattern: /market:\/\//i },
  { token: "GooglePlayBilling", pattern: /GooglePlayBilling/i },
  { token: "CredentialManager", pattern: /CredentialManager/i },
  { token: "AdMob", pattern: /AdMob/i },
];

const MISLEADING_RELEASE_CLAIM_PATTERNS = [
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

export function scanReleaseBoundary(files: SourceFileForScan[]): ReleaseBoundaryResult {
  const violations: ReleaseBoundaryViolation[] = [];
  for (const file of files) {
    if (isGameCode(file.path)) {
      for (const token of FORBIDDEN_GAME_IMPORTS) {
        if (file.content.includes(token)) {
          violations.push({ path: file.path, reason: "forbidden_import_in_game_code", token });
        }
      }
    }
    if (isClientCode(file.path)) {
      for (const token of SERVER_SECRET_TOKENS) {
        if (file.content.includes(token)) {
          violations.push({ path: file.path, reason: "server_secret_in_client_code", token });
        }
      }
      for (const token of RAW_IDENTITY_TOKENS) {
        if (file.content.includes(token)) {
          violations.push({ path: file.path, reason: "raw_identity_in_client_code", token });
        }
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

export function scanProductionBundleForDevQaTokens(files: SourceFileForScan[]): ReleaseBoundaryResult {
  const violations: ReleaseBoundaryViolation[] = [];
  for (const file of files) {
    for (const token of DEV_QA_PRODUCTION_TOKENS) {
      if (file.content.includes(token)) {
        violations.push({ path: file.path, reason: "dev_qa_token_in_production_bundle", token });
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

export function scanTargetSpecificBoundary(files: SourceFileForScan[], target: ReleaseTarget): ReleaseBoundaryResult {
  const violations: ReleaseBoundaryViolation[] = [];
  for (const file of files) {
    if (!isClientCode(file.path) || isAllowedPlatformSpecificFile(file.path, target)) continue;
    const forbidden = target === "google_play" ? GOOGLE_PLAY_FORBIDDEN_TOSS_TOKENS : APPS_IN_TOSS_FORBIDDEN_GOOGLE_TOKENS;
    for (const { token, pattern } of forbidden) {
      if (pattern.test(file.content)) {
        violations.push({ path: file.path, reason: "target_specific_api_in_wrong_bundle", token });
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

export function scanMisleadingReleaseClaims(files: SourceFileForScan[]): ReleaseBoundaryResult {
  const violations: ReleaseBoundaryViolation[] = [];
  for (const file of files) {
    if (!file.path.startsWith("src/i18n/")) continue;
    for (const { token, pattern } of MISLEADING_RELEASE_CLAIM_PATTERNS) {
      if (pattern.test(file.content)) {
        violations.push({ path: file.path, reason: "misleading_release_claim", token });
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

function isGameCode(path: string): boolean {
  return path.startsWith("src/game/") || path.startsWith("src/render/") || path.startsWith("src/data/");
}

function isClientCode(path: string): boolean {
  return path.startsWith("src/");
}

function isAllowedPlatformSpecificFile(path: string, target: ReleaseTarget): boolean {
  if (target === "google_play") return path === "src/platform/AppsInTossAdapter.ts";
  return path === "src/platform/GooglePlayAdapter.ts";
}
