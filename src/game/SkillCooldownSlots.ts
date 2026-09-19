export interface SkillSlotDef {
  id: string;
  label: string;
  cost: number;
  cooldownSec: number;
  active: boolean;
}

export type SkillSlotVisualState = "locked" | "charging" | "cooldown" | "ready";

export interface SkillSlotState extends SkillSlotDef {
  ratio: number;
  cooldownRatio: number;
  cooldownProgressRatio: number;
  ready: boolean;
  cooldownMs: number;
  visualState: SkillSlotVisualState;
}

export type SkillChargeResolver = (skillId: string) => number;

function normalizeCooldownTotalMs(cooldownSec: number): number {
  if (typeof cooldownSec !== "number" || !Number.isFinite(cooldownSec) || cooldownSec <= 0) return 0;
  const totalMs = cooldownSec * 1000;
  return Number.isFinite(totalMs) ? totalMs : 0;
}

function normalizeCooldownRemainingMs(value: number, totalMs: number): number {
  if (totalMs <= 0) return 0;
  if (value === Number.POSITIVE_INFINITY) return totalMs;
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(totalMs, value));
}

export function buildSkillCooldownSlots(
  defs: SkillSlotDef[],
  chargeFor: SkillChargeResolver,
  cooldownRemaining: (skillId: string) => number,
): SkillSlotState[] {
  return defs.map((slot) => {
    const cooldownTotalMs = normalizeCooldownTotalMs(slot.cooldownSec);
    const cooldownMs = normalizeCooldownRemainingMs(cooldownRemaining(slot.id), cooldownTotalMs);
    const charge = chargeFor(slot.id);
    const ratio = slot.active && Number.isFinite(charge) && Number.isFinite(slot.cost) && slot.cost > 0
      ? Math.max(0, Math.min(1, charge / slot.cost))
      : 0;
    const cooldownRatio = cooldownTotalMs > 0 ? Math.max(0, Math.min(1, cooldownMs / cooldownTotalMs)) : 0;
    const cooldownProgressRatio = slot.active ? Math.max(0, Math.min(1, 1 - cooldownRatio)) : 0;
    const ready = slot.active && cooldownMs <= 0 && ratio >= 1;
    const visualState: SkillSlotVisualState = !slot.active
      ? "locked"
      : ready
        ? "ready"
        : cooldownMs > 0
          ? "cooldown"
          : "charging";
    return {
      ...slot,
      ratio,
      cooldownRatio,
      cooldownProgressRatio,
      ready,
      cooldownMs,
      visualState,
    };
  });
}
