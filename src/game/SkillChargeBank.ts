import type { SkillId } from "./ModeConfig";

export const SKILL_CHARGE_IDS = [
  "solar_lance",
  "orbital_cut",
  "gravity_slow",
  "delta_shield",
  "nova_pulse",
] as const satisfies readonly SkillId[];

const KNOWN_SKILL_IDS = new Set<string>(SKILL_CHARGE_IDS);

function clampCharge(value: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value === Number.POSITIVE_INFINITY) return 100;
  if (value === Number.NEGATIVE_INFINITY) return 0;
  return Math.max(0, Math.min(100, value));
}

export class SkillChargeBank {
  private readonly charges = new Map<SkillId, number>();

  constructor(activeSkillIds: Iterable<SkillId>) {
    for (const skillId of activeSkillIds) {
      if (KNOWN_SKILL_IDS.has(skillId)) this.charges.set(skillId, 0);
    }
  }

  get(skillId: string): number {
    return this.charges.get(skillId as SkillId) ?? 0;
  }

  set(skillId: string, value: number): void {
    if (!this.charges.has(skillId as SkillId)) return;
    this.charges.set(skillId as SkillId, clampCharge(value));
  }

  fillAll(value: number): void {
    const charge = clampCharge(value);
    for (const skillId of this.charges.keys()) this.charges.set(skillId, charge);
  }

  gainAll(amount: number): void {
    if (typeof amount !== "number" || Number.isNaN(amount)) return;
    for (const [skillId, charge] of this.charges) this.charges.set(skillId, clampCharge(charge + amount));
  }

  consume(skillId: string): void {
    if (!this.charges.has(skillId as SkillId)) return;
    this.charges.set(skillId as SkillId, 0);
  }

  snapshot(): Partial<Record<SkillId, number>> {
    return Object.fromEntries(this.charges) as Partial<Record<SkillId, number>>;
  }
}
