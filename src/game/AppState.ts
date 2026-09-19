import {
  buildRunConfig,
  type DifficultyId,
  type FreeDefensePresetId,
  type ModeId,
  type ModeResult,
  type RunConfig,
  type SkillId,
  type StoryStageId,
} from "./ModeConfig";
import type { BossId } from "./BossDefinitions";

export type AppScreen = "boot" | "loading" | "home" | "modeSelect" | "modeDetail" | "gameplay" | "result" | "ranking" | "settings" | "collection";
export type AppRunSource = "play" | "devQa" | "practice";

export interface AppState {
  screen: AppScreen;
  activeModeId: ModeId | null;
  selectedModeId: ModeId | null;
  runSource: AppRunSource;
  runConfig: RunConfig;
  lastResult: ModeResult | null;
}

export type AppAction =
  | { type: "APP_LOADING" }
  | { type: "APP_READY" }
  | { type: "OPEN_HOME" }
  | { type: "OPEN_MODE_SELECT" }
  | { type: "OPEN_MODE_DETAIL"; modeId?: ModeId }
  | { type: "OPEN_RANKING" }
  | { type: "OPEN_SETTINGS" }
  | { type: "OPEN_COLLECTION" }
  | {
      type: "START_RUN";
      modeId: ModeId;
      seed?: number;
      difficulty?: DifficultyId;
      freeDefensePreset?: FreeDefensePresetId;
      practiceBossId?: BossId;
      storyStageId?: StoryStageId;
      unlockedSkills?: SkillId[];
      source?: AppRunSource;
    }
  | { type: "RETRY_RUN"; seed?: number }
  | { type: "RUN_ENDED"; result: ModeResult };

export function initialAppState(): AppState {
  return {
    screen: "boot",
    activeModeId: null,
    selectedModeId: null,
    runSource: "play",
    runConfig: buildRunConfig("freeDefense"),
    lastResult: null,
  };
}

export function appStateReducer(state: AppState, action: AppAction): AppState {
  if (action.type === "APP_LOADING") {
    return { ...state, screen: "loading", activeModeId: null, selectedModeId: null };
  }
  if (action.type === "APP_READY") {
    return { ...state, screen: "home", activeModeId: null, selectedModeId: null, runSource: "play" };
  }
  if (action.type === "OPEN_HOME") {
    return { ...state, screen: "home", activeModeId: null, selectedModeId: null, runSource: "play" };
  }
  if (action.type === "OPEN_MODE_SELECT") {
    return { ...state, screen: "modeSelect", activeModeId: null, selectedModeId: null, runSource: "play" };
  }
  if (action.type === "OPEN_MODE_DETAIL") {
    const modeId = action.modeId ?? state.lastResult?.modeId ?? state.selectedModeId ?? state.activeModeId ?? state.runConfig.modeId;
    return { ...state, screen: "modeDetail", activeModeId: null, selectedModeId: modeId, runSource: "play" };
  }
  if (action.type === "OPEN_RANKING") {
    return { ...state, screen: "ranking" };
  }
  if (action.type === "OPEN_SETTINGS") {
    return { ...state, screen: "settings" };
  }
  if (action.type === "OPEN_COLLECTION") {
    return { ...state, screen: "collection" };
  }
  if (action.type === "START_RUN") {
    const runConfig = buildRunConfig(action.modeId, {
      seed: action.seed,
      difficulty: action.difficulty,
      freeDefensePreset: action.freeDefensePreset,
      practiceBossId: action.practiceBossId,
      storyStageId: action.storyStageId,
      unlockedSkills: action.unlockedSkills,
      source: action.source ?? "play",
    });
    return {
      screen: "gameplay",
      activeModeId: action.modeId,
      selectedModeId: action.modeId,
      runSource: action.source ?? "play",
      runConfig,
      lastResult: null,
    };
  }
  if (action.type === "RETRY_RUN") {
    const modeId = state.lastResult?.modeId ?? state.activeModeId ?? state.runConfig.modeId;
    const configVersion = modeId === "ranked" ? "local" : state.runConfig.configVersion;
    const runConfig = buildRunConfig(modeId, {
      difficulty: state.runConfig.difficulty,
      seed: action.seed ?? state.runConfig.seed,
      configVersion,
      freeDefensePreset: state.runConfig.rules.freeDefensePreset,
      practiceBossId: state.runConfig.rules.bossPolicy.bossEnemyType as BossId,
      storyStageId: modeId === "story" ? state.lastResult?.activeStoryStageId : undefined,
      unlockedSkills: state.runConfig.rules.enabledSkills,
      source: state.runSource,
    });
    return {
      screen: "gameplay",
      activeModeId: modeId,
      selectedModeId: modeId,
      runSource: state.runSource,
      runConfig,
      lastResult: null,
    };
  }
  if (action.type === "RUN_ENDED") {
    return {
      ...state,
      screen: "result",
      activeModeId: action.result.modeId,
      selectedModeId: action.result.modeId,
      lastResult: action.result,
    };
  }
  return state;
}
