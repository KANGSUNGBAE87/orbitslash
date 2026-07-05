import { bossPhaseForEnemy } from "./BossSystem";
import type { BossPhaseDef } from "./BossDefinitions";

export interface BossHudCandidate {
  type?: string;
  boss?: boolean;
  alive?: boolean;
  hp: number;
  maxHp?: number;
}

export interface BossHudState {
  active: boolean;
  warning: boolean;
  nextBossInMs: number;
  hp: number;
  maxHp: number;
  hitsRemaining: number;
  hpRatio: number;
  threatPercent: number;
  bossType?: string;
  phaseLabel?: BossPhaseDef["label"];
  objectiveKey?: string;
}

const DEFAULT_BOSS_WARNING_LEAD_MS = 3000;

export function buildBossHudState(
  enemies: readonly BossHudCandidate[],
  elapsedMs: number,
  bossEveryMs: number,
  warningLeadMs = DEFAULT_BOSS_WARNING_LEAD_MS,
  nextBossInMsOverride?: number,
  threatPercentOverride?: number,
): BossHudState {
  const activeBoss = enemies.find((enemy) => enemy.boss && enemy.alive !== false && enemy.hp > 0);
  const clampedElapsed = Math.max(0, elapsedMs);
  const safeEveryMs = Math.max(1, bossEveryMs);
  const nextBossAtMs = Math.ceil((clampedElapsed + 1) / safeEveryMs) * safeEveryMs;
  const nextBossInMs = nextBossInMsOverride ?? Math.max(0, nextBossAtMs - clampedElapsed);

  if (activeBoss) {
    const maxHp = Math.max(1, activeBoss.maxHp ?? activeBoss.hp);
    const hp = Math.max(0, Math.min(maxHp, activeBoss.hp));
    const phase = activeBoss.type ? bossPhaseForEnemy({ ...activeBoss, type: activeBoss.type }) : null;
    return {
      active: true,
      warning: false,
      nextBossInMs,
      hp,
      maxHp,
      hitsRemaining: Math.ceil(hp),
      hpRatio: hp / maxHp,
      threatPercent: 100,
      bossType: activeBoss.type,
      phaseLabel: phase?.label,
      objectiveKey: phase?.objectiveKey,
    };
  }

  const warning = nextBossInMs > 0 && nextBossInMs <= warningLeadMs;
  return {
    active: false,
    warning,
    nextBossInMs,
    hp: 0,
    maxHp: 0,
    hitsRemaining: 0,
    hpRatio: 0,
    threatPercent: Math.max(0, Math.min(100, threatPercentOverride ?? ((safeEveryMs - nextBossInMs) / safeEveryMs) * 100)),
  };
}
