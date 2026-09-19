import type { SkillId } from "../game/ModeConfig";

const SKILL_ASSETS: Record<SkillId, string> = {
  solar_lance: "./assets/skills/solar-lance.svg",
  orbital_cut: "./assets/skills/orbital-cut.svg",
  gravity_slow: "./assets/skills/gravity-slow.svg",
  delta_shield: "./assets/skills/delta-shield.svg",
  nova_pulse: "./assets/skills/nova-pulse.svg",
};

export function skillAssetUrl(skillId: SkillId): string {
  return SKILL_ASSETS[skillId];
}

export function allSkillAssetUrls(): string[] {
  return Object.values(SKILL_ASSETS);
}
