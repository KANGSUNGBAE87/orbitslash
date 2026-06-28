#!/usr/bin/env node
import { readFileSync } from "node:fs";
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
}

const result = { ok: violations.length === 0, violations };
if (!result.ok) {
  console.error(JSON.stringify(result.violations, null, 2));
  process.exit(1);
}

console.log("release boundary ok");
