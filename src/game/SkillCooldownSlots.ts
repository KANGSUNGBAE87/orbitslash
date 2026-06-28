export interface SkillSlotDef {
  id: string;
  label: string;
  cost: number;
  active: boolean;
}

export interface SkillSlotState extends SkillSlotDef {
  ratio: number;
  ready: boolean;
  cooldownMs: number;
}

export function buildSkillCooldownSlots(
  defs: SkillSlotDef[],
  gauge: number,
  cooldownRemaining: (skillId: string) => number,
): SkillSlotState[] {
  return defs.map((slot) => {
    const cooldownMs = cooldownRemaining(slot.id);
    const ratio = slot.active ? Math.max(0, Math.min(1, gauge / slot.cost)) : 0;
    return {
      ...slot,
      ratio,
      ready: slot.active && cooldownMs <= 0 && ratio >= 1,
      cooldownMs,
    };
  });
}
