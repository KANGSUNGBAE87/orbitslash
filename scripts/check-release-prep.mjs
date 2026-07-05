#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const supabaseExternalArg = "--external:https://esm.sh/@supabase/supabase-js@2";
const edgeFunctions = [
  {
    name: "orbitslash-ranked-run",
    entry: "supabase/functions/orbitslash-ranked-run/index.ts",
    outfile: "/tmp/orbitslash-ranked-run-edge-check.js",
  },
  {
    name: "orbitslash-rewarded-ad-telemetry",
    entry: "supabase/functions/orbitslash-rewarded-ad-telemetry/index.ts",
    outfile: "/tmp/orbitslash-rewarded-ad-telemetry-edge-check.js",
  },
  {
    name: "orbitslash-gameplay-telemetry",
    entry: "supabase/functions/orbitslash-gameplay-telemetry/index.ts",
    outfile: "/tmp/orbitslash-gameplay-telemetry-edge-check.js",
  },
];

run("node", ["scripts/check-release-boundary.mjs"]);
run("node", ["scripts/check-release-boundary.mjs", "--target=google_play"]);
run("node", ["scripts/check-release-boundary.mjs", "--target=apps_in_toss"]);

for (const edge of edgeFunctions) {
  assertExists(edge.entry, `${edge.name} entry missing`);
  run("npx", [
    "esbuild",
    edge.entry,
    "--bundle",
    "--platform=browser",
    "--format=esm",
    supabaseExternalArg,
    `--outfile=${edge.outfile}`,
  ]);
}

const denoVersion = spawnSync("deno", ["--version"], { cwd: root, encoding: "utf8" });
if (denoVersion.error?.code === "ENOENT") {
  console.log("deno check skipped: deno not found in PATH");
} else if (denoVersion.status !== 0) {
  process.stderr.write(denoVersion.stderr || denoVersion.stdout);
  process.exit(denoVersion.status ?? 1);
} else {
  for (const edge of edgeFunctions) {
    run("deno", ["check", edge.entry]);
  }
}

console.log("local release-prep checks ok (boundary scans + Edge draft bundle checks only; no remote/app-store/GitHub verification)");

function assertExists(path, message) {
  if (existsSync(join(root, path))) return;
  console.error(message);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: "inherit" });
  if (!result.error && result.status === 0) return;
  if (result.error) console.error(result.error.message);
  process.exit(result.status ?? 1);
}
