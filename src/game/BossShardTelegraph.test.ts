import { describe, expect, it } from "vitest";
import { BOSS_DEFINITIONS } from "./BossDefinitions";
import { buildBossShardTelegraph } from "./BossShardTelegraph";

describe("buildBossShardTelegraph", () => {
  it("projects a warning fan from the active boss angle before shard spawn", () => {
    const telegraph = buildBossShardTelegraph(
      {
        kind: "warning",
        bossType: "ringed_destroyer",
        shardEnemyType: "shard_meteor",
        patternKind: "ring_shards",
        phaseLabel: "approach",
        count: 5,
        spreadDeg: 80,
        spawnRadiusOffset: 190,
        telegraphLeadMs: 1500,
      },
      { angle: Math.PI / 2, radius: 380 },
      6000,
      90,
    );

    expect(telegraph).toMatchObject({
      bossType: "ringed_destroyer",
      shardEnemyType: "shard_meteor",
      patternKind: "ring_shards",
      phaseLabel: "approach",
      expiresAtMs: 7500,
      count: 5,
    });
    expect(telegraph?.centerAngleRad).toBeCloseTo(Math.PI / 2);
    expect(telegraph?.startAngleRad).toBeLessThan(Math.PI / 2);
    expect(telegraph?.endAngleRad).toBeGreaterThan(Math.PI / 2);
    expect(telegraph?.startRadius).toBe(570);
    expect(telegraph?.endRadius).toBeGreaterThan(90);
    expect(telegraph?.endRadius).toBeLessThan(telegraph!.startRadius);
    expect(telegraph).toMatchObject({
      color: BOSS_DEFINITIONS.ringed_destroyer.visualTheme.telegraphColor,
      accentColor: BOSS_DEFINITIONS.ringed_destroyer.visualTheme.telegraphAccentColor,
    });
    expect(telegraph!.centerWidth).toBeGreaterThan(telegraph!.edgeWidth);
    expect(telegraph!.markerRadius).toBeGreaterThanOrEqual(12);
  });

  it("ignores non-warning shard events", () => {
    expect(buildBossShardTelegraph(
      {
        kind: "spawn",
        bossType: "ringed_destroyer",
        shardEnemyType: "shard_meteor",
        patternKind: "ring_shards",
        phaseLabel: "approach",
        count: 5,
        spreadDeg: 80,
        spawnRadiusOffset: 190,
        telegraphLeadMs: 1500,
      },
      { angle: 0, radius: 380 },
      6000,
    )).toBeUndefined();
  });
});
