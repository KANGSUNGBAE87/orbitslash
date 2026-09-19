import { describe, expect, it } from "vitest";

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
  readFile(path: string, encoding: "utf8"): Promise<string>;
  rm(path: string, options: { force: true; recursive: true }): Promise<void>;
  writeFile(path: string, data: string, encoding: "utf8"): Promise<void>;
};

type PathModule = {
  join(...paths: string[]): string;
};

type OperatingSystem = {
  tmpdir(): string;
};

function hashFromArtifact(artifact: string) {
  const match = artifact.match(/RANKED_CORE_RULES_HASH = "([a-f0-9]{64})"/);
  expect(match?.[1]).toBeDefined();
  return match![1];
}

async function stageRankedCoreFixture(fileSystem: FileSystem, path: PathModule, cwd: string, temporaryRoot: string) {
  const copiedFiles = [
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
  await Promise.all(copiedFiles.map(async (file) => {
    const destination = path.join(temporaryRoot, file);
    const parent = destination.slice(0, destination.lastIndexOf("/"));
    await fileSystem.mkdir(parent, { recursive: true });
    await fileSystem.copyFile(path.join(cwd, file), destination);
  }));
}

describe("ranked core parity", () => {
  it("regenerates canonical normal and periodic-boss spawns for every ranked difficulty", async () => {
    const clientCore = await import("../../shared/ranked-core/spawn");
    const generatedCore = await import("../../supabase/functions/_shared/ranked-core/spawn");
    const rules = await import("../../shared/ranked-core/rules");

    for (const [difficulty, seed] of [["rookie", 11], ["defender", 22], ["elite", 33], ["master", 44]] as const) {
      const snapshot = rules.createRankedCoreRulesFromJson(await import("../data/enemies.json"), await import("../data/difficulty.json"), await import("../data/orbits.json"), await import("../data/waves.json"), await import("../data/scoring.json"), await import("../data/skills.json"));
      const summary = { difficulty, seed, survivalMs: 150_000 };
      const client = clientCore.generateRankedCoreSpawns(summary, snapshot);
      const edge = generatedCore.generateRankedCoreSpawns(summary, snapshot);

      expect(edge).toEqual(client);
      expect(client.some((spawn) => spawn.enemyType === snapshot.ranked.bossEnemyType)).toBe(true);
      expect(client.filter((spawn) => spawn.source === "wave").length).toBeGreaterThan(0);
    }
  });

  it("embeds the same JSON rules snapshot in the generated Edge module", async () => {
    const rules = await import("../../shared/ranked-core/rules");
    const generated = await import("../../supabase/functions/_shared/ranked-core/data");
    const snapshot = rules.createRankedCoreRulesFromJson(await import("../data/enemies.json"), await import("../data/difficulty.json"), await import("../data/orbits.json"), await import("../data/waves.json"), await import("../data/scoring.json"), await import("../data/skills.json"));

    expect(generated.RANKED_CORE_RULES).toEqual(snapshot);
  });

  it("uses GameScene's canonical earth radius and zone boundaries in the generated ranked rules", async () => {
    const generated = await import("../../supabase/functions/_shared/ranked-core/data");
    const { EARTH_GAMEPLAY_RADIUS, distanceBand } = await import("./coords");

    expect(generated.RANKED_CORE_RULES.ranked.earthGameplayRadius).toBe(EARTH_GAMEPLAY_RADIUS);
    expect(generated.RANKED_CORE_RULES.ranked.earthGameplayRadius).not.toBe(170);

    for (const difficulty of ["rookie", "defender", "elite", "master"] as const) {
      const zones = generated.RANKED_CORE_RULES.difficulty.zones;
      for (const radius of [
        zones.outer * EARTH_GAMEPLAY_RADIUS - 0.01,
        zones.outer * EARTH_GAMEPLAY_RADIUS,
        zones.mid * EARTH_GAMEPLAY_RADIUS - 0.01,
        zones.mid * EARTH_GAMEPLAY_RADIUS,
        zones.lastSave * EARTH_GAMEPLAY_RADIUS - 0.01,
        zones.lastSave * EARTH_GAMEPLAY_RADIUS,
      ]) {
        expect(distanceBand(radius, EARTH_GAMEPLAY_RADIUS, zones)).toBe(
          distanceBand(radius, generated.RANKED_CORE_RULES.ranked.earthGameplayRadius, zones),
        );
      }
      expect(generated.RANKED_CORE_RULES.difficulty[difficulty]).toBeDefined();
    }
  });

  it("generates the Edge boss weak-point snapshot from the canonical BossDefinitions source", async () => {
    const generated = await import("../../supabase/functions/_shared/ranked-core/data");
    const { BOSS_DEFINITIONS } = await import("./BossDefinitions");

    expect(generated.RANKED_BOSS_DEFINITIONS).toEqual(BOSS_DEFINITIONS);
  });

  it("preserves the player WaveGenerator RNG consumption order", async () => {
    const core = await import("../../shared/ranked-core/spawn");
    const rules = await import("../../shared/ranked-core/rules");
    const { WaveGenerator } = await import("./WaveGenerator");
    const { createRng } = await import("./Rng");
    const enemies = (await import("../data/enemies.json")).default;
    const difficulty = (await import("../data/difficulty.json")).default;
    const orbits = (await import("../data/orbits.json")).default;
    const waves = (await import("../data/waves.json")).default;
    const scoring = (await import("../data/scoring.json")).default;
    const skills = (await import("../data/skills.json")).default;
    const snapshot = rules.createRankedCoreRulesFromJson(enemies, difficulty, orbits, waves, scoring, skills);
    const runtime = new WaveGenerator(createRng(987), {
      difficulty: "elite",
      spawnIntervalMultiplierForElapsed: () => 0.9,
    }, enemies as never, difficulty as never, orbits.profiles as never, waves as never).next(20_000);
    const coreSpawns = core.generateRankedCoreSpawns({ difficulty: "elite", seed: 987, survivalMs: 20_000 }, snapshot)
      .filter((spawn) => spawn.source === "wave")
      .map(({ source: _source, spawnOrdinal: _spawnOrdinal, ...spawn }) => spawn);

    expect(coreSpawns).toEqual(runtime);
  });

  it("replays ranked score and combo boundaries without a game runtime import", async () => {
    const score = await import("../../shared/ranked-core/score");
    const rules = await import("../../shared/ranked-core/rules");
    const snapshot = rules.createRankedCoreRulesFromJson(await import("../data/enemies.json"), await import("../data/difficulty.json"), await import("../data/orbits.json"), await import("../data/waves.json"), await import("../data/scoring.json"), await import("../data/skills.json"));

    const replayed = score.replayRankedScore([
      { spawnOrdinal: 1, enemyType: "basic_meteor", hitAtMs: 100, band: "outer", accuracy: "normal" },
      { spawnOrdinal: 2, enemyType: "small_meteor", hitAtMs: 200, band: "lastSave", accuracy: "directional" },
    ], [], snapshot);

    expect(replayed).toMatchObject({ kills: 2, maxCombo: 2, lastSaveCount: 1 });
    expect(replayed.score).toBeGreaterThan(0);
  });

  it("resets only the used ranked skill charge and reports every remaining balance", async () => {
    const score = await import("../../shared/ranked-core/score");
    const rules = await import("../../shared/ranked-core/rules");
    const snapshot = rules.createRankedCoreRulesFromJson(await import("../data/enemies.json"), await import("../data/difficulty.json"), await import("../data/orbits.json"), await import("../data/waves.json"), await import("../data/scoring.json"), await import("../data/skills.json"));
    const fullChargeRules = {
      ...snapshot,
      scoring: {
        ...snapshot.scoring,
        combatGaugeGainMultiplier: 1,
        gaugeGain: { ...snapshot.scoring.gaugeGain, basic_meteor: 100 },
      },
      skills: {
        ...snapshot.skills,
        solar_lance: { ...snapshot.skills.solar_lance, gaugeCost: 80, cooldownSec: 1 },
      },
    };

    expect(score.validateRankedSkillTimeline(
      [{ enemyType: "basic_meteor", hitAtMs: 100, band: "outer", accuracy: "normal" }],
      [{ skillId: "solar_lance", atMs: 101 }],
      fullChargeRules,
    )).toEqual({
      ok: true,
      remainingGaugeBySkill: {
        solar_lance: 0,
        orbital_cut: 100,
        gravity_slow: 100,
        delta_shield: 100,
        nova_pulse: 100,
      },
    });
  });

  it("uses strict global sequence order for same-millisecond ranked kill funding", async () => {
    const score = await import("../../shared/ranked-core/score");
    const rules = await import("../../shared/ranked-core/rules");
    const snapshot = rules.createRankedCoreRulesFromJson(await import("../data/enemies.json"), await import("../data/difficulty.json"), await import("../data/orbits.json"), await import("../data/waves.json"), await import("../data/scoring.json"), await import("../data/skills.json"));
    const sameMillisecondRules = {
      ...snapshot,
      scoring: {
        ...snapshot.scoring,
        combatGaugeGainMultiplier: 1,
        gaugeGain: { ...snapshot.scoring.gaugeGain, basic_meteor: 100, comboKill: 0, lastSave: 0 },
      },
      skills: {
        ...snapshot.skills,
        solar_lance: { ...snapshot.skills.solar_lance, gaugeCost: 100, cooldownSec: 0 },
      },
    };

    expect(score.validateRankedSkillTimeline(
      [{ enemyType: "basic_meteor", hitAtMs: 100, eventSequence: 1, band: "outer", accuracy: "normal" }],
      [{ skillId: "solar_lance", atMs: 100, eventSequence: 2 }],
      sameMillisecondRules,
    )).toMatchObject({ ok: true });
    expect(score.validateRankedSkillTimeline(
      [{ enemyType: "basic_meteor", hitAtMs: 100, eventSequence: 2, band: "outer", accuracy: "normal" }],
      [{ skillId: "solar_lance", atMs: 100, eventSequence: 1 }],
      sameMillisecondRules,
    )).toEqual({ ok: false, reason: "skill_timeline_invalid" });
    expect(score.validateRankedSkillTimeline(
      [{ enemyType: "basic_meteor", hitAtMs: 50, eventSequence: 2, band: "outer", accuracy: "normal" }],
      [{ skillId: "solar_lance", atMs: 100, eventSequence: 1 }],
      sameMillisecondRules,
    )).toEqual({ ok: false, reason: "skill_timeline_invalid" });
  });

  it("rejects reusing the same ranked skill after cooldown without new charge", async () => {
    const score = await import("../../shared/ranked-core/score");
    const rules = await import("../../shared/ranked-core/rules");
    const snapshot = rules.createRankedCoreRulesFromJson(await import("../data/enemies.json"), await import("../data/difficulty.json"), await import("../data/orbits.json"), await import("../data/waves.json"), await import("../data/scoring.json"), await import("../data/skills.json"));
    const oneChargeRules = {
      ...snapshot,
      scoring: {
        ...snapshot.scoring,
        combatGaugeGainMultiplier: 1,
        gaugeGain: { ...snapshot.scoring.gaugeGain, basic_meteor: 100 },
      },
      skills: {
        ...snapshot.skills,
        solar_lance: { ...snapshot.skills.solar_lance, gaugeCost: 80, cooldownSec: 1 },
      },
    };

    expect(score.validateRankedSkillTimeline(
      [{ enemyType: "basic_meteor", hitAtMs: 100, band: "outer", accuracy: "normal" }],
      [
        { skillId: "solar_lance", atMs: 101 },
        { skillId: "solar_lance", atMs: 1_101 },
      ],
      oneChargeRules,
    )).toEqual({ ok: false, reason: "skill_timeline_invalid" });
  });

  it("derives score and skill-use upper bounds from the same core spawn sequence", async () => {
    const score = await import("../../shared/ranked-core/score");
    const spawn = await import("../../shared/ranked-core/spawn");
    const rules = await import("../../shared/ranked-core/rules");
    const snapshot = rules.createRankedCoreRulesFromJson(await import("../data/enemies.json"), await import("../data/difficulty.json"), await import("../data/orbits.json"), await import("../data/waves.json"), await import("../data/scoring.json"), await import("../data/skills.json"));
    const spawns = spawn.generateRankedCoreSpawns({ difficulty: "elite", seed: 91, survivalMs: 80_000 }, snapshot);
    const bounds = score.computeRankedScoreBounds(80_000, spawns, snapshot);

    expect(bounds.maxScore).toBeGreaterThan(0);
    expect(bounds.maxSkillUse.solar_lance).toBeGreaterThan(0);
  });

  it("accepts only canonical spawn evidence and keeps boss shards server-rejected", async () => {
    const replay = await import("../../shared/ranked-core/replay");
    const spawn = await import("../../shared/ranked-core/spawn");
    const rules = await import("../../shared/ranked-core/rules");
    const snapshot = rules.createRankedCoreRulesFromJson(await import("../data/enemies.json"), await import("../data/difficulty.json"), await import("../data/orbits.json"), await import("../data/waves.json"), await import("../data/scoring.json"), await import("../data/skills.json"));
    const summary = { difficulty: "defender", seed: 77, survivalMs: 90_000 } as const;
    const canonical = spawn.generateRankedCoreSpawns(summary, snapshot);

    expect(replay.validateRankedSpawnEvidence(summary, canonical, snapshot)).toEqual({ ok: true, spawns: canonical });
    expect(replay.validateRankedSpawnEvidence(summary, [...canonical].reverse(), snapshot)).toMatchObject({ ok: false });
    expect(replay.validateRankedSpawnEvidence(summary, [...canonical, { ...canonical[0]!, source: "boss_shard" }], snapshot)).toMatchObject({ ok: false });
  });

  it("derives exact split ordinals from server-owned kill evidence", async () => {
    const replay = await import("../../shared/ranked-core/replay");
    const spawn = await import("../../shared/ranked-core/spawn");
    const rules = await import("../../shared/ranked-core/rules");
    const snapshot = rules.createRankedCoreRulesFromJson(await import("../data/enemies.json"), await import("../data/difficulty.json"), await import("../data/orbits.json"), await import("../data/waves.json"), await import("../data/scoring.json"), await import("../data/skills.json"));
    const fixture = Array.from({ length: 256 }, (_, index) => index + 1).map((seed) => {
      const summary = { difficulty: "defender", seed, survivalMs: 60_000 } as const;
      return { summary, parent: spawn.generateRankedCoreSpawns(summary, snapshot).find((item) => item.source === "wave" && item.enemyType === "ice_comet") };
    }).find((item) => item.parent);
    expect(fixture?.parent).toBeDefined();
    const parent = fixture!.parent!;
    const killedAtMs = parent.spawnAtMs + 1;
    const derived = replay.deriveRankedReplaySpawns(fixture!.summary, [{ spawnOrdinal: parent.spawnOrdinal!, hitAtMs: killedAtMs }], snapshot);

    expect(derived.some((item) => item.source === "split" && item.parentSpawnOrdinal === parent.spawnOrdinal)).toBe(true);
    expect(replay.validateRankedSpawnEvidence(fixture!.summary, derived, snapshot, [{ spawnOrdinal: parent.spawnOrdinal!, hitAtMs: killedAtMs }])).toEqual({ ok: true, spawns: derived });
    expect(replay.validateRankedSpawnEvidence(fixture!.summary, [...derived, { ...derived.find((item) => item.source === "split")!, spawnOrdinal: derived.length + 1 }], snapshot, [{ spawnOrdinal: parent.spawnOrdinal!, hitAtMs: killedAtMs }])).toMatchObject({ ok: false });
  });

  it("matches the generated Edge rules hash and schema version", async () => {
    const shared = await import("../../shared/ranked-core/index");
    const generated = await import("../../supabase/functions/_shared/orbitslash-ranked-core.generated");

    expect(shared.RANKED_CORE_RULES_HASH).toMatch(/^[a-f0-9]{64}$/);
    expect(generated.RANKED_CORE_RULES_HASH).toBe(shared.RANKED_CORE_RULES_HASH);
    expect(generated.RANKED_CORE_SCHEMA_VERSION).toBe(shared.RANKED_CORE_SCHEMA_VERSION);

    const nodeRuntime = (globalThis as unknown as { process: NodeRuntime }).process;
    const childProcess = (await import(["node", "child_process"].join(":"))) as { spawnSync: SpawnSync };
    const result = childProcess.spawnSync(nodeRuntime.execPath, ["scripts/generate-ranked-edge-core.mjs", "--check"], {
      cwd: nodeRuntime.cwd(),
      encoding: "utf8",
    });

    expect(result.status, result.stderr).toBe(0);
  });

  it("uses one rules hash for LF and CRLF ranked-core sources", async () => {
    const nodeRuntime = (globalThis as unknown as { process: NodeRuntime }).process;
    const childProcess = (await import(["node", "child_process"].join(":"))) as { spawnSync: SpawnSync };
    const fileSystem = (await import(["node", "fs/promises"].join(":"))) as FileSystem;
    const operatingSystem = (await import(["node", "os"].join(":"))) as OperatingSystem;
    const path = (await import(["node", "path"].join(":"))) as PathModule;
    const temporaryRoot = await fileSystem.mkdtemp(path.join(operatingSystem.tmpdir(), "orbitslash-ranked-core-"));
    const typesPath = path.join(temporaryRoot, "shared/ranked-core/types.ts");
    const indexPath = path.join(temporaryRoot, "shared/ranked-core/index.ts");
    const artifactPath = path.join(temporaryRoot, "supabase/functions/_shared/orbitslash-ranked-core.generated.ts");
    const generatorPath = path.join(temporaryRoot, "scripts/generate-ranked-edge-core.mjs");
    const typesLf = "export const RANKED_CORE_SCHEMA_VERSION = 1 as const;\n";
    const indexSource = [
      'export { RANKED_CORE_SCHEMA_VERSION } from "./types";',
      "",
      "// Generated by scripts/generate-ranked-edge-core.mjs.",
      'export const RANKED_CORE_RULES_HASH = "__RANKED_CORE_RULES_HASH__" as const;',
      "",
    ].join("\n");

    try {
      await fileSystem.mkdir(path.join(temporaryRoot, "scripts"), { recursive: true });
      await fileSystem.mkdir(path.join(temporaryRoot, "shared/ranked-core"), { recursive: true });
      await fileSystem.mkdir(path.join(temporaryRoot, "supabase/functions/_shared"), { recursive: true });
      await stageRankedCoreFixture(fileSystem, path, nodeRuntime.cwd(), temporaryRoot);
      await fileSystem.copyFile(path.join(nodeRuntime.cwd(), "scripts/generate-ranked-edge-core.mjs"), generatorPath);
      await fileSystem.writeFile(typesPath, typesLf, "utf8");
      await fileSystem.writeFile(indexPath, indexSource, "utf8");

      const lfResult = childProcess.spawnSync(nodeRuntime.execPath, [generatorPath], { cwd: temporaryRoot, encoding: "utf8" });
      expect(lfResult.status, lfResult.stderr).toBe(0);
      const lfHash = hashFromArtifact(await fileSystem.readFile(artifactPath, "utf8"));

      await fileSystem.writeFile(typesPath, typesLf.replaceAll("\n", "\r\n"), "utf8");
      const crlfResult = childProcess.spawnSync(nodeRuntime.execPath, [generatorPath], { cwd: temporaryRoot, encoding: "utf8" });
      expect(crlfResult.status, crlfResult.stderr).toBe(0);
      const crlfHash = hashFromArtifact(await fileSystem.readFile(artifactPath, "utf8"));

      expect(crlfHash).toBe(lfHash);
    } finally {
      await fileSystem.rm(temporaryRoot, { force: true, recursive: true });
    }
  });

  it("accepts a CRLF ranked-core checkout but rejects semantic drift", async () => {
    const nodeRuntime = (globalThis as unknown as { process: NodeRuntime }).process;
    const childProcess = (await import(["node", "child_process"].join(":"))) as { spawnSync: SpawnSync };
    const fileSystem = (await import(["node", "fs/promises"].join(":"))) as FileSystem;
    const operatingSystem = (await import(["node", "os"].join(":"))) as OperatingSystem;
    const path = (await import(["node", "path"].join(":"))) as PathModule;
    const temporaryRoot = await fileSystem.mkdtemp(path.join(operatingSystem.tmpdir(), "orbitslash-ranked-core-"));
    const typesPath = path.join(temporaryRoot, "shared/ranked-core/types.ts");
    const indexPath = path.join(temporaryRoot, "shared/ranked-core/index.ts");
    const artifactPath = path.join(temporaryRoot, "supabase/functions/_shared/orbitslash-ranked-core.generated.ts");
    const generatorPath = path.join(temporaryRoot, "scripts/generate-ranked-edge-core.mjs");
    const typesLf = "export const RANKED_CORE_SCHEMA_VERSION = 1 as const;\n";
    const indexSource = [
      'export { RANKED_CORE_SCHEMA_VERSION } from "./types";',
      "",
      "// Generated by scripts/generate-ranked-edge-core.mjs.",
      'export const RANKED_CORE_RULES_HASH = "__RANKED_CORE_RULES_HASH__" as const;',
      "",
    ].join("\n");

    try {
      await fileSystem.mkdir(path.join(temporaryRoot, "scripts"), { recursive: true });
      await fileSystem.mkdir(path.join(temporaryRoot, "shared/ranked-core"), { recursive: true });
      await fileSystem.mkdir(path.join(temporaryRoot, "supabase/functions/_shared"), { recursive: true });
      await stageRankedCoreFixture(fileSystem, path, nodeRuntime.cwd(), temporaryRoot);
      await fileSystem.copyFile(path.join(nodeRuntime.cwd(), "scripts/generate-ranked-edge-core.mjs"), generatorPath);
      await fileSystem.writeFile(typesPath, typesLf, "utf8");
      await fileSystem.writeFile(indexPath, indexSource, "utf8");
      const generateResult = childProcess.spawnSync(nodeRuntime.execPath, [generatorPath], { cwd: temporaryRoot, encoding: "utf8" });
      expect(generateResult.status, generateResult.stderr).toBe(0);

      await fileSystem.writeFile(typesPath, typesLf.replaceAll("\n", "\r\n"), "utf8");
      await fileSystem.writeFile(indexPath, (await fileSystem.readFile(indexPath, "utf8")).replaceAll("\n", "\r\n"), "utf8");
      await fileSystem.writeFile(artifactPath, (await fileSystem.readFile(artifactPath, "utf8")).replaceAll("\n", "\r\n"), "utf8");

      const crlfCheck = childProcess.spawnSync(nodeRuntime.execPath, [generatorPath, "--check"], { cwd: temporaryRoot, encoding: "utf8" });
      expect(crlfCheck.status, crlfCheck.stderr).toBe(0);

      await fileSystem.writeFile(typesPath, "export const RANKED_CORE_SCHEMA_VERSION = 2 as const;\r\n", "utf8");
      const semanticDriftCheck = childProcess.spawnSync(nodeRuntime.execPath, [generatorPath, "--check"], { cwd: temporaryRoot, encoding: "utf8" });
      expect(semanticDriftCheck.status).toBe(1);
    } finally {
      await fileSystem.rm(temporaryRoot, { force: true, recursive: true });
    }
  });
});
