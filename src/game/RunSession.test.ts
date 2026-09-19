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
    const hitSequence = session.recordHit({ spawnOrdinal: 1, hitAtMs: 200, band: "outer", accuracy: "normal", damage: 1 });
    session.recordKill({ spawnOrdinal: 1, hitAtMs: 200, band: "outer", accuracy: "normal" });
    const skillSequence = session.recordSkillUse("solar_lance", 200);
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
      hitEvents: [{ spawnOrdinal: 1, hitAtMs: 200, band: "outer", accuracy: "normal", damage: 1, eventSequence: 1 }],
      killEvents: [{ spawnOrdinal: 1, hitAtMs: 200, band: "outer", accuracy: "normal", eventSequence: 1 }],
      comboBreakEvents: [{ reason: "miss", atMs: 300 }],
      skillEvents: [{ skillId: "solar_lance", atMs: 200, eventSequence: 2 }],
    });
    expect(hitSequence).toBe(1);
    expect(skillSequence).toBe(2);
  });

  it("assigns one positive global sequence to each semantic skill or hit and lets the kill reuse its final hit sequence", () => {
    const session = new RunSession({ difficulty: "rookie", runToken: "server-ranked-run-sequence", seed: 42 });

    const firstHitSequence = session.recordHit({ spawnOrdinal: 1, hitAtMs: 100, band: "outer", accuracy: "normal", damage: 1 });
    const skillSequence = session.recordSkillUse("solar_lance", 100);
    const finalHitSequence = session.recordHit({ spawnOrdinal: 2, hitAtMs: 100, band: "outer", accuracy: "normal", damage: 1 });
    session.recordKill({ spawnOrdinal: 2, hitAtMs: 100, band: "outer", accuracy: "normal" });

    expect([firstHitSequence, skillSequence, finalHitSequence]).toEqual([1, 2, 3]);
    expect(session.replayTraceSnapshot()).toMatchObject({
      hitEvents: [{ eventSequence: 1 }, { eventSequence: 3 }],
      skillEvents: [{ eventSequence: 2 }],
      killEvents: [{ eventSequence: 3 }],
    });
  });

  it("rejects a direct replay kill that has no preceding hit instead of creating a partial sequence trace", () => {
    const session = new RunSession({ difficulty: "rookie", runToken: "server-ranked-run-direct-kill", seed: 42 });

    expect(() => session.recordKill({
      spawnOrdinal: 1,
      hitAtMs: 100,
      band: "outer",
      accuracy: "normal",
    })).toThrow(/recorded hit/i);
    expect(session.replayTraceSnapshot().killEvents).toEqual([]);
  });

  it("ignores a caller-supplied kill sequence and binds the kill to the latest hit for that spawn", () => {
    const session = new RunSession({ difficulty: "rookie", runToken: "server-ranked-run-forged-kill-sequence", seed: 42 });
    session.recordHit({ spawnOrdinal: 1, hitAtMs: 100, band: "outer", accuracy: "normal", damage: 1 });

    session.recordKill(Object.assign(
      { spawnOrdinal: 1, hitAtMs: 100, band: "outer" as const, accuracy: "normal" as const },
      { eventSequence: 999 },
    ));

    expect(session.replayTraceSnapshot().killEvents[0]!.eventSequence).toBe(1);
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
    expect(session.replayTraceSnapshot().killEvents[0]!.eventSequence).toBe(
      session.replayTraceSnapshot().hitEvents[0]!.eventSequence,
    );
  });
});
