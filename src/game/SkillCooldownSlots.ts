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
  ready: boolean;
  cooldownMs: number;
  visualState: SkillSlotVisualState;
}

export function buildSkillCooldownSlots(
  defs: SkillSlotDef[],
  gauge: number,
  cooldownRemaining: (skillId: string) => number,
): SkillSlotState[] {
  return defs.map((slot) => {
    const cooldownMs = cooldownRemaining(slot.id);
    const ratio = slot.active ? Math.max(0, Math.min(1, gauge / slot.cost)) : 0;
    const cooldownTotalMs = Math.max(0, slot.cooldownSec * 1000);
    const cooldownRatio = cooldownTotalMs > 0 ? Math.max(0, Math.min(1, cooldownMs / cooldownTotalMs)) : 0;
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
      ready,
      cooldownMs,
      visualState,
    };
  });
}
