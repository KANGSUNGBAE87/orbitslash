import { describe, expect, it } from "vitest";
import {
  createRankedServerStubStart,
  createServerVerifiedRankedStart,
  LocalBackendAdapter,
  createRankedWeeklySeed,
  validatePublicRankedStart,
  validatePublicRankedSubmission,
} from "./BackendAdapter";
import { createRunSummary } from "../game/RankingSystem";
import { generateRankedReplaySpawns } from "../game/RankedReplayValidator";
import enemiesJson from "../data/enemies.json";
import type { EnemyTable, SpawnSpec } from "../game/types";

const enemies = enemiesJson as EnemyTable;

function hitSegment(spawn: SpawnSpec, hitAtMs: number) {
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

describe("LocalBackendAdapter", () => {
  it("derives fixed ranked seeds by KST week and difficulty", () => {
    const beforeCutoff = createRankedWeeklySeed("rookie", new Date("2026-07-05T20:59:00.000Z"));
    const sameWeekAfterCutoff = createRankedWeeklySeed("rookie", new Date("2026-07-06T21:01:00.000Z"));
    const nextDifficulty = createRankedWeeklySeed("defender", new Date("2026-07-06T21:01:00.000Z"));
    const nextWeek = createRankedWeeklySeed("rookie", new Date("2026-07-13T21:01:00.000Z"));

    expect(beforeCutoff).toBe(createRankedWeeklySeed("rookie", new Date("2026-07-01T12:00:00.000Z")));
    expect(sameWeekAfterCutoff).not.toBe(beforeCutoff);
    expect(nextDifficulty).not.toBe(sameWeekAfterCutoff);
    expect(nextWeek).not.toBe(sameWeekAfterCutoff);
  });

  it("begins ranked runs without server-only secrets", async () => {
    const backend = new LocalBackendAdapter(1234);

    const run = await backend.beginRankedRun("rookie");

    expect(run).toMatchObject({ runToken: "local-1234", seed: 1234, difficulty: "rookie" });
    expect(JSON.stringify(run)).not.toMatch(/SERVICE_ROLE|SUPABASE_DB_PASSWORD|DEEPSEEK_API_KEY/);
  });

  it("can create a deterministic local run start through the adapter boundary", () => {
    const backend = new LocalBackendAdapter(1234);

    expect(backend.beginLocalRun("rookie", 99)).toMatchObject({
      runToken: "local-99",
      seed: 99,
      difficulty: "rookie",
    });
  });

  it("exposes the selected hybrid ranking strategy", () => {
    const backend = new LocalBackendAdapter(1234);

    expect(backend.rankingStrategy()).toMatchObject({
      primary: "supabase_verified",
      secondary: "apps_in_toss_leaderboard_bridge",
    });
  });

  it("keeps public leaderboard locked for local-only ranking paths", async () => {
    const backend = new LocalBackendAdapter(1234);

    await expect(backend.leaderboardStatus()).resolves.toMatchObject({
      publicAvailable: false,
      reason: "edge_not_deployed",
    });
    await expect(backend.publicLeaderboardRows()).resolves.toEqual({
      status: { publicAvailable: false, reason: "edge_not_deployed" },
      rows: [],
    });
  });

  it("rejects rewarded-ad telemetry until a dedicated server sink exists", async () => {
    const backend = new LocalBackendAdapter(1234);

    await expect(backend.rewardedAdTelemetryStatus()).resolves.toEqual({
      ready: false,
      reason: "local_stub",
      endpointConfigured: false,
      remoteEnabled: false,
      remoteVerified: false,
    });
    await expect(
      backend.recordRewardedAdEvent({
        eventName: "show_requested",
        placement: "free_defense_revive",
        atMs: 100,
      }),
    ).resolves.toEqual({ accepted: false, reason: "telemetry_not_configured" });
  });

  it("rejects gameplay telemetry until a dedicated server sink exists", async () => {
    const backend = new LocalBackendAdapter(1234);

    await expect(backend.gameplayTelemetryStatus()).resolves.toEqual({
      ready: false,
      reason: "local_stub",
      endpointConfigured: false,
      remoteEnabled: false,
      remoteVerified: false,
    });
    await expect(
      backend.recordGameplayEvent({
        eventName: "skill_fire",
        atMs: 100,
        modeId: "freeDefense",
        difficulty: "rookie",
      }),
    ).resolves.toEqual({ accepted: false, reason: "telemetry_not_configured" });
  });

  it("creates a server-stub ranked start that is explicit but not public-submit ready", () => {
    const start = createRankedServerStubStart("rookie", 123, "server-preview-2026w27");

    expect(start).toMatchObject({
      modeId: "ranked",
      difficulty: "rookie",
      seed: 123,
      configVersion: "server-preview-2026w27",
      rankingEligible: false,
    });
    expect(start.runToken).toContain("server-stub");
    expect(validatePublicRankedStart(start)).toEqual({ ok: false, reason: "not_server_verified" });
  });

  it("accepts only server-verified unexpired ranked starts for public submission", () => {
    const now = 1_000_000;
    const start = createServerVerifiedRankedStart({
      difficulty: "rookie",
      seed: 123,
      runToken: "server-ranked-run-123",
      configVersion: "server-ranked-2026w27",
      issuedAtMs: now - 1000,
      expiresAtMs: now + 60_000,
    });

    expect(validatePublicRankedStart(start, now)).toEqual({ ok: true });
    expect(validatePublicRankedStart({ ...start, runToken: "server-stub-123" }, now)).toEqual({
      ok: false,
      reason: "invalid_token",
    });
    expect(validatePublicRankedStart({ ...start, configVersion: "server-preview-2026w27" }, now)).toEqual({
      ok: false,
      reason: "invalid_config_version",
    });
    expect(validatePublicRankedStart({ ...start, expiresAtMs: now }, now)).toEqual({ ok: false, reason: "expired" });
    expect(validatePublicRankedStart({ ...start, identityBound: false }, now)).toEqual({
      ok: false,
      reason: "identity_not_bound",
    });
  });

  it("validates public ranked submissions against the issued server run", () => {
    const now = 1_000_000;
    const start = createServerVerifiedRankedStart({
      difficulty: "rookie",
      seed: 123,
      runToken: "server-ranked-run-123",
      configVersion: "server-ranked-2026w27",
      issuedAtMs: now - 1000,
      expiresAtMs: now + 60_000,
    });
    const replayBase = {
      modeId: "ranked" as const,
      runToken: "server-ranked-run-123",
      seed: 123,
      difficulty: "rookie",
      survivalMs: 60_000,
      remainingEnergy: 44,
    };
    const firstSpawn = generateRankedReplaySpawns(replayBase)[0]!;
    const hp = enemies[firstSpawn.enemyType]!.hp;
    const hitEvents = Array.from({ length: hp }, (_, index) => {
      const hitAtMs = firstSpawn.spawnAtMs + index + 1;
      return {
        spawnOrdinal: firstSpawn.spawnOrdinal!,
        hitAtMs,
        band: "outer" as const,
        accuracy: "normal" as const,
        damage: 1,
        source: "slash" as const,
        segment: hitSegment(firstSpawn, hitAtMs),
      };
    });
    const killHit = hitEvents[hitEvents.length - 1]!;
    const trace = {
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
      ...replayBase,
      modeId: "ranked",
      score: enemies[firstSpawn.enemyType]!.score,
      kills: 1,
      maxCombo: 1,
      lastSaveCount: 0,
    });

    expect(validatePublicRankedSubmission(summary, start, now, trace)).toEqual({ ok: true });
    expect(validatePublicRankedSubmission(summary, start, now)).toEqual({ ok: false, reason: "replay_trace_missing" });
    expect(validatePublicRankedSubmission({ ...summary, seed: 124 }, start, now)).toEqual({
      ok: false,
      reason: "seed_mismatch",
    });
    expect(validatePublicRankedSubmission({ ...summary, score: -1 }, start, now, trace)).toEqual({
      ok: false,
      reason: "score_negative",
    });
  });
});
