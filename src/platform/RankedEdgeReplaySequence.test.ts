import { describe, expect, it } from "vitest";
import edgeSource from "../../supabase/functions/orbitslash-ranked-run/index.ts?raw";

type EdgeSpawn = {
  spawnOrdinal?: number;
  enemyType: string;
  spawnAtMs: number;
  startAngleRad: number;
  startRadius: number;
  angularSpeed: number;
  approachSpeed: number;
};

type RankedSummaryFixture = {
  difficulty: "rookie" | "defender" | "elite" | "master";
  seed: number;
  survivalMs: number;
};

type SpawnEvidence = Required<EdgeSpawn> & {
  source: "wave" | "boss" | "split" | "boss_shard";
  parentSpawnOrdinal?: number;
};

type KillEvidence = { spawnOrdinal: number; hitAtMs: number };

type EdgeHitEvidence = {
  eventSequence?: number;
  spawnOrdinal: number;
  hitAtMs: number;
  band: string;
  accuracy: string;
  damage: number;
  damageMultiplier?: number;
  source: "slash" | "solar_lance" | "skill";
  skillId?: string;
  segment?: { a: { x: number; y: number }; b: { x: number; y: number } };
};

type DesiredSequenceResult =
  | { ok: true; spawns: EdgeSpawn[] }
  | { ok: false; reason: "spawn_sequence_mismatch" };

type EdgeInternals = {
  beginRankedRun(
    supabase: unknown,
    difficulty: RankedSummaryFixture["difficulty"],
    authorizationHeader: string | null,
    supabaseUrl: string,
    rulesHash: string,
    rulesVersion: number,
  ): Promise<Response>;
  submitRankedRun(
    supabase: unknown,
    summary: unknown,
    replayTrace: unknown,
    rulesHash: string,
    rulesVersion: number,
    authorizationHeader: string | null,
    supabaseUrl: string,
  ): Promise<Response>;
  generateNormalSpawns(seed: number, survivalMs: number, difficulty: RankedSummaryFixture["difficulty"]): EdgeSpawn[];
  replayEnemyAt(spawn: EdgeSpawn, hitAtMs: number): EdgeSpawn;
  splitSpawnSpecsForEnemy(enemy: EdgeSpawn, hitAtMs: number): EdgeSpawn[];
  generateReplaySpawnsForTrace(
    summary: RankedSummaryFixture,
    trace: { spawnEvents?: SpawnEvidence[]; hitEvents: []; killEvents: KillEvidence[]; comboBreakEvents: []; skillEvents: [] },
  ): DesiredSequenceResult;
  replayTraceSummary(
    summary: { skillUse?: Record<string, number> },
    kills: Array<{ spawnOrdinal: number; hitAtMs: number; band: string; accuracy: string }>,
    comboBreaks: Array<{ atMs: number; reason: string }>,
    skillEvents: Array<{ eventSequence?: number; skillId: string; atMs: number }>,
    spawnByOrdinal: Map<number, EdgeSpawn>,
  ): { score: number; kills: number; maxCombo: number; lastSaveCount: number };
  replayHitProgression(
    hitEvents: EdgeHitEvidence[],
    spawnByOrdinal: Map<number, EdgeSpawn>,
    summary: { difficulty: RankedSummaryFixture["difficulty"]; survivalMs: number },
    skillEvents: Array<{ eventSequence?: number; skillId: string; atMs: number }>,
  ): { ok: true; kills: EdgeHitEvidence[] } | { ok: false; reason: string };
  validateReplayTrace(summary: unknown, trace: unknown): { ok: true } | { ok: false; reason: string };
};

type EsbuildModule = {
  build(options: {
    bundle: true;
    format: "esm";
    platform: "browser";
    target: string;
    write: false;
    stdin: { contents: string; loader: "ts"; resolveDir: string; sourcefile: string };
  }): Promise<{ outputFiles: Array<{ text: string }> }>;
};

async function loadEdgeInternals(): Promise<EdgeInternals> {
  const globals = globalThis as typeof globalThis & { Deno?: unknown };
  const hadDeno = "Deno" in globals;
  const previousDeno = globals.Deno;
  globals.Deno = { env: { get: () => undefined }, serve: () => undefined };

  try {
    const source = `${edgeSource
      .replace('import { createClient } from "https://esm.sh/@supabase/supabase-js@2";', "const createClient = (...args) => globalThis.__orbitslashEdgeCreateClient?.(...args) ?? ({ from: () => ({}) });")
      .replace('import { RANKED_CORE_RULES_HASH, RANKED_CORE_SCHEMA_VERSION } from "../_shared/orbitslash-ranked-core.generated.ts";', 'const RANKED_CORE_RULES_HASH = "test"; const RANKED_CORE_SCHEMA_VERSION = 1;')}
export { beginRankedRun, generateNormalSpawns, generateReplaySpawnsForTrace, replayEnemyAt, replayHitProgression, replayTraceSummary, splitSpawnSpecsForEnemy, submitRankedRun, validateReplayTrace };`;
    const esbuild = (await import("esbuild")) as unknown as EsbuildModule;
    const compiled = await esbuild.build({
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
      write: false,
      stdin: {
        contents: source,
        loader: "ts",
        resolveDir: `${(globalThis as unknown as { process: { cwd(): string } }).process.cwd()}/supabase/functions/orbitslash-ranked-run`,
        sourcefile: "index.ts",
      },
    });
    return await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(compiled.outputFiles[0]!.text)}`) as EdgeInternals;
  } finally {
    if (hadDeno) globals.Deno = previousDeno;
    else delete globals.Deno;
  }
}

async function withEdgeDeno<T>(operation: () => Promise<T>, env: Record<string, string | undefined> = {}): Promise<T> {
  const globals = globalThis as typeof globalThis & { Deno?: unknown };
  const hadDeno = "Deno" in globals;
  const previousDeno = globals.Deno;
  globals.Deno = { env: { get: (name: string) => env[name] } };
  try {
    return await operation();
  } finally {
    if (hadDeno) globals.Deno = previousDeno;
    else delete globals.Deno;
  }
}

function waveEvidence(spawns: EdgeSpawn[]): SpawnEvidence[] {
  return spawns.map((spawn) => ({
    spawnOrdinal: spawn.spawnOrdinal!,
    enemyType: spawn.enemyType,
    spawnAtMs: spawn.spawnAtMs,
    startAngleRad: spawn.startAngleRad,
    startRadius: spawn.startRadius,
    angularSpeed: spawn.angularSpeed,
    approachSpeed: spawn.approachSpeed,
    source: "wave" as const,
  }));
}

function traceWith(spawnEvents: SpawnEvidence[], killEvents: KillEvidence[] = []) {
  return { spawnEvents, hitEvents: [] as [], killEvents, comboBreakEvents: [] as [], skillEvents: [] as [] };
}

type EdgeRankedRulesFixture = {
  enemies: Record<string, { hp: number }>;
  difficulty: { zones: { lastSave: number } };
  scoring: { combatGaugeGainMultiplier?: number; gaugeGain: Record<string, number> };
  skills: { solar_lance: { gaugeCost: number; hitDamage?: number } };
};

function actualSequenceReplayFixture(
  edge: EdgeInternals,
  rules: EdgeRankedRulesFixture,
  order: "kill_before_skill" | "skill_before_own_kill",
) {
  const difficulty = "rookie" as const;
  const seed = 1234;
  const survivalMs = 25_000;
  const spawns = edge.generateNormalSpawns(seed, survivalMs, difficulty)
    .map((spawn, index) => ({ ...spawn, spawnOrdinal: index + 1 }));
  const candidates = spawns.slice(0, 12).map((spawn) => {
    const targetRadius = rules.difficulty.zones.lastSave * 58 + 10;
    const killAtMs = Math.ceil(spawn.spawnAtMs + ((spawn.startRadius - targetRadius) / spawn.approachSpeed) * 1_000);
    return { spawn, killAtMs };
  }).sort((a, b) => a.killAtMs - b.killAtMs || a.spawn.spawnOrdinal! - b.spawn.spawnOrdinal!);
  for (let index = 1; index < candidates.length; index += 1) {
    candidates[index]!.killAtMs = Math.max(candidates[index]!.killAtMs, candidates[index - 1]!.killAtMs + 1);
  }
  const multiplier = rules.scoring.combatGaugeGainMultiplier ?? 1;
  let earnedGauge = 0;
  let crossingIndex = -1;
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]!;
    earnedGauge += ((rules.scoring.gaugeGain[candidate.spawn.enemyType] ?? 0) + (rules.scoring.gaugeGain.lastSave ?? 0)) * multiplier;
    if (earnedGauge >= rules.skills.solar_lance.gaugeCost) {
      crossingIndex = index;
      break;
    }
  }
  if (crossingIndex < 0) throw new Error("fixture did not earn solar_lance charge");
  const targets = candidates.slice(0, crossingIndex + 1);
  const ownKillTarget = targets.at(-1)!;
  const records: Array<{ event: EdgeHitEvidence; kill: boolean; ownKill: boolean }> = [];

  for (const target of targets) {
    const ownKill = order === "skill_before_own_kill" && target === ownKillTarget;
    const hp = rules.enemies[target.spawn.enemyType]!.hp;
    const hitCount = ownKill ? 1 : hp;
    for (let index = 0; index < hitCount; index += 1) {
      const hitAtMs = target.killAtMs - (hitCount - index - 1);
      const elapsedSec = (hitAtMs - target.spawn.spawnAtMs) / 1_000;
      const angle = target.spawn.startAngleRad + target.spawn.angularSpeed * elapsedSec;
      const radius = target.spawn.startRadius - target.spawn.approachSpeed * elapsedSec;
      const x = 540 + Math.cos(angle) * radius;
      const y = 900 + Math.sin(angle) * radius;
      records.push({
        event: {
          spawnOrdinal: target.spawn.spawnOrdinal!,
          hitAtMs,
          band: "lastSave",
          accuracy: "normal",
          damage: ownKill ? (rules.skills.solar_lance.hitDamage ?? 1) : 1,
          source: ownKill ? "solar_lance" : "slash",
          skillId: ownKill ? "solar_lance" : undefined,
          segment: { a: { x: x - 120, y }, b: { x: x + 120, y } },
        },
        kill: index === hitCount - 1,
        ownKill,
      });
    }
  }
  records.sort((a, b) => a.event.hitAtMs - b.event.hitAtMs || a.event.spawnOrdinal - b.event.spawnOrdinal);

  let eventSequence = 1;
  let skillEvent: { eventSequence: number; skillId: string; atMs: number };
  if (order === "skill_before_own_kill") {
    for (const record of records) {
      if (record.ownKill) {
        skillEvent = { eventSequence: eventSequence++, skillId: "solar_lance", atMs: record.event.hitAtMs };
      }
      record.event.eventSequence = eventSequence++;
    }
  } else {
    for (const record of records) record.event.eventSequence = eventSequence++;
    skillEvent = { eventSequence, skillId: "solar_lance", atMs: Math.max(...records.map((record) => record.event.hitAtMs)) };
  }

  const hitEvents = records.map((record) => record.event);
  const killEvents = records.filter((record) => record.kill).map((record) => ({ ...record.event }));
  const spawnByOrdinal = new Map(spawns.map((spawn) => [spawn.spawnOrdinal!, spawn] as const));
  const replayed = edge.replayTraceSummary(
    { skillUse: { solar_lance: 1 } },
    killEvents,
    [],
    [skillEvent!],
    spawnByOrdinal,
  );
  const summary = {
    modeId: "ranked",
    runToken: `server-ranked-run-edge-${order}`,
    seed,
    difficulty,
    survivalMs,
    score: replayed.score,
    kills: replayed.kills,
    maxCombo: replayed.maxCombo,
    lastSaveCount: replayed.lastSaveCount,
    remainingEnergy: 100,
    skillUse: { solar_lance: 1 },
  };
  return { summary, trace: { hitEvents, killEvents, comboBreakEvents: [], skillEvents: [skillEvent!] } };
}

function splitFixture(edge: EdgeInternals): { summary: RankedSummaryFixture; trace: ReturnType<typeof traceWith>; split: SpawnEvidence } {
  for (let seed = 1; seed <= 128; seed += 1) {
    // Defender's canonical table introduces ice_comet after the 21s band.
    const summary = { difficulty: "defender" as const, seed, survivalMs: 60_000 };
    const base = edge.generateNormalSpawns(summary.seed, summary.survivalMs, summary.difficulty)
      .map((spawn, index) => ({ ...spawn, spawnOrdinal: index + 1 }));
    const parent = base.find((spawn) => spawn.enemyType === "ice_comet");
    if (!parent) continue;

    const hitAtMs = parent.spawnAtMs + 1;
    const splitSpecs = edge.splitSpawnSpecsForEnemy(edge.replayEnemyAt(parent, hitAtMs), hitAtMs);
    if (splitSpecs.length === 0) continue;
    const combined = [
      ...waveEvidence(base),
      ...splitSpecs.map((spawn) => ({
        ...spawn,
        spawnOrdinal: 0,
        source: "split" as const,
        parentSpawnOrdinal: parent.spawnOrdinal!,
      })),
    ]
      .sort((a, b) => a.spawnAtMs - b.spawnAtMs)
      .map((spawn, index) => ({ ...spawn, spawnOrdinal: index + 1 }));
    const canonicalParent = combined.find((spawn) => spawn.source === "wave" && spawn.enemyType === parent.enemyType && spawn.spawnAtMs === parent.spawnAtMs)!;
    const evidence = combined.map((spawn) => spawn.source === "split"
      ? { ...spawn, parentSpawnOrdinal: canonicalParent.spawnOrdinal }
      : spawn);
    const split = evidence.find((spawn) => spawn.source === "split")!;
    return {
      summary,
      trace: traceWith(evidence, [{ spawnOrdinal: canonicalParent.spawnOrdinal, hitAtMs }]),
      split,
    };
  }
  throw new Error("fixture seed without an ice_comet split parent");
}

describe("ranked Edge replay spawn sequence", () => {
  const summary = { difficulty: "rookie" as const, seed: 1234, survivalMs: 5_000 };

  it("binds the current generated rules contract when issuing a ranked token", async () => {
    const edge = await loadEdgeInternals();
    const inserted: Array<Record<string, unknown>> = [];
    const supabase = {
      from(table: string) {
        expect(table).toBe("orbitslash_runs");
        return {
          insert: async (row: Record<string, unknown>) => {
            inserted.push(row);
            return { error: null };
          },
        };
      },
    };

    const response = await withEdgeDeno(() => edge.beginRankedRun(supabase, "rookie", null, "https://example.invalid", "test", 1));

    expect(response.status).toBe(200);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ rules_hash: "test", rules_version: 1 });
  });

  it("rejects a stale issued rules contract before creating a score", async () => {
    const edge = await loadEdgeInternals();
    let selectedColumns = "";
    let scoreInsertCount = 0;
    const supabase = {
      from(table: string) {
        if (table === "orbitslash_runs") {
          return {
            select(columns: string) {
              selectedColumns = columns;
              return {
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: "run-id",
                      run_token: "server-ranked-issued-under-old-rules",
                      seed: 17,
                      difficulty: "rookie",
                      config_version: "server-ranked-v1",
                      status: "started",
                      expires_at: "2099-01-01T00:00:00.000Z",
                      used_at: null,
                      core_user_id: "core-user-id",
                      rules_hash: "stale-rules-hash",
                      rules_version: 1,
                    },
                    error: null,
                  }),
                }),
              };
            },
          };
        }
        if (table === "orbitslash_scores") {
          return {
            insert: async () => {
              scoreInsertCount += 1;
              return { error: null };
            },
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
    };

    const response = await withEdgeDeno(() => edge.submitRankedRun(supabase, {
      modeId: "ranked",
      runToken: "server-ranked-issued-under-old-rules",
      seed: 17,
      difficulty: "rookie",
      survivalMs: 0,
      score: 0,
      kills: 0,
      maxCombo: 0,
      lastSaveCount: 0,
      remainingEnergy: 100,
      skillUse: {},
    }, {
      hitEvents: [],
      killEvents: [],
      comboBreakEvents: [],
      skillEvents: [],
    }, "test", 1, null, "https://example.invalid"));

    expect(selectedColumns).toContain("rules_hash");
    expect(selectedColumns).toContain("rules_version");
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "ranked_rules_mismatch" });
    expect(scoreInsertCount).toBe(0);
  });

  it("rejects a submit bearer bound to a different core user before creating a score", async () => {
    const edge = await loadEdgeInternals();
    const globals = globalThis as typeof globalThis & {
      __orbitslashEdgeCreateClient?: () => { auth: { getUser: () => Promise<unknown> } };
    };
    const previousCreateClient = globals.__orbitslashEdgeCreateClient;
    globals.__orbitslashEdgeCreateClient = () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "attacker-auth-id" } }, error: null }),
      },
    });
    let scoreInsertCount = 0;
    try {
      const supabase = {
        from(table: string) {
          if (table === "orbitslash_runs") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: "run-id",
                      run_token: "server-ranked-issued-user-a",
                      seed: 17,
                      difficulty: "rookie",
                      config_version: "server-ranked-v1",
                      status: "started",
                      expires_at: "2099-01-01T00:00:00.000Z",
                      used_at: null,
                      core_user_id: "core-user-a",
                      rules_hash: "test",
                      rules_version: 1,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "authmap_user_identities") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { core_user_id: "core-user-b" }, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "orbitslash_scores") {
            return {
              insert: async () => {
                scoreInsertCount += 1;
                return { error: null };
              },
            };
          }
          throw new Error(`unexpected table: ${table}`);
        },
      };

      const response = await withEdgeDeno(() => edge.submitRankedRun(supabase, {
        modeId: "ranked",
        runToken: "server-ranked-issued-user-a",
        seed: 17,
        difficulty: "rookie",
        survivalMs: 0,
        score: 0,
        kills: 0,
        maxCombo: 0,
        lastSaveCount: 0,
        remainingEnergy: 100,
        skillUse: {},
      }, { hitEvents: [], killEvents: [], comboBreakEvents: [], skillEvents: [] }, "test", 1, "Bearer attacker-token", "https://example.invalid"), {
        SUPABASE_ANON_KEY: "anon-key",
      });

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({ ok: false, reason: "caller_identity_mismatch" });
      expect(scoreInsertCount).toBe(0);
    } finally {
      if (previousCreateClient) globals.__orbitslashEdgeCreateClient = previousCreateClient;
      else delete globals.__orbitslashEdgeCreateClient;
    }
  });

  it("matches the actual ranked WaveGenerator runtime and both core copies for every difficulty", async () => {
    const edge = await loadEdgeInternals();
    const clientCore = await import("../../shared/ranked-core/spawn");
    const generatedCore = await import("../../supabase/functions/_shared/ranked-core/spawn");
    const generatedRules = await import("../../supabase/functions/_shared/ranked-core/data");
    const { WaveGenerator } = await import("../game/WaveGenerator");
    const { createRng } = await import("../game/Rng");
    const { buildRunConfig } = await import("../game/ModeConfig");
    const { modeSpawnIntervalMultiplierAt, resolveModeRuntimeRules } = await import("../game/ModeRuleEngine");
    const enemies = (await import("../data/enemies.json")).default;
    const difficultyTable = (await import("../data/difficulty.json")).default;
    const orbits = (await import("../data/orbits.json")).default;
    const waves = (await import("../data/waves.json")).default;

    for (const [difficulty, seed] of [["rookie", 101], ["defender", 202], ["elite", 303], ["master", 404]] as const) {
      const config = buildRunConfig("ranked", { difficulty, seed, configVersion: "server-ranked-v1" });
      const runtimeRules = resolveModeRuntimeRules(config);
      const summary = { difficulty, seed, survivalMs: 80_000 };
      const player = new WaveGenerator(createRng(seed), {
        difficulty: config.difficulty,
        spawnIntervalMultiplierForElapsed: (elapsedMs) => modeSpawnIntervalMultiplierAt(runtimeRules, elapsedMs),
        enemyWeightBias: runtimeRules.enemyWeightBias,
      }, enemies as never, difficultyTable as never, orbits.profiles as never, waves as never).next(summary.survivalMs);
      const client = clientCore.generateRankedCoreSpawns(summary, generatedRules.RANKED_CORE_RULES as never)
        .filter((spawn) => spawn.source === "wave")
        .map(({ source: _source, parentSpawnOrdinal: _parentSpawnOrdinal, spawnOrdinal: _spawnOrdinal, ...spawn }) => spawn);
      const generated = generatedCore.generateRankedCoreSpawns(summary, generatedRules.RANKED_CORE_RULES as never)
        .filter((spawn) => spawn.source === "wave")
        .map(({ source: _source, parentSpawnOrdinal: _parentSpawnOrdinal, spawnOrdinal: _spawnOrdinal, ...spawn }) => spawn);

      expect(player).toEqual(client);
      expect(generated).toEqual(client);
      expect(edge.generateNormalSpawns(seed, summary.survivalMs, difficulty)).toEqual(client);
    }
  });

  it("rejects a forged normal slash damage multiplier in actual Edge replay progression", async () => {
    const edge = await loadEdgeInternals();
    const spawn: EdgeSpawn = {
      spawnOrdinal: 1,
      enemyType: "shard_meteor",
      spawnAtMs: 0,
      startAngleRad: 0,
      startRadius: 900,
      angularSpeed: 0,
      approachSpeed: 0,
    };

    expect(edge.replayHitProgression([{
      spawnOrdinal: 1,
      hitAtMs: 1,
      band: "outer",
      accuracy: "normal",
      source: "slash",
      damage: 9999,
      damageMultiplier: 9999,
      segment: { a: { x: 1410, y: 900 }, b: { x: 1470, y: 900 } },
    }], new Map([[1, spawn]]), { difficulty: "rookie", survivalMs: 1_000 }, [])).toEqual({
      ok: false,
      reason: "replay_trace_summary_mismatch",
    });
  });

  it("rejects partially sequenced semantic traces at the Edge boundary", async () => {
    const edge = await loadEdgeInternals();

    expect(edge.validateReplayTrace({
      modeId: "ranked",
      runToken: "server-ranked-run-partial-sequence",
      seed: 1,
      difficulty: "rookie",
      survivalMs: 1_000,
      score: 0,
      kills: 1,
      maxCombo: 0,
      lastSaveCount: 0,
      remainingEnergy: 100,
      skillUse: {},
    }, {
      hitEvents: [{ eventSequence: 1 }],
      killEvents: [{}],
      comboBreakEvents: [],
      skillEvents: [],
    })).toEqual({ ok: false, reason: "replay_trace_summary_mismatch" });
  });

  it("rejects Edge semantic sequences whose timestamps move backward", async () => {
    const edge = await loadEdgeInternals();

    expect(edge.validateReplayTrace({ kills: 1 }, {
      hitEvents: [{ eventSequence: 2, hitAtMs: 50 }],
      killEvents: [{ eventSequence: 2, hitAtMs: 50 }],
      comboBreakEvents: [],
      skillEvents: [{ eventSequence: 1, skillId: "solar_lance", atMs: 100 }],
    })).toEqual({ ok: false, reason: "replay_trace_summary_mismatch" });
  });

  it("requires a matching skill sequence to strictly precede its Edge hit", async () => {
    const edge = await loadEdgeInternals();
    const { RANKED_CORE_RULES } = await import("../../supabase/functions/_shared/ranked-core/data");
    const spawn: EdgeSpawn = {
      spawnOrdinal: 1,
      enemyType: "shard_meteor",
      spawnAtMs: 0,
      startAngleRad: 0,
      startRadius: 900,
      angularSpeed: 0,
      approachSpeed: 0,
    };
    const hit: EdgeHitEvidence = {
      eventSequence: 2,
      spawnOrdinal: 1,
      hitAtMs: 100,
      band: "outer",
      accuracy: "normal",
      damage: RANKED_CORE_RULES.skills.nova_pulse.hitDamage ?? 1,
      source: "skill",
      skillId: "nova_pulse",
    };
    const summary = { difficulty: "rookie" as const, survivalMs: 1_000 };

    expect(edge.replayHitProgression(
      [hit],
      new Map([[1, spawn]]),
      summary,
      [{ eventSequence: 1, skillId: "nova_pulse", atMs: 100 }],
    )).toEqual({ ok: true, kills: [hit] });
    expect(edge.replayHitProgression(
      [hit],
      new Map([[1, spawn]]),
      summary,
      [{ eventSequence: 2, skillId: "nova_pulse", atMs: 100 }],
    )).toEqual({ ok: false, reason: "replay_trace_invalid_geometry" });
    expect(edge.replayHitProgression(
      [hit],
      new Map([[1, spawn]]),
      summary,
      [{ eventSequence: 1, skillId: "nova_pulse", atMs: 150 }],
    )).toEqual({ ok: false, reason: "replay_trace_invalid_geometry" });
  });

  it("validates same-millisecond sequence funding through the actual Edge replay boundary", async () => {
    const edge = await loadEdgeInternals();
    const { RANKED_CORE_RULES } = await import("../../supabase/functions/_shared/ranked-core/data");
    const normal = actualSequenceReplayFixture(edge, RANKED_CORE_RULES, "kill_before_skill");
    const selfFund = actualSequenceReplayFixture(edge, RANKED_CORE_RULES, "skill_before_own_kill");

    expect(edge.validateReplayTrace(normal.summary, normal.trace)).toEqual({ ok: true });
    expect(edge.validateReplayTrace(selfFund.summary, selfFund.trace)).toEqual({
      ok: false,
      reason: "replay_skill_timeline_invalid",
    });
  });

  it("keeps a non-empty all-missing legacy sequence trace valid through the actual Edge replay boundary", async () => {
    const edge = await loadEdgeInternals();
    const { RANKED_CORE_RULES } = await import("../../supabase/functions/_shared/ranked-core/data");
    const current = actualSequenceReplayFixture(edge, RANKED_CORE_RULES, "kill_before_skill");
    const legacy = {
      hitEvents: current.trace.hitEvents.map(({ eventSequence: _eventSequence, ...event }) => event),
      killEvents: current.trace.killEvents.map(({ eventSequence: _eventSequence, ...event }) => event),
      comboBreakEvents: [],
      skillEvents: current.trace.skillEvents.map(({ eventSequence: _eventSequence, ...event }) => ({ ...event, atMs: event.atMs + 1 })),
    };

    expect(legacy.hitEvents.length).toBeGreaterThan(0);
    expect(legacy.killEvents.length).toBeGreaterThan(0);
    expect(legacy.skillEvents.length).toBeGreaterThan(0);
    expect([...legacy.hitEvents, ...legacy.killEvents, ...legacy.skillEvents]).toSatisfy(
      (events: Array<Record<string, unknown>>) => events.every((event) => !("eventSequence" in event)),
    );
    expect(edge.validateReplayTrace(current.summary, legacy)).toEqual({ ok: true });
  });

  it("replays every canonical zone boundary for all difficulties with the same band as GameScene", async () => {
    const edge = await loadEdgeInternals();
    const { EARTH_CENTER_X, EARTH_CENTER_Y, EARTH_GAMEPLAY_RADIUS, distanceBand } = await import("../game/coords");
    const { RANKED_CORE_RULES } = await import("../../supabase/functions/_shared/ranked-core/data");
    const zones = RANKED_CORE_RULES.difficulty.zones;

    for (const difficulty of ["rookie", "defender", "elite", "master"] as const) {
      for (const radius of [
        zones.outer * EARTH_GAMEPLAY_RADIUS - 0.01,
        zones.outer * EARTH_GAMEPLAY_RADIUS,
        zones.mid * EARTH_GAMEPLAY_RADIUS - 0.01,
        zones.mid * EARTH_GAMEPLAY_RADIUS,
        zones.danger * EARTH_GAMEPLAY_RADIUS - 0.01,
        zones.danger * EARTH_GAMEPLAY_RADIUS,
        zones.lastSave * EARTH_GAMEPLAY_RADIUS - 0.01,
        zones.lastSave * EARTH_GAMEPLAY_RADIUS,
      ]) {
        const band = distanceBand(radius, EARTH_GAMEPLAY_RADIUS, zones);
        const spawn: EdgeSpawn = {
          spawnOrdinal: 1,
          enemyType: "shard_meteor",
          spawnAtMs: 0,
          startAngleRad: 0,
          startRadius: radius,
          angularSpeed: 0,
          approachSpeed: 0,
        };
        const event: EdgeHitEvidence = {
          spawnOrdinal: 1,
          hitAtMs: 1,
          band,
          accuracy: "normal",
          damage: 1,
          source: "slash",
          segment: {
            a: { x: EARTH_CENTER_X + radius - 40, y: EARTH_CENTER_Y },
            b: { x: EARTH_CENTER_X + radius + 40, y: EARTH_CENTER_Y },
          },
        };

        expect(edge.replayHitProgression([event], new Map([[1, spawn]]), { difficulty, survivalMs: 1_000 }, [])).toEqual({
          ok: true,
          kills: [event],
        });
        expect(edge.replayHitProgression([{ ...event, band: band === "outer" ? "mid" : "outer" }], new Map([[1, spawn]]), { difficulty, survivalMs: 1_000 }, [])).toEqual({
          ok: false,
          reason: "replay_trace_summary_mismatch",
        });
      }
    }
  });

  it("rejects a locked boss body hit and accepts only the canonical current-phase weak point", async () => {
    const edge = await loadEdgeInternals();
    const spawn: EdgeSpawn = {
      spawnOrdinal: 1,
      enemyType: "ringed_destroyer",
      spawnAtMs: 0,
      startAngleRad: 0,
      startRadius: 900,
      angularSpeed: 0,
      approachSpeed: 0,
    };
    const summary = { difficulty: "rookie" as const, survivalMs: 1_000 };

    expect(edge.replayHitProgression([{
      spawnOrdinal: 1,
      hitAtMs: 1,
      band: "outer",
      accuracy: "normal",
      source: "slash",
      damage: 1,
      segment: { a: { x: 1410, y: 900 }, b: { x: 1470, y: 900 } },
    }], new Map([[1, spawn]]), summary, [])).toEqual({
      ok: false,
      reason: "replay_trace_invalid_geometry",
    });

    expect(edge.replayHitProgression([{
      spawnOrdinal: 1,
      hitAtMs: 1,
      band: "outer",
      accuracy: "bossWeak",
      source: "slash",
      damage: 2,
      damageMultiplier: 1.45,
      segment: { a: { x: 1530, y: 1021 }, b: { x: 1590, y: 1021 } },
    }], new Map([[1, spawn]]), summary, [])).toEqual({ ok: true, kills: [] });
  });

  it("accepts exact client wave evidence for the server-regenerated sequence", async () => {
    const edge = await loadEdgeInternals();
    const expected = edge.generateNormalSpawns(summary.seed, summary.survivalMs, summary.difficulty)
      .map((spawn, index) => ({ ...spawn, spawnOrdinal: index + 1 }));

    expect(edge.generateReplaySpawnsForTrace(summary, traceWith(waveEvidence(expected)))).toMatchObject({ ok: true });
  });

  it("rejects an injected low-HP wave even when its spawn evidence is well formed", async () => {
    const edge = await loadEdgeInternals();
    const expected = edge.generateNormalSpawns(summary.seed, summary.survivalMs, summary.difficulty)
      .map((spawn, index) => ({ ...spawn, spawnOrdinal: index + 1 }));
    const injected: SpawnEvidence = {
      spawnOrdinal: expected.length + 1,
      source: "wave",
      enemyType: "shard_meteor",
      spawnAtMs: summary.survivalMs,
      startAngleRad: 0,
      startRadius: 900,
      angularSpeed: 0.68,
      approachSpeed: 82,
    };

    expect(edge.generateReplaySpawnsForTrace(summary, traceWith([...waveEvidence(expected), injected]))).toEqual({
      ok: false,
      reason: "spawn_sequence_mismatch",
    });
  });

  it("rejects client evidence that omits an expected server wave", async () => {
    const edge = await loadEdgeInternals();
    const expected = edge.generateNormalSpawns(summary.seed, summary.survivalMs, summary.difficulty)
      .map((spawn, index) => ({ ...spawn, spawnOrdinal: index + 1 }));

    expect(edge.generateReplaySpawnsForTrace(summary, traceWith(waveEvidence(expected).slice(1)))).toEqual({
      ok: false,
      reason: "spawn_sequence_mismatch",
    });
  });

  it("rejects altered or permuted normal spawn ordinals", async () => {
    const edge = await loadEdgeInternals();
    const expected = edge.generateNormalSpawns(summary.seed, summary.survivalMs, summary.difficulty)
      .map((spawn, index) => ({ ...spawn, spawnOrdinal: index + 1 }));
    const altered = waveEvidence(expected);
    altered[0] = { ...altered[0]!, spawnOrdinal: altered[0]!.spawnOrdinal + 1 };

    expect(edge.generateReplaySpawnsForTrace(summary, traceWith(altered))).toEqual({ ok: false, reason: "spawn_sequence_mismatch" });
    expect(edge.generateReplaySpawnsForTrace(summary, traceWith([...waveEvidence(expected)].reverse()))).toEqual({ ok: false, reason: "spawn_sequence_mismatch" });
  });

  it("derives an exact split sequence and rejects duplicate split evidence", async () => {
    const edge = await loadEdgeInternals();
    const fixture = splitFixture(edge);

    expect(edge.generateReplaySpawnsForTrace(fixture.summary, fixture.trace)).toMatchObject({ ok: true });
    expect(edge.generateReplaySpawnsForTrace(fixture.summary, traceWith([
      ...fixture.trace.spawnEvents,
      { ...fixture.split, spawnOrdinal: fixture.trace.spawnEvents.length + 1 },
    ], fixture.trace.killEvents))).toEqual({ ok: false, reason: "spawn_sequence_mismatch" });
  });

  it("rejects boss shard evidence until the Edge can derive its phase schedule", async () => {
    const edge = await loadEdgeInternals();
    const expected = edge.generateNormalSpawns(summary.seed, summary.survivalMs, summary.difficulty)
      .map((spawn, index) => ({ ...spawn, spawnOrdinal: index + 1 }));

    expect(edge.generateReplaySpawnsForTrace(summary, traceWith([
      ...waveEvidence(expected),
      {
        ...waveEvidence(expected)[0]!,
        spawnOrdinal: expected.length + 1,
        source: "boss_shard",
        parentSpawnOrdinal: 1,
        enemyType: "shard_meteor",
      },
    ]))).toEqual({ ok: false, reason: "spawn_sequence_mismatch" });
  });

  it("uses the generated scoring rules for Edge replay summary", async () => {
    const edge = await loadEdgeInternals();
    const core = await import("../../shared/ranked-core/score");
    const rules = await import("../../supabase/functions/_shared/ranked-core/data");
    const kills = [
      { spawnOrdinal: 1, hitAtMs: 100, band: "outer", accuracy: "normal" },
      { spawnOrdinal: 2, hitAtMs: 200, band: "lastSave", accuracy: "directional" },
    ];
    const spawns = new Map<number, EdgeSpawn>([
      [1, { spawnOrdinal: 1, enemyType: "basic_meteor", spawnAtMs: 0, startAngleRad: 0, startRadius: 920, angularSpeed: 0.5, approachSpeed: 62 }],
      [2, { spawnOrdinal: 2, enemyType: "small_meteor", spawnAtMs: 0, startAngleRad: 0, startRadius: 900, angularSpeed: 0.6, approachSpeed: 72 }],
    ]);
    const expected = core.replayRankedScore(kills.map((kill) => ({ ...kill, enemyType: spawns.get(kill.spawnOrdinal)!.enemyType })) as never, [], rules.RANKED_CORE_RULES as never);

    expect(edge.replayTraceSummary({ skillUse: {} }, kills, [], [], spawns)).toEqual(expected);
  });
});
