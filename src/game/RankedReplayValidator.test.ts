import { describe, expect, it } from "vitest";
import { createRunSummary } from "./RankingSystem";
import {
  computeRankedReplayBounds,
  DEFAULT_RANKED_REPLAY_TABLES,
  generateRankedReplaySpawns,
  generateRankedReplaySpawnsForTrace,
  validateRankedKillGeometry,
  validateRankedReplaySubmission,
} from "./RankedReplayValidator";
import type { RankedReplayTrace } from "./RankedReplayTrace";
import { ScoringSystem } from "./ScoringSystem";
import enemiesJson from "../data/enemies.json";
import difficultyJson from "../data/difficulty.json";
import orbitsJson from "../data/orbits.json";
import scoringJson from "../data/scoring.json";
import skillsJson from "../data/skills.json";
import wavesJson from "../data/waves.json";
import type { EnemyTable, ScoringConfig, SpawnSpec, WaveTable } from "./types";
import { createRankedCoreRulesFromJson, RANKED_CORE_RULES_HASH, RANKED_CORE_SCHEMA_VERSION, replayRankedScore } from "../../shared/ranked-core";
import { EARTH_CENTER_X, EARTH_CENTER_Y, EARTH_GAMEPLAY_RADIUS, distanceBand } from "./coords";

const enemies = enemiesJson as EnemyTable;
const scoringConfig = scoringJson as unknown as ScoringConfig;

function missSegment() {
  return {
    a: { x: 0, y: 0, t: 0 },
    b: { x: 1, y: 1, t: 16 },
  };
}

function hitSegment(spawn: SpawnSpec, hitAtMs = spawn.spawnAtMs + 1) {
  const def = enemies[spawn.enemyType]!;
  const elapsedSec = Math.max(0, hitAtMs - spawn.spawnAtMs) / 1000;
  const angle = spawn.startAngleRad + spawn.angularSpeed * elapsedSec;
  const radius = spawn.startRadius - spawn.approachSpeed * elapsedSec;
  const x = 540 + Math.cos(angle) * radius;
  const y = 900 + Math.sin(angle) * radius;
  return {
    a: { x: x - def.radiusPx, y, t: hitAtMs - 16 },
    b: { x: x + def.radiusPx, y, t: hitAtMs },
  };
}

function oneKillFixture() {
  const base = {
    modeId: "ranked" as const,
    runToken: "server-ranked-run-1",
    seed: 1234,
    difficulty: "rookie",
    survivalMs: 5000,
    remainingEnergy: 100,
  };
  const first = generateRankedReplaySpawns(base)[0]!;
  const score = enemies[first.enemyType]!.score;
  const hp = enemies[first.enemyType]!.hp;
  const hitEvents = Array.from({ length: hp }, (_, index) => {
    const hitAtMs = first.spawnAtMs + index + 1;
    return {
      spawnOrdinal: first.spawnOrdinal!,
      hitAtMs,
      band: "outer" as const,
      accuracy: "normal" as const,
      damage: 1,
      source: "slash" as const,
      segment: hitSegment(first, hitAtMs),
    };
  });
  const killHit = hitEvents[hitEvents.length - 1]!;
  const trace: RankedReplayTrace = {
    hitEvents,
    killEvents: [
      {
        spawnOrdinal: killHit.spawnOrdinal,
        hitAtMs: killHit.hitAtMs,
        band: killHit.band,
        accuracy: killHit.accuracy,
        damage: killHit.damage,
        source: killHit.source,
        segment: killHit.segment,
      },
    ],
    comboBreakEvents: [],
    skillEvents: [],
  };
  const summary = createRunSummary({
    ...base,
    score,
    kills: 1,
    maxCombo: 1,
    lastSaveCount: 0,
  });
  return { first, summary, trace };
}

function twoKillFixture() {
  const base = {
    modeId: "ranked" as const,
    runToken: "server-ranked-run-2",
    seed: 1234,
    difficulty: "rookie",
    survivalMs: 5000,
    remainingEnergy: 100,
  };
  const [first, second] = generateRankedReplaySpawns(base);
  const hitEvents = [first!, second!].flatMap((spawn) => Array.from({ length: enemies[spawn.enemyType]!.hp }, (_, index) => {
    const hitAtMs = spawn.spawnAtMs + index + 1;
    return {
      spawnOrdinal: spawn.spawnOrdinal!,
      hitAtMs,
      band: "outer" as const,
      accuracy: "normal" as const,
      damage: 1,
      source: "slash" as const,
      segment: hitSegment(spawn, hitAtMs),
    };
  }));
  const killEvents = [first!, second!].map((spawn) => {
    const killHit = hitEvents.filter((event) => event.spawnOrdinal === spawn.spawnOrdinal).at(-1)!;
    return { ...killHit };
  });
  const typeByOrdinal = new Map([first!, second!].map((spawn) => [spawn.spawnOrdinal!, spawn.enemyType] as const));
  const scoringSnapshot = replayRankedScore(
    killEvents.map((kill) => ({
      spawnOrdinal: kill.spawnOrdinal,
      enemyType: typeByOrdinal.get(kill.spawnOrdinal)!,
      hitAtMs: kill.hitAtMs,
      band: kill.band,
      accuracy: kill.accuracy,
    })),
    [],
    createRankedCoreRulesFromJson(enemiesJson, difficultyJson, orbitsJson, wavesJson, scoringJson, skillsJson),
  );
  const trace: RankedReplayTrace = {
    hitEvents,
    killEvents,
    comboBreakEvents: [],
    skillEvents: [],
  };
  const summary = createRunSummary({
    ...base,
    score: scoringSnapshot.score,
    kills: scoringSnapshot.kills,
    maxCombo: scoringSnapshot.maxCombo,
    lastSaveCount: scoringSnapshot.lastSaveCount,
  });
  return { first: first!, second: second!, summary, trace };
}

function spawnEventsFor(spawns: SpawnSpec[]): NonNullable<RankedReplayTrace["spawnEvents"]> {
  return spawns.map((spawn) => ({
    spawnOrdinal: spawn.spawnOrdinal!,
    source: enemies[spawn.enemyType]?.boss ? "boss" : "wave",
    enemyType: spawn.enemyType,
    spawnAtMs: spawn.spawnAtMs,
    startAngleRad: spawn.startAngleRad,
    startRadius: spawn.startRadius,
    angularSpeed: spawn.angularSpeed,
    approachSpeed: spawn.approachSpeed,
  }));
}

function tablesWithSingleEnemy(difficulty: "rookie" | "defender" | "elite" | "master", enemyType: string) {
  return {
    ...DEFAULT_RANKED_REPLAY_TABLES,
    waves: {
      ...DEFAULT_RANKED_REPLAY_TABLES.waves,
      [difficulty]: [
        {
          fromMs: 0,
          spawnIntervalMs: 800,
          approachSpeedMul: 1,
          weights: { [enemyType]: 1 },
        },
      ],
    } as WaveTable,
  };
}

function sameMillisecondSequenceFixture(source: "slash" | "solar_lance") {
  const baseTables = tablesWithSingleEnemy("rookie", "shard_meteor");
  const tables = {
    ...baseTables,
    scoring: {
      ...scoringConfig,
      combatGaugeGainMultiplier: 1,
      gaugeGain: { ...scoringConfig.gaugeGain, shard_meteor: 1, comboKill: 0, lastSave: 0 },
    },
    skills: {
      ...baseTables.skills,
      solar_lance: { ...baseTables.skills.solar_lance, gaugeCost: 1, cooldownSec: 0 },
    },
  };
  const base = {
    modeId: "ranked" as const,
    runToken: `server-ranked-run-sequence-${source}`,
    seed: 1234,
    difficulty: "rookie" as const,
    survivalMs: 5_000,
    remainingEnergy: 100,
  };
  const spawn = generateRankedReplaySpawns(base, tables)[0]!;
  const hitAtMs = spawn.spawnAtMs + 1;
  const skillFirst = source === "solar_lance";
  const hit = Object.assign({
    spawnOrdinal: spawn.spawnOrdinal!,
    hitAtMs,
    band: "outer" as const,
    accuracy: "normal" as const,
    damage: source === "solar_lance" ? tables.skills.solar_lance.hitDamage! : 1,
    source,
    skillId: source === "solar_lance" ? "solar_lance" as const : undefined,
    segment: hitSegment(spawn, hitAtMs),
  }, { eventSequence: skillFirst ? 2 : 1 });
  const skill = Object.assign(
    { skillId: "solar_lance" as const, atMs: hitAtMs },
    { eventSequence: skillFirst ? 1 : 2 },
  );
  const trace = {
    hitEvents: [hit],
    killEvents: [{ ...hit }],
    comboBreakEvents: [],
    skillEvents: [skill],
  } as RankedReplayTrace;
  const summary = createRunSummary({
    ...base,
    score: enemies.shard_meteor!.score,
    kills: 1,
    maxCombo: 1,
    lastSaveCount: 0,
    skillUse: { solar_lance: 1 },
  });
  return { summary, trace, tables, spawn };
}

function scoreForKills(events: Array<{ spawnOrdinal: number; band: "outer"; accuracy: "normal"; damageMultiplier?: number }>, typeByOrdinal: Map<number, string>): number {
  const scoring = new ScoringSystem(scoringConfig);
  const scoreByOrdinal = new Map<number, number>();
  for (const event of events) {
    const type = typeByOrdinal.get(event.spawnOrdinal)!;
    scoreByOrdinal.set(event.spawnOrdinal, enemies[type]!.score);
  }
  scoring.onHit(
    events.map((event) => ({
      enemyId: event.spawnOrdinal,
      band: event.band,
      accuracy: event.accuracy,
      damageMultiplier: event.damageMultiplier,
    })),
    (id) => scoreByOrdinal.get(id) ?? 0,
    (id) => typeByOrdinal.get(id) ?? "",
    1_000,
  );
  return scoring.snapshot().score;
}

describe("RankedReplayValidator", () => {
  it("applies combat gauge multiplier when estimating ranked skill-use bounds", () => {
    const baseTables = tablesWithSingleEnemy("rookie", "basic_meteor");
    const slowGaugeTables = {
      ...baseTables,
      scoring: {
        ...scoringConfig,
        combatGaugeGainMultiplier: 1,
        gaugeGain: {
          ...scoringConfig.gaugeGain,
          basic_meteor: 10,
          comboKill: 0,
          lastSave: 0,
        },
      },
      skills: {
        ...baseTables.skills,
        solar_lance: { ...baseTables.skills.solar_lance, gaugeCost: 100, cooldownSec: 0.1 },
      },
    };
    const fastGaugeTables = {
      ...slowGaugeTables,
      scoring: { ...slowGaugeTables.scoring, combatGaugeGainMultiplier: 2 },
    };

    const summary = { difficulty: "rookie" as const, seed: 1234, survivalMs: 5_000 };
    const slow = computeRankedReplayBounds(summary, slowGaugeTables);
    const fast = computeRankedReplayBounds(summary, fastGaugeTables);

    expect(fast.maxSkillUse.solar_lance).toBeGreaterThan(slow.maxSkillUse.solar_lance);
  });

  it("rejects a ranked skill recorded before the replay has earned its gauge", () => {
    const { summary, trace } = oneKillFixture();
    const strictTables = {
      ...DEFAULT_RANKED_REPLAY_TABLES,
      skills: {
        ...DEFAULT_RANKED_REPLAY_TABLES.skills,
        solar_lance: { ...DEFAULT_RANKED_REPLAY_TABLES.skills.solar_lance, gaugeCost: 1, cooldownSec: 10 },
      },
    };
    trace.skillEvents.push({ skillId: "solar_lance", atMs: 0 });

    expect(validateRankedReplaySubmission({ ...summary, skillUse: { ...summary.skillUse, solar_lance: 1 } }, trace, strictTables)).toMatchObject({
      ok: false,
      reason: "replay_skill_timeline_invalid",
    });
  });

  it("accepts a normal kill before a skill at the same millisecond when global sequence proves the order", () => {
    const { summary, trace, tables } = sameMillisecondSequenceFixture("slash");

    expect(validateRankedReplaySubmission(summary, trace, tables)).toMatchObject({ ok: true });
  });

  it("does not let a skill fund itself from its own later same-millisecond kill", () => {
    const { summary, trace, tables } = sameMillisecondSequenceFixture("solar_lance");

    expect(validateRankedReplaySubmission(summary, trace, tables)).toMatchObject({
      ok: false,
      reason: "replay_skill_timeline_invalid",
    });
  });

  it("rejects a replay that only partially supplies semantic event sequences", () => {
    const { summary, trace, tables } = sameMillisecondSequenceFixture("slash");
    delete (trace.skillEvents[0] as { eventSequence?: number }).eventSequence;

    expect(validateRankedReplaySubmission(summary, trace, tables)).toMatchObject({
      ok: false,
      reason: "replay_trace_summary_mismatch",
    });
  });

  it("rejects duplicate or non-positive semantic event sequences", () => {
    for (const invalidSequence of [0, 1]) {
      const { summary, trace, tables } = sameMillisecondSequenceFixture("slash");
      (trace.skillEvents[0] as { eventSequence?: number }).eventSequence = invalidSequence;

      expect(validateRankedReplaySubmission(summary, trace, tables)).toMatchObject({
        ok: false,
        reason: "replay_trace_summary_mismatch",
      });
    }
  });

  it("requires a kill to reuse its corresponding final hit sequence", () => {
    const { summary, trace, tables } = sameMillisecondSequenceFixture("slash");
    (trace.killEvents[0] as { eventSequence?: number }).eventSequence = 3;

    expect(validateRankedReplaySubmission(summary, trace, tables)).toMatchObject({
      ok: false,
      reason: "replay_trace_summary_mismatch",
    });
  });

  it("keeps conservative skill-before-kill ordering for legacy same-millisecond traces", () => {
    const { summary, trace, tables } = sameMillisecondSequenceFixture("slash");
    delete (trace.hitEvents[0] as { eventSequence?: number }).eventSequence;
    delete (trace.killEvents[0] as { eventSequence?: number }).eventSequence;
    delete (trace.skillEvents[0] as { eventSequence?: number }).eventSequence;

    expect(validateRankedReplaySubmission(summary, trace, tables)).toMatchObject({
      ok: false,
      reason: "replay_skill_timeline_invalid",
    });
  });

  it("rejects sequenced semantic timestamps that move backward and a future skill source for an earlier hit", () => {
    const { summary, trace, tables, spawn } = sameMillisecondSequenceFixture("solar_lance");
    trace.skillEvents[0]!.atMs = trace.hitEvents[0]!.hitAtMs + 50;

    expect(validateRankedReplaySubmission(summary, trace, tables)).toMatchObject({
      ok: false,
      reason: "replay_trace_summary_mismatch",
    });
    expect(validateRankedKillGeometry(
      trace.hitEvents[0]!,
      spawn,
      summary.difficulty,
      tables,
      trace.skillEvents,
      enemies.shard_meteor!.hp,
      true,
    )).toEqual({ ok: false, reason: "replay_trace_invalid_geometry" });
  });

  it("rejects a ranked skill replayed before its own cooldown expires", () => {
    const { first, second, summary, trace } = twoKillFixture();
    const strictTables = {
      ...DEFAULT_RANKED_REPLAY_TABLES,
      scoring: {
        ...scoringConfig,
        combatGaugeGainMultiplier: 1,
        gaugeGain: {
          ...scoringConfig.gaugeGain,
          [first.enemyType]: 1,
          [second.enemyType]: 1,
        },
      },
      skills: {
        ...DEFAULT_RANKED_REPLAY_TABLES.skills,
        solar_lance: { ...DEFAULT_RANKED_REPLAY_TABLES.skills.solar_lance, gaugeCost: 1, cooldownSec: 1 },
      },
    };
    const afterFirstKill = trace.killEvents[0]!.hitAtMs + 1;
    const afterSecondKill = trace.killEvents[1]!.hitAtMs + 1;
    expect(afterSecondKill - afterFirstKill).toBeLessThan(1_000);
    trace.skillEvents.push({ skillId: "solar_lance", atMs: afterFirstKill });
    trace.skillEvents.push({ skillId: "solar_lance", atMs: afterSecondKill });

    expect(validateRankedReplaySubmission({ ...summary, skillUse: { ...summary.skillUse, solar_lance: 2 } }, trace, strictTables)).toMatchObject({
      ok: false,
      reason: "replay_skill_timeline_invalid",
    });
    const noCooldownTables = {
      ...strictTables,
      skills: {
        ...strictTables.skills,
        solar_lance: { ...strictTables.skills.solar_lance, cooldownSec: 0 },
      },
    };
    expect(validateRankedReplaySubmission(
      { ...summary, skillUse: { ...summary.skillUse, solar_lance: 2 } },
      trace,
      noCooldownTables,
    )).toMatchObject({ ok: true });
  });

  it("accepts different ranked skills funded by the same kill reward", () => {
    const { first, summary, trace } = oneKillFixture();
    const sharedReward = 80;
    const independentChargeTables = {
      ...DEFAULT_RANKED_REPLAY_TABLES,
      scoring: {
        ...scoringConfig,
        combatGaugeGainMultiplier: 1,
        gaugeGain: { ...scoringConfig.gaugeGain, [first.enemyType]: sharedReward },
      },
      skills: {
        ...DEFAULT_RANKED_REPLAY_TABLES.skills,
        solar_lance: { ...DEFAULT_RANKED_REPLAY_TABLES.skills.solar_lance, gaugeCost: sharedReward, cooldownSec: 10 },
        nova_pulse: { ...DEFAULT_RANKED_REPLAY_TABLES.skills.nova_pulse, gaugeCost: sharedReward, cooldownSec: 10 },
      },
    };
    const afterFirstKill = trace.killEvents[0]!.hitAtMs + 1;
    trace.skillEvents.push({ skillId: "solar_lance", atMs: afterFirstKill });
    trace.skillEvents.push({ skillId: "nova_pulse", atMs: afterFirstKill + 1 });

    expect(validateRankedReplaySubmission({
      ...summary,
      skillUse: { ...summary.skillUse, solar_lance: 1, nova_pulse: 1 },
    }, trace, independentChargeTables)).toMatchObject({ ok: true });
  });

  it("accepts a ranked semantic trace that replays to the submitted summary", () => {
    const { summary, trace } = oneKillFixture();

    expect(validateRankedReplaySubmission(summary, trace)).toMatchObject({ ok: true });
  });

  it("rejects an expected ranked rules contract that differs before replay validation", () => {
    const { summary, trace } = oneKillFixture();
    const validateWithExpectedRules = validateRankedReplaySubmission as unknown as (
      summary: Parameters<typeof validateRankedReplaySubmission>[0],
      trace: RankedReplayTrace,
      tables: undefined,
      maxSurvivalMs: undefined,
      expectedRules: { rulesHash?: string; rulesVersion?: number },
    ) => ReturnType<typeof validateRankedReplaySubmission>;

    expect(validateWithExpectedRules(summary, trace, undefined, undefined, {
      rulesHash: "stale-ranked-rules",
      rulesVersion: RANKED_CORE_SCHEMA_VERSION,
    })).toMatchObject({ ok: false, reason: "ranked_rules_mismatch" });
    expect(validateWithExpectedRules(summary, trace, undefined, undefined, {
      rulesHash: RANKED_CORE_RULES_HASH,
      rulesVersion: RANKED_CORE_SCHEMA_VERSION,
    })).toMatchObject({ ok: true });
  });

  it("rejects public ranked validation when replay trace is missing", () => {
    const { summary } = oneKillFixture();

    expect(validateRankedReplaySubmission(summary)).toMatchObject({
      ok: false,
      reason: "replay_trace_missing",
    });
  });

  it("rejects a kill before that spawn exists", () => {
    const { first, summary, trace } = oneKillFixture();
    trace.killEvents[0] = { ...trace.killEvents[0]!, hitAtMs: first.spawnAtMs - 1 };
    trace.hitEvents[0] = { ...trace.hitEvents[0]!, hitAtMs: first.spawnAtMs - 1 };

    expect(validateRankedReplaySubmission(summary, trace)).toMatchObject({
      ok: false,
      reason: "replay_trace_kill_before_spawn",
    });
  });

  it("rejects a duplicate kill for the same spawn ordinal", () => {
    const { summary, trace } = oneKillFixture();
    trace.killEvents.push({ ...trace.killEvents[0]!, hitAtMs: trace.killEvents[0]!.hitAtMs + 1 });
    trace.hitEvents.push({ ...trace.hitEvents[0]!, hitAtMs: trace.hitEvents[0]!.hitAtMs + 1 });

    expect(validateRankedReplaySubmission({ ...summary, kills: 2, maxCombo: 2, score: summary.score * 2 }, trace)).toMatchObject({
      ok: false,
      reason: "replay_trace_duplicate_kill",
    });
  });

  it("rejects trace-derived summary mismatch", () => {
    const { summary, trace } = oneKillFixture();

    expect(validateRankedReplaySubmission({ ...summary, score: summary.score + 1 }, trace)).toMatchObject({
      ok: false,
      reason: "replay_trace_summary_mismatch",
    });
  });

  it("rejects invalid combo-break timing", () => {
    const { summary, trace } = oneKillFixture();
    trace.comboBreakEvents.push({ atMs: summary.survivalMs + 1, reason: "miss" });

    expect(validateRankedReplaySubmission(summary, trace)).toMatchObject({
      ok: false,
      reason: "replay_trace_invalid_time",
    });
  });

  it("rejects unknown skill ids in the semantic trace", () => {
    const { summary, trace } = oneKillFixture();
    trace.skillEvents.push({ skillId: "debug_beam" as never, atMs: 100 });

    expect(validateRankedReplaySubmission(summary, trace)).toMatchObject({
      ok: false,
      reason: "replay_trace_summary_mismatch",
    });
  });

  it("rejects killing a later periodic boss before the prior boss is defeated", () => {
    const base = {
      modeId: "ranked" as const,
      runToken: "server-ranked-run-boss",
      seed: 1234,
      difficulty: "rookie",
      survivalMs: 160_000,
      remainingEnergy: 100,
    };
    const bossSpawns = generateRankedReplaySpawns(base).filter((spawn) => enemies[spawn.enemyType]?.boss);
    const secondBoss = bossSpawns[1]!;
    const summary = createRunSummary({
      ...base,
      score: enemies[secondBoss.enemyType]!.score,
      kills: 1,
      maxCombo: 1,
      lastSaveCount: 0,
    });
    const trace: RankedReplayTrace = {
      hitEvents: [
        {
          spawnOrdinal: secondBoss.spawnOrdinal!,
          hitAtMs: secondBoss.spawnAtMs + 1,
          band: "outer",
          accuracy: "normal",
          damage: 1,
          source: "slash",
          segment: hitSegment(secondBoss),
        },
      ],
      killEvents: [
        {
          spawnOrdinal: secondBoss.spawnOrdinal!,
          hitAtMs: secondBoss.spawnAtMs + 1,
          band: "outer",
          accuracy: "normal",
          damage: 1,
          source: "slash",
          segment: hitSegment(secondBoss),
        },
      ],
      comboBreakEvents: [],
      skillEvents: [],
    };

    expect(validateRankedReplaySubmission(summary, trace)).toMatchObject({
      ok: false,
      reason: "replay_trace_kill_before_spawn",
    });
  });

  it("rejects a directional hit claim whose segment misses the enemy geometry", () => {
    const base = {
      modeId: "ranked" as const,
      runToken: "server-ranked-run-directional",
      seed: 1234,
      difficulty: "rookie",
      survivalMs: 70_000,
      remainingEnergy: 100,
    };
    const directional = generateRankedReplaySpawns(base).find((spawn) => spawn.enemyType === "directional_comet")!;
    const summary = createRunSummary({
      ...base,
      score: enemies[directional.enemyType]!.score,
      kills: 1,
      maxCombo: 1,
      lastSaveCount: 0,
    });
    const trace: RankedReplayTrace = {
      hitEvents: [
        {
          spawnOrdinal: directional.spawnOrdinal!,
          hitAtMs: directional.spawnAtMs + 1,
          band: "outer",
          accuracy: "directional",
          damage: 1,
          source: "slash",
          segment: missSegment(),
        },
      ],
      killEvents: [
        {
          spawnOrdinal: directional.spawnOrdinal!,
          hitAtMs: directional.spawnAtMs + 1,
          band: "outer",
          accuracy: "directional",
          damage: 1,
          source: "slash",
          segment: missSegment(),
        },
      ],
      comboBreakEvents: [],
      skillEvents: [],
    };

    expect(validateRankedReplaySubmission(summary, trace)).toMatchObject({
      ok: false,
      reason: "replay_trace_invalid_geometry",
    });
  });

  it("rejects a bossWeak claim without a segment that proves the weak-point hit", () => {
    const base = {
      modeId: "ranked" as const,
      runToken: "server-ranked-run-boss-weak",
      seed: 1234,
      difficulty: "rookie",
      survivalMs: 80_000,
      remainingEnergy: 100,
    };
    const boss = generateRankedReplaySpawns(base).find((spawn) => enemies[spawn.enemyType]?.boss)!;
    const summary = createRunSummary({
      ...base,
      score: enemies[boss.enemyType]!.score * 2,
      kills: 1,
      maxCombo: 1,
      lastSaveCount: 0,
    });
    const trace: RankedReplayTrace = {
      hitEvents: [
        {
          spawnOrdinal: boss.spawnOrdinal!,
          hitAtMs: boss.spawnAtMs + 1,
          band: "outer",
          accuracy: "bossWeak",
          damage: 2,
          damageMultiplier: 2,
          source: "slash",
        },
      ],
      killEvents: [
        {
          spawnOrdinal: boss.spawnOrdinal!,
          hitAtMs: boss.spawnAtMs + 1,
          band: "outer",
          accuracy: "bossWeak",
          damage: 2,
          damageMultiplier: 2,
          source: "slash",
        },
      ],
      comboBreakEvents: [],
      skillEvents: [],
    };

    expect(validateRankedReplaySubmission(summary, trace)).toMatchObject({
      ok: false,
      reason: "replay_trace_invalid_geometry",
    });
  });

  it("matches Edge locked-body and current-phase weak-point replay geometry", () => {
    const spawn = {
      spawnOrdinal: 1,
      enemyType: "ringed_destroyer",
      spawnAtMs: 0,
      startAngleRad: 0,
      startRadius: 900,
      angularSpeed: 0,
      approachSpeed: 0,
    } as SpawnSpec;
    const bodySegment = { a: { x: 1410, y: 900, t: 0 }, b: { x: 1470, y: 900, t: 1 } };

    expect(validateRankedKillGeometry({
      spawnOrdinal: 1,
      hitAtMs: 1,
      band: "outer",
      accuracy: "normal",
      damage: 1,
      source: "slash",
      segment: bodySegment,
    }, spawn, "rookie", DEFAULT_RANKED_REPLAY_TABLES, [], 58, true)).toEqual({
      ok: false,
      reason: "replay_trace_invalid_geometry",
    });

    expect(validateRankedKillGeometry({
      spawnOrdinal: 1,
      hitAtMs: 1,
      band: "outer",
      accuracy: "bossWeak",
      damage: 2,
      damageMultiplier: 1.45,
      source: "slash",
      segment: { a: { x: 1530, y: 1021, t: 0 }, b: { x: 1590, y: 1021, t: 1 } },
    }, spawn, "rookie", DEFAULT_RANKED_REPLAY_TABLES, [], 58, true)).toEqual({
      ok: true,
      damageMultiplier: 1.45,
    });
  });

  it("accepts GameScene's exact zone boundaries for every ranked difficulty", () => {
    const zones = DEFAULT_RANKED_REPLAY_TABLES.difficulty.zones;

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
        const spawn = {
          spawnOrdinal: 1,
          enemyType: "shard_meteor",
          spawnAtMs: 0,
          startAngleRad: 0,
          startRadius: radius,
          angularSpeed: 0,
          approachSpeed: 0,
        } as SpawnSpec;
        const event = {
          spawnOrdinal: 1,
          hitAtMs: 1,
          band,
          accuracy: "normal" as const,
          damage: 1,
          source: "slash" as const,
          segment: {
            a: { x: EARTH_CENTER_X + radius - 40, y: EARTH_CENTER_Y, t: 0 },
            b: { x: EARTH_CENTER_X + radius + 40, y: EARTH_CENTER_Y, t: 1 },
          },
        };

        expect(validateRankedKillGeometry(event, spawn, difficulty, DEFAULT_RANKED_REPLAY_TABLES, [], 1, true)).toEqual({
          ok: true,
          damageMultiplier: 1,
        });
        expect(validateRankedKillGeometry({ ...event, band: band === "outer" ? "mid" : "outer" }, spawn, difficulty, DEFAULT_RANKED_REPLAY_TABLES, [], 1, true)).toEqual({
          ok: false,
          reason: "replay_trace_summary_mismatch",
        });
      }
    }
  });

  it("rejects boss shard spawn events with an enemy type outside the parent boss pattern", () => {
    const base = {
      modeId: "ranked" as const,
      runToken: "server-ranked-run-boss-shard-type",
      seed: 1234,
      difficulty: "rookie",
      survivalMs: 80_000,
      remainingEnergy: 100,
    };
    const baseSpawns = generateRankedReplaySpawns(base);
    const boss = baseSpawns.find((spawn) => enemies[spawn.enemyType]?.boss)!;
    const summary = createRunSummary({
      ...base,
      score: 0,
      kills: 0,
      maxCombo: 0,
      lastSaveCount: 0,
    });
    const trace: RankedReplayTrace = {
      spawnEvents: [
        ...spawnEventsFor(baseSpawns),
        {
          spawnOrdinal: Math.max(...baseSpawns.map((spawn) => spawn.spawnOrdinal ?? 0)) + 1,
          source: "boss_shard",
          parentSpawnOrdinal: boss.spawnOrdinal!,
          enemyType: "fast_comet",
          spawnAtMs: boss.spawnAtMs + 300,
          startAngleRad: boss.startAngleRad,
          startRadius: boss.startRadius + 120,
          angularSpeed: boss.angularSpeed,
          approachSpeed: boss.approachSpeed,
        },
      ],
      hitEvents: [],
      killEvents: [],
      comboBreakEvents: [],
      skillEvents: [],
    };

    expect(validateRankedReplaySubmission(summary, trace)).toMatchObject({
      ok: false,
      reason: "replay_trace_summary_mismatch",
    });
  });

  it("rejects boss shard spawn events before the parent boss actually exists", () => {
    const base = {
      modeId: "ranked" as const,
      runToken: "server-ranked-run-boss-shard-time",
      seed: 1234,
      difficulty: "rookie",
      survivalMs: 80_000,
      remainingEnergy: 100,
    };
    const baseSpawns = generateRankedReplaySpawns(base);
    const boss = baseSpawns.find((spawn) => enemies[spawn.enemyType]?.boss)!;
    const summary = createRunSummary({
      ...base,
      score: 0,
      kills: 0,
      maxCombo: 0,
      lastSaveCount: 0,
    });
    const trace: RankedReplayTrace = {
      spawnEvents: [
        ...spawnEventsFor(baseSpawns),
        {
          spawnOrdinal: Math.max(...baseSpawns.map((spawn) => spawn.spawnOrdinal ?? 0)) + 1,
          source: "boss_shard",
          parentSpawnOrdinal: boss.spawnOrdinal!,
          enemyType: "shard_meteor",
          spawnAtMs: boss.spawnAtMs - 1,
          startAngleRad: boss.startAngleRad,
          startRadius: boss.startRadius + 120,
          angularSpeed: boss.angularSpeed,
          approachSpeed: boss.approachSpeed,
        },
      ],
      hitEvents: [],
      killEvents: [],
      comboBreakEvents: [],
      skillEvents: [],
    };

    expect(validateRankedReplaySubmission(summary, trace)).toMatchObject({
      ok: false,
      reason: "replay_trace_summary_mismatch",
    });
  });

  it("rejects solar-lance hit geometry when no matching Solar Lance skill event exists", () => {
    const { first, summary, trace } = oneKillFixture();
    trace.killEvents[0] = {
      ...trace.killEvents[0]!,
      source: "solar_lance",
      skillId: "solar_lance",
      segment: {
        a: { x: 540 - first.startRadius, y: 900, t: 0 },
        b: { x: 540 + first.startRadius, y: 900, t: 16 },
      },
    };
    trace.hitEvents[0] = {
      ...trace.hitEvents[0]!,
      damage: 5,
      source: "solar_lance",
      skillId: "solar_lance",
      segment: trace.killEvents[0].segment,
    };

    expect(validateRankedReplaySubmission(summary, trace)).toMatchObject({
      ok: false,
      reason: "replay_trace_invalid_geometry",
    });
  });

  it("rejects slash-sourced kills without a replay segment", () => {
    const { summary, trace } = oneKillFixture();
    trace.killEvents[0] = {
      ...trace.killEvents[0]!,
      source: "slash",
      segment: undefined,
    };
    trace.hitEvents[0] = {
      ...trace.hitEvents[0]!,
      source: "slash",
      segment: undefined,
    };

    expect(validateRankedReplaySubmission(summary, trace)).toMatchObject({
      ok: false,
      reason: "replay_trace_invalid_geometry",
    });
  });

  it("rejects slash-sourced kills from a segment shorter than live hit minimum", () => {
    const { summary, trace } = oneKillFixture();
    trace.killEvents[0] = {
      ...trace.killEvents[0]!,
      source: "slash",
      segment: {
        a: { x: 540, y: 900, t: 0 },
        b: { x: 541, y: 900, t: 16 },
      },
    };
    trace.hitEvents[0] = {
      ...trace.hitEvents[0]!,
      source: "slash",
      segment: trace.killEvents[0].segment,
    };

    expect(validateRankedReplaySubmission(summary, trace)).toMatchObject({
      ok: false,
      reason: "replay_trace_invalid_geometry",
    });
  });

  it("accepts trace-recorded split spawns with runtime ordinals", () => {
    const base = {
      modeId: "ranked" as const,
      runToken: "server-ranked-run-split",
      seed: 1234,
      difficulty: "defender",
      survivalMs: 30_000,
      remainingEnergy: 100,
    };
    const tables = tablesWithSingleEnemy("defender", "ice_comet");
    const baseSpawns = generateRankedReplaySpawns(base, tables);
    const parent = baseSpawns.find((spawn) => spawn.enemyType === "ice_comet")!;
    expect(parent).toBeTruthy();

    const parentHits = Array.from({ length: enemies.ice_comet!.hp }, (_, index) => {
      const hitAtMs = parent.spawnAtMs + index + 21;
      return {
        spawnOrdinal: parent.spawnOrdinal!,
        hitAtMs,
        band: "outer" as const,
        accuracy: "normal" as const,
        damage: 1,
        source: "slash" as const,
        segment: hitSegment(parent, hitAtMs),
      };
    });
    const parentKill = parentHits[parentHits.length - 1]!;
    const derived = generateRankedReplaySpawnsForTrace(base, {
      hitEvents: [],
      killEvents: [parentKill],
      comboBreakEvents: [],
      skillEvents: [],
    }, tables);
    expect(derived).toMatchObject({ ok: true });
    const splitWithOrdinal = derived.ok ? derived.spawns.find((spawn) => spawn.source === "split" && spawn.parentSpawnOrdinal === parent.spawnOrdinal)! : undefined;
    expect(splitWithOrdinal).toBeTruthy();
    const splitKillAtMs = splitWithOrdinal!.spawnAtMs + 20;
    const splitHit = {
      spawnOrdinal: splitWithOrdinal!.spawnOrdinal!,
      hitAtMs: splitKillAtMs,
      band: "outer" as const,
      accuracy: "normal" as const,
      damage: 1,
      source: "slash" as const,
      segment: hitSegment(splitWithOrdinal!, splitKillAtMs),
    };
    const typeByOrdinal = new Map([
      [parent.spawnOrdinal!, parent.enemyType],
      [splitWithOrdinal!.spawnOrdinal!, splitWithOrdinal!.enemyType],
    ]);
    const summary = createRunSummary({
      ...base,
      score: scoreForKills([parentKill, splitHit], typeByOrdinal),
      kills: 2,
      maxCombo: 2,
      lastSaveCount: 0,
    });
    const trace: RankedReplayTrace = {
      spawnEvents: derived.ok ? derived.spawns.map((spawn) => ({
        spawnOrdinal: spawn.spawnOrdinal!,
        parentSpawnOrdinal: spawn.parentSpawnOrdinal,
        source: spawn.source ?? (enemies[spawn.enemyType]?.boss ? "boss" : "wave"),
        enemyType: spawn.enemyType,
        spawnAtMs: spawn.spawnAtMs,
        startAngleRad: spawn.startAngleRad,
        startRadius: spawn.startRadius,
        angularSpeed: spawn.angularSpeed,
        approachSpeed: spawn.approachSpeed,
      })) : [],
      hitEvents: [...parentHits, splitHit],
      killEvents: [
        {
          spawnOrdinal: parentKill.spawnOrdinal,
          hitAtMs: parentKill.hitAtMs,
          band: parentKill.band,
          accuracy: parentKill.accuracy,
          damage: parentKill.damage,
          source: parentKill.source,
          segment: parentKill.segment,
        },
        {
          spawnOrdinal: splitHit.spawnOrdinal,
          hitAtMs: splitHit.hitAtMs,
          band: splitHit.band,
          accuracy: splitHit.accuracy,
          damage: splitHit.damage,
          source: splitHit.source,
          segment: splitHit.segment,
        },
      ],
      comboBreakEvents: [],
      skillEvents: [],
    };

    expect(validateRankedReplaySubmission(summary, trace, tables)).toMatchObject({ ok: true });
  });

  it("accepts shield-absorbed hits without counting them as hp damage", () => {
    const base = {
      modeId: "ranked" as const,
      runToken: "server-ranked-run-shield",
      seed: 777,
      difficulty: "elite",
      survivalMs: 12_000,
      remainingEnergy: 100,
    };
    const tables = tablesWithSingleEnemy("elite", "shield_rock");
    const baseSpawns = generateRankedReplaySpawns(base, tables);
    const spawn = baseSpawns[0]!;
    const hp = enemies.shield_rock!.hp;
    const hitEvents = [
      {
        spawnOrdinal: spawn.spawnOrdinal!,
        hitAtMs: spawn.spawnAtMs + 20,
        band: "outer" as const,
        accuracy: "normal" as const,
        damage: 0,
        absorbed: "shield" as const,
        source: "slash" as const,
        segment: hitSegment(spawn, spawn.spawnAtMs + 20),
      },
      {
        spawnOrdinal: spawn.spawnOrdinal!,
        hitAtMs: spawn.spawnAtMs + 21,
        band: "outer" as const,
        accuracy: "normal" as const,
        damage: 0,
        absorbed: "shield" as const,
        source: "slash" as const,
        segment: hitSegment(spawn, spawn.spawnAtMs + 21),
      },
      ...Array.from({ length: hp }, (_, index) => {
        const hitAtMs = spawn.spawnAtMs + 30 + index;
        return {
          spawnOrdinal: spawn.spawnOrdinal!,
          hitAtMs,
          band: "outer" as const,
          accuracy: "normal" as const,
          damage: 1,
          source: "slash" as const,
          segment: hitSegment(spawn, hitAtMs),
        };
      }),
    ];
    const killHit = hitEvents[hitEvents.length - 1]!;
    const summary = createRunSummary({
      ...base,
      score: enemies.shield_rock!.score,
      kills: 1,
      maxCombo: 1,
      lastSaveCount: 0,
    });
    const trace: RankedReplayTrace = {
      spawnEvents: spawnEventsFor(baseSpawns),
      hitEvents,
      killEvents: [
        {
          spawnOrdinal: killHit.spawnOrdinal,
          hitAtMs: killHit.hitAtMs,
          band: killHit.band,
          accuracy: killHit.accuracy,
          damage: killHit.damage,
          source: killHit.source,
          segment: killHit.segment,
        },
      ],
      comboBreakEvents: [],
      skillEvents: [],
    };

    expect(validateRankedReplaySubmission(summary, trace, tables)).toMatchObject({ ok: true });
  });
});
