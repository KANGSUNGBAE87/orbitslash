import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import scriptSource from "../../scripts/check-release-prep.mjs?raw";

type NodeRuntime = {
  cwd(): string;
  execPath: string;
};

type SpawnResult = {
  status: number | null;
  stderr: string;
};

type SpawnSync = (command: string, args: string[], options: { cwd: string; encoding: string }) => SpawnResult;

type FileSystem = {
  copyFile(source: string, destination: string): Promise<void>;
  mkdir(path: string, options: { recursive: true }): Promise<void>;
  mkdtemp(prefix: string): Promise<string>;
  rm(path: string, options: { force: true; recursive: true }): Promise<void>;
  writeFile(path: string, data: string, encoding: "utf8"): Promise<void>;
};

type PathModule = {
  join(...paths: string[]): string;
};

type OperatingSystem = {
  tmpdir(): string;
};

async function stageRankedCoreSources(fileSystem: FileSystem, path: PathModule, cwd: string, root: string) {
  const files = [
    "shared/ranked-core/rules.ts",
    "shared/ranked-core/spawn.ts",
    "shared/ranked-core/score.ts",
    "shared/ranked-core/replay.ts",
    "src/game/coords.ts",
    "src/game/BossDefinitions.ts",
    "src/data/enemies.json",
    "src/data/difficulty.json",
    "src/data/orbits.json",
    "src/data/waves.json",
    "src/data/scoring.json",
    "src/data/skills.json",
  ];
  await Promise.all(files.map(async (file) => {
    const destination = path.join(root, file);
    await fileSystem.mkdir(destination.slice(0, destination.lastIndexOf("/")), { recursive: true });
    await fileSystem.copyFile(path.join(cwd, file), destination);
  }));
}

describe("release prep script", () => {
  it("bundles Edge drafts, reports a missing Deno check as required external work, and reuses release-boundary checks", () => {
    expect(packageJson.scripts["preflight:release"]).toBe("node scripts/check-release-prep.mjs");
    expect(scriptSource).toContain("scripts/check-release-boundary.mjs");
    expect(scriptSource).toContain("scripts/check-google-play-shell.mjs");
    expect(scriptSource).toContain("--target=google_play");
    expect(scriptSource).toContain("--target=apps_in_toss");
    expect(scriptSource).toContain("orbitslash-ranked-run");
    expect(scriptSource).toContain("orbitslash-rewarded-ad-telemetry");
    expect(scriptSource).toContain("orbitslash-gameplay-telemetry");
    expect(scriptSource).toContain("orbitslash-friend-challenge");
    expect(scriptSource).toContain("--external:https://esm.sh/@supabase/supabase-js@2");
    expect(scriptSource).toContain("deno_check=required_external");
    expect(scriptSource).toContain("process.exit(2)");
    expect(scriptSource).not.toContain("deno check skipped");
    expect(scriptSource).toContain("local release-prep checks ok");
    expect(scriptSource).toContain("no remote/app-store/GitHub verification");
    expect(packageJson.scripts["check:edge"]).toContain("orbitslash-friend-challenge/index.ts");
  });

  it("fails release preflight on a stale generated ranked Edge artifact before bundling Edge functions", async () => {
    const nodeRuntime = (globalThis as unknown as { process: NodeRuntime }).process;
    const childProcess = (await import(["node", "child_process"].join(":"))) as { spawnSync: SpawnSync };
    const fileSystem = (await import(["node", "fs/promises"].join(":"))) as FileSystem;
    const operatingSystem = (await import(["node", "os"].join(":"))) as OperatingSystem;
    const path = (await import(["node", "path"].join(":"))) as PathModule;
    const temporaryRoot = await fileSystem.mkdtemp(path.join(operatingSystem.tmpdir(), "orbitslash-release-prep-"));
    const scriptsDirectory = path.join(temporaryRoot, "scripts");
    const rankedCoreDirectory = path.join(temporaryRoot, "shared/ranked-core");
    const generatedDirectory = path.join(temporaryRoot, "supabase/functions/_shared");
    const generatorPath = path.join(scriptsDirectory, "generate-ranked-edge-core.mjs");
    const artifactPath = path.join(generatedDirectory, "orbitslash-ranked-core.generated.ts");

    expect(scriptSource).toContain('run("node", ["scripts/generate-ranked-edge-core.mjs", "--check"]);');
    expect(scriptSource.indexOf("scripts/generate-ranked-edge-core.mjs")).toBeLessThan(scriptSource.indexOf("for (const edge of edgeFunctions)"));

    try {
      await fileSystem.mkdir(scriptsDirectory, { recursive: true });
      await fileSystem.mkdir(rankedCoreDirectory, { recursive: true });
      await fileSystem.mkdir(generatedDirectory, { recursive: true });
      await stageRankedCoreSources(fileSystem, path, nodeRuntime.cwd(), temporaryRoot);
      await fileSystem.copyFile(path.join(nodeRuntime.cwd(), "scripts/check-release-prep.mjs"), path.join(scriptsDirectory, "check-release-prep.mjs"));
      await fileSystem.copyFile(path.join(nodeRuntime.cwd(), "scripts/generate-ranked-edge-core.mjs"), generatorPath);
      await fileSystem.writeFile(path.join(scriptsDirectory, "check-release-boundary.mjs"), "", "utf8");
      await fileSystem.writeFile(path.join(scriptsDirectory, "check-asset-budget.mjs"), "", "utf8");
      await fileSystem.writeFile(path.join(scriptsDirectory, "check-google-play-shell.mjs"), "", "utf8");
      await fileSystem.writeFile(path.join(scriptsDirectory, "check-apps-in-toss-shell.mjs"), "", "utf8");
      await fileSystem.writeFile(
        path.join(rankedCoreDirectory, "types.ts"),
        "export const RANKED_CORE_SCHEMA_VERSION = 1 as const;\n",
        "utf8",
      );
      await fileSystem.writeFile(
        path.join(rankedCoreDirectory, "index.ts"),
        [
          'export { RANKED_CORE_SCHEMA_VERSION } from "./types";',
          "",
          "// Generated by scripts/generate-ranked-edge-core.mjs.",
          'export const RANKED_CORE_RULES_HASH = "__RANKED_CORE_RULES_HASH__" as const;',
          "",
        ].join("\n"),
        "utf8",
      );

      const generationResult = childProcess.spawnSync(nodeRuntime.execPath, [generatorPath], {
        cwd: temporaryRoot,
        encoding: "utf8",
      });
      expect(generationResult.status, generationResult.stderr).toBe(0);
      await fileSystem.writeFile(artifactPath, "stale generated artifact\n", "utf8");

      const preflightResult = childProcess.spawnSync(nodeRuntime.execPath, [path.join(scriptsDirectory, "check-release-prep.mjs")], {
        cwd: temporaryRoot,
        encoding: "utf8",
      });
      expect(preflightResult.status).toBe(1);
      expect(preflightResult.stderr).toContain("Ranked core generated artifact drifted");
    } finally {
      await fileSystem.rm(temporaryRoot, { force: true, recursive: true });
    }
  });
});
