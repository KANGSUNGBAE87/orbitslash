#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  scanReleaseBoundary, scanTargetSpecificBoundary,
  scanMisleadingReleaseClaims, scanProductionBundleForDevQaTokens,
} from "../src/platform/ReleaseBoundary.ts";

const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
const releaseTarget = targetArg ? targetArg.slice("--target=".length) : process.env.VITE_TARGET;
if (releaseTarget !== undefined && releaseTarget !== "google_play" && releaseTarget !== "apps_in_toss") {
  console.error(JSON.stringify([{ path: "env", reason: "unsupported_release_target", token: releaseTarget }]));
  process.exit(1);
}

const root = process.cwd();
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], { cwd: root, encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean)
  .filter((path) => /\.(ts|tsx|js|jsx|json)$/.test(path))
  .filter((path) => !/(\.test\.[tj]sx?|\.spec\.[tj]sx?)$/.test(path))
  .filter((path) => path !== "src/platform/ReleaseBoundary.ts")
  .map((path) => ({ path, content: readFileSync(join(root, path), "utf8") }));

const violations = [
  ...scanReleaseBoundary(files).violations,
  ...scanMisleadingReleaseClaims(files).violations,
  ...(releaseTarget ? scanTargetSpecificBoundary(files, releaseTarget).violations : []),
];
const distRoot = join(root, "dist");
if (existsSync(distRoot)) {
  const distFiles = listFiles(distRoot)
    .filter((path) => /\.(js|css|html|json)$/.test(path))
    .map((path) => ({ path, content: readFileSync(join(root, path), "utf8") }));
  violations.push(...scanProductionBundleForDevQaTokens(distFiles).violations);
}
if (violations.length) {
  console.error(JSON.stringify(violations, null, 2));
  process.exit(1);
}
console.log("release boundary ok");

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
