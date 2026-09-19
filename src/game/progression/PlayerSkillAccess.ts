import type { AppRunSource } from "../AppState";
import type { SkillId } from "../ModeConfig";

export function effectiveSkills(
  contentSkills: readonly SkillId[],
  unlockedSkills: readonly SkillId[],
  source: AppRunSource,
): SkillId[] {
  if (source === "devQa" || source === "practice") return [...contentSkills];
  return contentSkills.filter((skill) => unlockedSkills.includes(skill));
}
