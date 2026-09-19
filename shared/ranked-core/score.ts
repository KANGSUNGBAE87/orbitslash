import type { RankedAccuracyKind, RankedCoreRules, RankedDistanceBand, RankedSkillId, RankedSpawnSpec } from "./types";
import { RANKED_SKILL_IDS } from "./rules";

export interface RankedScoreKill {
  spawnOrdinal: number;
  enemyType: string;
  hitAtMs: number;
  band: RankedDistanceBand;
  accuracy: RankedAccuracyKind;
  damageMultiplier?: number;
}

export interface RankedScoreBreak {
  atMs: number;
  reason: "miss" | "earth_hit";
}

export interface RankedScoreSummary {
  score: number;
  kills: number;
  maxCombo: number;
  lastSaveCount: number;
}

export interface RankedScoreBounds {
  maxScore: number;
  maxSkillUse: Record<RankedSkillId, number>;
}

/**
 * Minimal server-replay inputs for skill authority. Kills have already passed
 * spawn, geometry, damage, and duplicate checks before this replay runs.
 */
export interface RankedSkillTimelineKill {
  eventSequence?: number;
  enemyType: string;
  hitAtMs: number;
  band: RankedDistanceBand;
  accuracy: RankedAccuracyKind;
}

export interface RankedSkillTimelineEvent {
  eventSequence?: number;
  skillId: RankedSkillId;
  atMs: number;
}

export type RankedSkillTimelineValidation =
  | { ok: true; remainingGaugeBySkill: Record<RankedSkillId, number> }
  | { ok: false; reason: "skill_timeline_invalid" };

// Must remain aligned with GameScene's per-skill runtime charge cap. Keeping
// this in the shared ranked core prevents uncapped historical reward totals
// from funding impossible later skill casts during server replay.
const RANKED_SKILL_GAUGE_MAX = 100;

function comboMultiplierFor(combo: number, rules: RankedCoreRules) {
  let multiplier = 1;
  for (const tier of rules.scoring.comboMultiplier) {
    if (combo >= tier.min) multiplier = tier.mult;
  }
  return multiplier;
}

function multiCutTier(count: number) {
  if (count >= 8) return "orbital_master";
  if (count >= 5) return "mega";
  if (count >= 3) return "triple";
  if (count >= 2) return "double";
  return "none";
}

/** Pure equivalent of the score/combo part of ScoringSystem. */
export function replayRankedScore(kills: RankedScoreKill[], breaks: RankedScoreBreak[], rules: RankedCoreRules): RankedScoreSummary {
  const events = [
    ...kills.map((event) => ({ kind: "kill" as const, atMs: event.hitAtMs, event })),
    ...breaks.map((event) => ({ kind: "break" as const, atMs: event.atMs, event })),
  ].sort((a, b) => a.atMs - b.atMs || (a.kind === "break" ? -1 : 1));
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let lastSaveCount = 0;
  let lastComboHitAtMs: number | undefined;

  const addGroup = (group: RankedScoreKill[]) => {
    if (group.length === 0) return;
    const timeout = rules.scoring.comboChainTimeoutMs;
    const lastHit = group[group.length - 1]?.hitAtMs;
    if (timeout != null && lastHit != null && lastComboHitAtMs != null && lastHit - lastComboHitAtMs >= timeout) combo = 0;
    const cap = rules.scoring.comboGainPerSlashCap;
    combo += cap == null ? group.length : Math.min(group.length, cap);
    maxCombo = Math.max(maxCombo, combo);
    const multiCut = rules.scoring.multiCutBonus[multiCutTier(group.length)] ?? 0;
    let gained = multiCut;
    for (const kill of group) {
      const def = rules.enemies[kill.enemyType];
      const distance = rules.scoring.distanceMultiplier[kill.band] ?? rules.scoring.distanceMultiplier.outer ?? 1;
      const accuracy = rules.scoring.accuracyMultiplier[kill.accuracy] ?? rules.scoring.accuracyMultiplier.normal ?? 1;
      gained += (def?.score ?? 0) * distance * accuracy * comboMultiplierFor(combo, rules);
      if (kill.band === "lastSave") lastSaveCount += 1;
    }
    score += gained;
    lastComboHitAtMs = lastHit;
  };

  let pending: RankedScoreKill[] = [];
  const flush = () => {
    if (pending.length === 0) return;
    const timeout = rules.scoring.comboChainTimeoutMs ?? 650;
    let group: RankedScoreKill[] = [];
    let previous: number | undefined;
    for (const kill of pending) {
      if (previous != null && kill.hitAtMs - previous >= timeout) {
        addGroup(group);
        group = [];
      }
      group.push(kill);
      previous = kill.hitAtMs;
    }
    addGroup(group);
    pending = [];
  };

  for (const event of events) {
    if (event.kind === "break") {
      flush();
      combo = 0;
      lastComboHitAtMs = undefined;
    } else {
      pending.push(event.event);
    }
  }
  flush();
  return { score, kills: kills.length, maxCombo, lastSaveCount };
}

/**
 * Replays the part of ScoringSystem that can fund a skill cast. Sequenced
 * same-millisecond events use their runtime semantic order. Legacy
 * events without sequence keep the conservative skill-before-kill behavior.
 */
export function validateRankedSkillTimeline(
  kills: readonly RankedSkillTimelineKill[],
  skillEvents: readonly RankedSkillTimelineEvent[],
  rules: RankedCoreRules,
): RankedSkillTimelineValidation {
  const orderedKills = [...kills].sort((a, b) => (
    a.hitAtMs - b.hitAtMs ||
    compareOptionalSequence(a.eventSequence, b.eventSequence) ||
    a.enemyType.localeCompare(b.enemyType)
  ));
  const orderedSkills = [...skillEvents].sort((a, b) => (
    a.atMs - b.atMs ||
    compareOptionalSequence(a.eventSequence, b.eventSequence) ||
    a.skillId.localeCompare(b.skillId)
  ));
  const lastUseAtMs = new Map<RankedSkillId, number>();
  const remainingGaugeBySkill = Object.fromEntries(
    RANKED_SKILL_IDS.map((skillId) => [skillId, 0]),
  ) as Record<RankedSkillId, number>;
  let nextKill = 0;

  const applyKillRewardsBefore = (event: RankedSkillTimelineEvent) => {
    while (nextKill < orderedKills.length && killPrecedesSkill(orderedKills[nextKill]!, event)) {
      const groupAtMs = orderedKills[nextKill]!.hitAtMs;
      const group: RankedSkillTimelineKill[] = [];
      while (
        nextKill < orderedKills.length &&
        orderedKills[nextKill]!.hitAtMs === groupAtMs &&
        killPrecedesSkill(orderedKills[nextKill]!, event)
      ) {
        group.push(orderedKills[nextKill]!);
        nextKill += 1;
      }
      let gained = 0;
      for (const kill of group) {
        gained += rules.scoring.gaugeGain[kill.enemyType] ?? 0;
        if (kill.accuracy === "directional") gained += rules.scoring.gaugeGain.directionalCut ?? 0;
        if (kill.band === "lastSave") gained += rules.scoring.gaugeGain.lastSave ?? 0;
      }
      if (group.length >= 2) gained += rules.scoring.gaugeGain.comboKill ?? 0;
      const reward = gained * (rules.scoring.combatGaugeGainMultiplier ?? 1);
      for (const skillId of RANKED_SKILL_IDS) {
        remainingGaugeBySkill[skillId] = Math.min(RANKED_SKILL_GAUGE_MAX, remainingGaugeBySkill[skillId] + reward);
      }
    }
  };

  for (const event of orderedSkills) {
    applyKillRewardsBefore(event);
    const definition = rules.skills[event.skillId];
    if (!definition) return { ok: false, reason: "skill_timeline_invalid" };
    const previous = lastUseAtMs.get(event.skillId);
    const cooldownMs = Math.max(0, definition.cooldownSec * 1000);
    if (previous != null && event.atMs - previous < cooldownMs) {
      return { ok: false, reason: "skill_timeline_invalid" };
    }
    if (remainingGaugeBySkill[event.skillId] < definition.gaugeCost) return { ok: false, reason: "skill_timeline_invalid" };
    remainingGaugeBySkill[event.skillId] = 0;
    lastUseAtMs.set(event.skillId, event.atMs);
  }

  return { ok: true, remainingGaugeBySkill };
}

function compareOptionalSequence(a: number | undefined, b: number | undefined): number {
  return a != null && b != null ? a - b : 0;
}

function killPrecedesSkill(kill: RankedSkillTimelineKill, skill: RankedSkillTimelineEvent): boolean {
  if (kill.eventSequence != null || skill.eventSequence != null) {
    return (
      kill.eventSequence != null &&
      skill.eventSequence != null &&
      kill.hitAtMs <= skill.atMs &&
      kill.eventSequence < skill.eventSequence
    );
  }
  return kill.hitAtMs < skill.atMs;
}

export function computeRankedScoreBounds(survivalMs: number, spawns: readonly RankedSpawnSpec[], rules: RankedCoreRules): RankedScoreBounds {
  const maxAccuracy = Math.max(...Object.values(rules.scoring.accuracyMultiplier));
  const lastSaveMultiplier = rules.scoring.distanceMultiplier.lastSave ?? 1;
  const maxMultiCutBonus = Math.max(...Object.values(rules.scoring.multiCutBonus));
  let maxScore = 0;
  for (let index = 0; index < spawns.length; index += 1) {
    const def = rules.enemies[spawns[index]!.enemyType];
    if (!def) continue;
    maxScore += def.score * lastSaveMultiplier * maxAccuracy * comboMultiplierFor(index + 1, rules);
    maxScore += maxMultiCutBonus;
  }
  const combatGaugeGainMultiplier = rules.scoring.combatGaugeGainMultiplier ?? 1;
  const totalGaugeUpper = spawns.reduce((sum, spawn) => {
    const base = rules.scoring.gaugeGain[spawn.enemyType] ?? 0;
    const directional = rules.enemies[spawn.enemyType]?.directional ? rules.scoring.gaugeGain.directionalCut ?? 0 : 0;
    const lastSave = rules.scoring.gaugeGain.lastSave ?? 0;
    const comboKill = rules.scoring.gaugeGain.comboKill ?? 0;
    const bossWeak = rules.enemies[spawn.enemyType]?.boss ? rules.scoring.gaugeGain.bossWeakPoint ?? 0 : 0;
    return sum + (base + directional + lastSave + comboKill + bossWeak) * combatGaugeGainMultiplier;
  }, rules.ranked.skillGaugeSafety);
  const maxSkillUse = {} as Record<RankedSkillId, number>;
  for (const skillId of RANKED_SKILL_IDS) {
    const def = rules.skills[skillId];
    const cooldownMs = Math.max(1, (def?.cooldownSec ?? 1) * 1000);
    const byCooldown = Math.floor(survivalMs / cooldownMs) + rules.ranked.skillCooldownSafetyCount;
    const byGauge = Math.floor(totalGaugeUpper / Math.max(1, def?.gaugeCost ?? 1)) + rules.ranked.skillCooldownSafetyCount;
    maxSkillUse[skillId] = Math.max(0, Math.min(byCooldown, byGauge));
  }
  return {
    maxScore: Math.ceil(maxScore * rules.ranked.scoreSafetyRatio + rules.ranked.scoreSafetyFlat),
    maxSkillUse,
  };
}

export { comboMultiplierFor };
