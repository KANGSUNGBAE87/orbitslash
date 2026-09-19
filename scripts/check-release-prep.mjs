#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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
  {
    name: "orbitslash-product-telemetry",
    entry: "supabase/functions/orbitslash-product-telemetry/index.ts",
    outfile: "/tmp/orbitslash-product-telemetry-edge-check.js",
  },
  {
    name: "orbitslash-progress",
    entry: "supabase/functions/orbitslash-progress/index.ts",
    outfile: "/tmp/orbitslash-progress-edge-check.js",
  },
  {
    name: "orbitslash-entitlements",
    entry: "supabase/functions/orbitslash-entitlements/index.ts",
    outfile: "/tmp/orbitslash-entitlements-edge-check.js",
  },
  {
    name: "orbitslash-friend-challenge",
    entry: "supabase/functions/orbitslash-friend-challenge/index.ts",
    outfile: "/tmp/orbitslash-friend-challenge-edge-check.js",
  },
];

run("node", ["scripts/check-release-boundary.mjs"]);
run("node", ["scripts/check-release-boundary.mjs", "--target=google_play"]);
run("node", ["scripts/check-release-boundary.mjs", "--target=apps_in_toss"]);
run("node", ["scripts/check-asset-budget.mjs"]);
run("node", ["scripts/check-google-play-shell.mjs"]);
run("node", ["scripts/check-apps-in-toss-shell.mjs"]);
run("node", ["scripts/generate-ranked-edge-core.mjs", "--check"]);

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
  console.error("deno_check=required_external: deno not found in PATH; run Deno checks in a Deno-enabled CI or release environment.");
  process.exit(2);
} else if (denoVersion.status !== 0) {
  process.stderr.write(denoVersion.stderr || denoVersion.stdout);
  process.exit(denoVersion.status ?? 1);
} else {
  const expectedVersion = readFileSync(join(root, ".deno-version"), "utf8").trim();
  if (!denoVersion.stdout.startsWith(`deno ${expectedVersion} `)) {
    console.error(`deno_version_mismatch: expected ${expectedVersion}; install the version in .deno-version`);
    process.exit(2);
  }
  for (const edge of edgeFunctions) {
    run("deno", ["check", "--config", "supabase/functions/deno.json", "--frozen", edge.entry]);
  }
}

console.log("local release-prep checks ok (boundary + shell + asset + Edge bundle/type checks; no remote/app-store/GitHub verification)");

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
