import { describe, expect, it } from "vitest";
import { createRunSummary } from "./RankingSystem";
import {
  DEFAULT_RANKED_REPLAY_TABLES,
  generateRankedReplaySpawns,
  validateRankedReplaySubmission,
} from "./RankedReplayValidator";
import type { RankedReplayTrace } from "./RankedReplayTrace";
import { createEnemyState, splitSpawnSpecsForEnemy, stepEnemy } from "./Enemy";
import { ScoringSystem } from "./ScoringSystem";
import enemiesJson from "../data/enemies.json";
import scoringJson from "../data/scoring.json";
import type { EnemyTable, ScoringConfig, SpawnSpec, WaveTable } from "./types";

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

function enemyAt(spawn: SpawnSpec, hitAtMs: number) {
  const enemy = createEnemyState(spawn, enemies[spawn.enemyType]!);
  stepEnemy(enemy, hitAtMs - spawn.spawnAtMs);
  return enemy;
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
  it("accepts a ranked semantic trace that replays to the submitted summary", () => {
    const { summary, trace } = oneKillFixture();

    expect(validateRankedReplaySubmission(summary, trace)).toMatchObject({ ok: true });
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

    const parentKillAtMs = parent.spawnAtMs + enemies.ice_comet!.hp + 20;
    const split = splitSpawnSpecsForEnemy(enemyAt(parent, parentKillAtMs), parentKillAtMs)[0]!;
    const splitWithOrdinal: SpawnSpec = { ...split, spawnOrdinal: Math.max(...baseSpawns.map((spawn) => spawn.spawnOrdinal ?? 0)) + 1 };
    const splitKillAtMs = splitWithOrdinal.spawnAtMs + 20;
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
    const splitHit = {
      spawnOrdinal: splitWithOrdinal.spawnOrdinal!,
      hitAtMs: splitKillAtMs,
      band: "outer" as const,
      accuracy: "normal" as const,
      damage: 1,
      source: "slash" as const,
      segment: hitSegment(splitWithOrdinal, splitKillAtMs),
    };
    const typeByOrdinal = new Map([
      [parent.spawnOrdinal!, parent.enemyType],
      [splitWithOrdinal.spawnOrdinal!, splitWithOrdinal.enemyType],
    ]);
    const summary = createRunSummary({
      ...base,
      score: scoreForKills([parentKill, splitHit], typeByOrdinal),
      kills: 2,
      maxCombo: 2,
      lastSaveCount: 0,
    });
    const trace: RankedReplayTrace = {
      spawnEvents: [
        ...spawnEventsFor(baseSpawns),
        {
          spawnOrdinal: splitWithOrdinal.spawnOrdinal!,
          parentSpawnOrdinal: parent.spawnOrdinal!,
          source: "split",
          enemyType: splitWithOrdinal.enemyType,
          spawnAtMs: splitWithOrdinal.spawnAtMs,
          startAngleRad: splitWithOrdinal.startAngleRad,
          startRadius: splitWithOrdinal.startRadius,
          angularSpeed: splitWithOrdinal.angularSpeed,
          approachSpeed: splitWithOrdinal.approachSpeed,
        },
      ],
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
