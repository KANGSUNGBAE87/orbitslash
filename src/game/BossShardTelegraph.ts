import { EARTH_GAMEPLAY_RADIUS } from "./coords";
import { BOSS_DEFINITIONS, type BossId } from "./BossDefinitions";
import type { BossShardEvent } from "./BossSystem";

export interface BossShardTelegraph {
  bossType: string;
  shardEnemyType: string;
  patternKind: BossShardEvent["patternKind"];
  phaseLabel: BossShardEvent["phaseLabel"];
  count: number;
  centerAngleRad: number;
  startAngleRad: number;
  endAngleRad: number;
  startRadius: number;
  endRadius: number;
  expiresAtMs: number;
  color: number;
  accentColor: number;
  centerWidth: number;
  edgeWidth: number;
  markerRadius: number;
}

export function buildBossShardTelegraph(
  event: BossShardEvent,
  boss: { angle: number; radius: number },
  elapsedMs: number,
  earthGameplayRadius = EARTH_GAMEPLAY_RADIUS,
): BossShardTelegraph | undefined {
  if (event.kind !== "warning") return undefined;
  const spreadRad = (Math.max(0, event.spreadDeg) * Math.PI) / 180;
  const centerAngleRad = boss.angle;
  const startRadius = Math.max(earthGameplayRadius * 1.6, boss.radius + event.spawnRadiusOffset);
  const theme = isBossId(event.bossType)
    ? BOSS_DEFINITIONS[event.bossType].visualTheme
    : {
      telegraphColor: 0xff6b6b,
      telegraphAccentColor: 0xffffff,
    };
  const patternWeight = event.patternKind === "core_open" ? 1.18 : event.patternKind === "lane_pressure" ? 1.08 : 1;
  return {
    bossType: event.bossType,
    shardEnemyType: event.shardEnemyType,
    patternKind: event.patternKind,
    phaseLabel: event.phaseLabel,
    count: Math.max(1, Math.floor(event.count)),
    centerAngleRad,
    startAngleRad: centerAngleRad - spreadRad / 2,
    endAngleRad: centerAngleRad + spreadRad / 2,
    startRadius,
    endRadius: Math.max(earthGameplayRadius * 1.25, boss.radius * 0.62),
    expiresAtMs: elapsedMs + Math.max(0, event.telegraphLeadMs),
    color: theme.telegraphColor,
    accentColor: theme.telegraphAccentColor,
    centerWidth: Math.round(10 * patternWeight),
    edgeWidth: Math.round(5 * patternWeight),
    markerRadius: Math.max(12, Math.round(8 + event.count * 0.75)),
  };
}

function isBossId(value: string): value is BossId {
  return value in BOSS_DEFINITIONS;
}
