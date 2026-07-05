import { describe, expect, it } from "vitest";
import { RunSession } from "./RunSession";

describe("RunSession", () => {
  it("collects a submit-ready run summary from scoring and skill counters", () => {
    const session = new RunSession({ difficulty: "rookie", runToken: "local-42", seed: 42 });
    session.recordSkillUse("solar_lance");
    session.recordSkillUse("gravity_slow");

    const summary = session.finish({
      survivalMs: 65000,
      score: 9000,
      kills: 24,
      maxCombo: 8,
      lastSaveCount: 2,
      remainingEnergy: 61,
    });

    expect(summary).toMatchObject({
      runToken: "local-42",
      seed: 42,
      difficulty: "rookie",
      skillUse: { solar_lance: 1, gravity_slow: 1 },
    });
  });

  it("exposes a copy of skill use for mode objective checks", () => {
    const session = new RunSession({ difficulty: "rookie", runToken: "local-42", seed: 42 });
    session.recordSkillUse("solar_lance");

    const snapshot = session.skillUseSnapshot();
    snapshot.solar_lance = 99;

    expect(session.skillUseSnapshot()).toEqual({ solar_lance: 1 });
  });

  it("preserves ranked start metadata through finish", () => {
    const session = new RunSession({
      modeId: "ranked",
      difficulty: "rookie",
      runToken: "server-ranked-run-42",
      seed: 42,
      configVersion: "server-ranked-2026w27",
      rankingEligible: true,
      verification: "server_verified",
      issuedAtMs: 100,
      expiresAtMs: 1000,
    });

    const summary = session.finish({
      survivalMs: 65000,
      score: 9000,
      kills: 24,
      maxCombo: 8,
      lastSaveCount: 2,
      remainingEnergy: 61,
    });

    expect(summary).toMatchObject({
      modeId: "ranked",
      runToken: "server-ranked-run-42",
      configVersion: "server-ranked-2026w27",
      rankingEligible: true,
      verification: "server_verified",
      issuedAtMs: 100,
      expiresAtMs: 1000,
    });
  });

  it("records replay trace snapshots without exposing internal arrays", () => {
    const session = new RunSession({ difficulty: "rookie", runToken: "server-ranked-run-42", seed: 42 });
    session.recordSkillUse("solar_lance", 120);
    session.recordSpawn({
      spawnOrdinal: 1,
      source: "wave",
      enemyType: "small_meteor",
      spawnAtMs: 100,
      startAngleRad: 0.5,
      startRadius: 900,
      angularSpeed: 0.4,
      approachSpeed: 80,
    });
    session.recordHit({ spawnOrdinal: 1, hitAtMs: 200, band: "outer", accuracy: "normal", damage: 1 });
    session.recordKill({ spawnOrdinal: 1, hitAtMs: 200, band: "outer", accuracy: "normal" });
    session.recordComboBreak("miss", 300);

    const snapshot = session.replayTraceSnapshot();
    snapshot.spawnEvents!.push({
      spawnOrdinal: 2,
      source: "wave",
      enemyType: "basic_meteor",
      spawnAtMs: 400,
      startAngleRad: 0.7,
      startRadius: 900,
      angularSpeed: 0.4,
      approachSpeed: 80,
    });
    snapshot.hitEvents.push({ spawnOrdinal: 2, hitAtMs: 400, band: "outer", accuracy: "normal", damage: 1 });
    snapshot.killEvents.push({ spawnOrdinal: 2, hitAtMs: 400, band: "outer", accuracy: "normal" });

    expect(session.replayTraceSnapshot()).toEqual({
      spawnEvents: [
        {
          spawnOrdinal: 1,
          source: "wave",
          enemyType: "small_meteor",
          spawnAtMs: 100,
          startAngleRad: 0.5,
          startRadius: 900,
          angularSpeed: 0.4,
          approachSpeed: 80,
        },
      ],
      hitEvents: [{ spawnOrdinal: 1, hitAtMs: 200, band: "outer", accuracy: "normal", damage: 1 }],
      killEvents: [{ spawnOrdinal: 1, hitAtMs: 200, band: "outer", accuracy: "normal" }],
      comboBreakEvents: [{ reason: "miss", atMs: 300 }],
      skillEvents: [{ skillId: "solar_lance", atMs: 120 }],
    });
  });

  it("deep-copies replay kill segments in snapshots", () => {
    const session = new RunSession({ difficulty: "rookie", runToken: "server-ranked-run-42", seed: 42 });
    session.recordHit({
      spawnOrdinal: 1,
      hitAtMs: 200,
      band: "outer",
      accuracy: "normal",
      damage: 1,
      source: "slash",
      segment: {
        a: { x: 10, y: 20, t: 0 },
        b: { x: 30, y: 40, t: 16 },
      },
    });
    session.recordKill({
      spawnOrdinal: 1,
      hitAtMs: 200,
      band: "outer",
      accuracy: "normal",
      damage: 1,
      source: "slash",
      segment: {
        a: { x: 10, y: 20, t: 0 },
        b: { x: 30, y: 40, t: 16 },
      },
    });

    const snapshot = session.replayTraceSnapshot();
    snapshot.hitEvents[0]!.segment!.a.x = 888;
    snapshot.killEvents[0]!.segment!.a.x = 999;

    expect(session.replayTraceSnapshot().hitEvents[0]!.segment!.a.x).toBe(10);
    expect(session.replayTraceSnapshot().killEvents[0]!.segment!.a.x).toBe(10);
  });
});
