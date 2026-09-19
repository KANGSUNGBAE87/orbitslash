import type { ModeId, SkillId } from "../../game/ModeConfig";
import type { ProgressSnapshot } from "../../game/ProgressStore";
import { createFirstSessionState, type FirstSessionStep } from "../../game/onboarding/FirstSessionState";
import { resolveHomePrimaryAction, type HomePrimaryAction } from "../../game/onboarding/HomeFlowPolicy";

export interface HomePrimaryActionPresentation {
  kind: HomePrimaryAction["kind"];
  labelKey: string;
  hintKey: string;
}

export interface HomeViewModel {
  totalRuns: number;
  unlockedModes: ModeId[];
  unlockedSkills: SkillId[];
  primaryAction: HomePrimaryActionPresentation;
}

export function buildHomeViewModel(progress?: ProgressSnapshot): HomeViewModel {
  const primaryAction = presentPrimaryAction(resolveHomePrimaryAction(progress?.onboarding ?? createFirstSessionState()));
  return {
    totalRuns: progress?.profile.totalRuns ?? 0,
    unlockedModes: [...(progress?.unlocks.modes ?? [])],
    unlockedSkills: [...(progress?.unlocks.skills ?? [])],
    primaryAction,
  };
}

function presentPrimaryAction(action: HomePrimaryAction): HomePrimaryActionPresentation {
  if (action.kind === "start_guided_story") {
    return { kind: action.kind, labelKey: "home.primary.start", hintKey: "home.primary.startHint" };
  }
  if (action.kind === "open_recommended_mode") {
    return { kind: action.kind, labelKey: "home.primary.modeSelect", hintKey: "home.primary.modeSelectHint" };
  }
  return { kind: action.kind, labelKey: "home.primary.resume", hintKey: resumeHintKey(action.step) };
}

function resumeHintKey(step: FirstSessionStep): string {
  switch (step) {
    case "not_started":
      return "home.primary.startHint";
    case "basic_slash":
      return "story.guided.basic_slash";
    case "last_save":
      return "story.guided.last_save";
    case "solar_lance":
      return "story.guided.solar_lance";
    case "reward":
      return "story.guided.reward";
    case "complete":
      return "home.primary.modeSelectHint";
    default:
      return assertNever(step);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported first-session step: ${String(value)}`);
}
