export interface SourceFileForScan {
  path: string;
  content: string;
}

export interface ReleaseBoundaryViolation {
  path: string;
  reason: "forbidden_import_in_game_code" | "server_secret_in_client_code";
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
