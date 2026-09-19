import { Container, Graphics, Rectangle, Sprite, Text, Texture, type TextStyle, type TextStyleOptions } from "pixi.js";
import { BASE_HEIGHT, BASE_WIDTH, computeRootFit, type SafeAreaInsets } from "../game/coords";
import { DEV_QA_SCENARIOS, DEV_QA_SCENARIO_LIST, type DevQaLaunchPreset, type DevQaResults, type DevQaScenarioId } from "../game/DevQa";
import { LAYER } from "../game/layers";
import { BOSS_DEFINITIONS, BOSS_IDS, type BossId } from "../game/BossDefinitions";
import {
  buildRunConfig,
  dailyModifierById,
  freeDefensePresetDefinitions,
  modeDefinitions,
  STORY_CHAPTERS,
  STORY_STAGE_PLAN,
  type DailyModifierId,
  type DifficultyId,
  type FreeDefensePresetId,
  type ModeId,
  type ModeResult,
  type RunLaunchOptions,
  type StoryStageId,
} from "../game/ModeConfig";
import type { AppRunSource } from "../game/AppState";
import {
  buildModeProgressSummary,
  FREE_DEFENSE_DAILY_PLAY_LIMIT,
  freeDefenseDateKey,
  type ModeProgressSummary,
  type ProgressSnapshot,
} from "../game/ProgressStore";
import { resolveReviveAvailability, type AdReviveReadiness } from "../game/RevivePolicy";
import { RemoteConfig } from "../game/RemoteConfig";
import { resolveNovaPulseDefinition } from "../game/SkillSystem";
import { getLocale, setLocale, t, type Locale } from "../i18n";
import type { PublicLeaderboardRow } from "../platform/BackendAdapter";
import { resolveLeaderboardBoundary, type LeaderboardBoundaryState } from "../platform/LeaderboardBoundary";
import { earthAssetUrl } from "./EarthVisual";
import { enemyAssetUrl } from "./EnemyVisual";
import { textureFromAsset } from "./TextureAssets";
import { modeDetailLayout, type ModeDetailLayout } from "./layout/ModeDetailLayout";
import { resultLayout } from "./layout/ResultLayout";
import { drawSkillGestureIcon } from "./SkillGestureIcon";
import { buildHomeViewModel } from "./view-models/HomeViewModel";
import { buildResultViewModel, type ResultDetailRow, type ResultStatCard, type ResultUnlockCard } from "./view-models/ResultViewModel";
import { resultFlowFor, type ResultFlowStep } from "./view-models/ResultFlowState";
import { buildCollectionViewModel } from "./view-models/CollectionViewModel";
import type { ProgressRecordOutcome } from "../game/progression/ProgressReducer";
import { defaultPlayerPreferences, type PlayerPreferences } from "../game/PlayerPreferencesStore";
import type { ModeAvailability } from "../game/progression/UnlockPolicy";

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function textStyle(opts: Partial<TextStyleOptions>): TextStyle {
  return { fontFamily: FONT, fill: 0xffffff, fontSize: 34, align: "center", ...opts } as TextStyle;
}

function isDifficultyId(value: string | undefined): value is DifficultyId {
  return value === "rookie" || value === "defender" || value === "elite" || value === "master";
}

function isFreeDefensePresetId(value: string | undefined): value is FreeDefensePresetId {
  return value === "standard" || value === "skillPractice" || value === "bossPractice";
}

function isBossId(value: string | undefined): value is BossId {
  return Boolean(value && (BOSS_IDS as readonly string[]).includes(value));
}

function isStoryStageId(value: string | undefined): value is StoryStageId {
  if (!value) return false;
  return STORY_STAGE_PLAN.some((stage) => stage.id === value);
}

type ResultAction = "retry" | "modeSelect" | "home" | "collection" | "unlockReveal";
type QaAction = DevQaScenarioId;

export interface AppShellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AppShellLayoutMetrics {
  homeButtons: Record<"start" | "collection", AppShellRect>;
  homeSettingsTrigger: AppShellRect;
  modeCards: Array<{ modeId: ModeId; rect: AppShellRect }>;
  bottomNav: AppShellRect;
}

export interface AppShellModeDetailOptions {
  adReviveReadiness?: AdReviveReadiness;
  availability?: ModeAvailability;
}

export interface AppShellViewportMetrics {
  width: number;
  height: number;
  safeArea?: SafeAreaInsets;
}

export type SettingsAccountErrorReason = "cancelled" | "unavailable" | "failed";

export type SettingsAccountState =
  | { status: "anonymous" }
  | { status: "loading" }
  | { status: "linked"; provider: string }
  | { status: "error"; reason?: SettingsAccountErrorReason };

export type SettingsShareState = "idle" | "sharing" | "success" | "error";

export interface SettingsPresentationState {
  account?: SettingsAccountState;
  share?: SettingsShareState;
}

export const APP_SHELL_SAFE_AREA = {
  top: 96,
  right: 32,
  bottom: 96,
  left: 32,
} as const;

export function appShellLayoutMetrics(
  viewportMetrics: AppShellViewportMetrics = { width: 360, height: 800 },
): AppShellLayoutMetrics {
  const settingsTriggerSize = Math.max(
    96,
    settingsControlLayout(viewportMetrics.width, viewportMetrics.height, viewportMetrics.safeArea).touchHeight,
  );
  return {
    homeButtons: {
      start: { x: 180, y: 920, w: 720, h: 112 },
      collection: { x: 160, y: 1698, w: 330, h: 76 },
    },
    homeSettingsTrigger: {
      x: BASE_WIDTH - APP_SHELL_SAFE_AREA.right - settingsTriggerSize,
      y: APP_SHELL_SAFE_AREA.top,
      w: settingsTriggerSize,
      h: settingsTriggerSize,
    },
    modeCards: modeDefinitions().map((mode, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      return {
        modeId: mode.id,
        rect: { x: 58 + col * 342, y: 1088 + row * 250, w: 306, h: 216 },
      };
    }),
    bottomNav: { x: 64, y: BASE_HEIGHT - 180, w: 230, h: 78 },
  };
}

export interface SettingsControlLayout {
  touchHeight: number;
  minimumCssTouchHeight: number;
  rootFitScale: number;
}

export function settingsControlLayout(
  viewportWidth: number,
  viewportHeight = BASE_HEIGHT,
  safeArea?: SafeAreaInsets,
): SettingsControlLayout {
  const rootFitScale = computeRootFit(viewportWidth, viewportHeight, safeArea).scale;
  const touchHeight = Math.ceil(48 / rootFitScale);
  return { touchHeight, minimumCssTouchHeight: touchHeight * rootFitScale, rootFitScale };
}

export interface PauseOverlayLayout {
  touchHeight: number;
  minimumCssTouchHeight: number;
  rootFitScale: number;
}

const PAUSE_OVERLAY_SAFE_VIEWPORT = { width: 272, height: 520 } as const;

export function pauseOverlayLayout(viewportWidth: number, viewportHeight: number, safeArea?: SafeAreaInsets): PauseOverlayLayout {
  const rootFitScale = computeRootFit(viewportWidth, viewportHeight, safeArea).scale;
  const scale = rootFitScale;
  const touchHeight = Math.ceil(48 / scale);
  return { touchHeight, minimumCssTouchHeight: touchHeight * scale, rootFitScale };
}

export function safePauseOverlayLayout(): PauseOverlayLayout {
  return pauseOverlayLayout(PAUSE_OVERLAY_SAFE_VIEWPORT.width, PAUSE_OVERLAY_SAFE_VIEWPORT.height);
}

const QA_SCENARIO_COLOR: Record<DevQaScenarioId, number> = {
  touchHud: 0x3fd8ff,
  boss: 0xff7a45,
  special: 0x4ade80,
  blitz: 0xa78bfa,
};

export class AppShell {
  readonly container: Container;

  onStartRun: ((modeId: ModeId, options?: RunLaunchOptions) => void) | null = null;
  onStartQaRun: ((modeId: ModeId, preset: DevQaLaunchPreset) => void) | null = null;
  onToggleQaResult: ((scenarioId: DevQaScenarioId) => void) | null = null;
  onOpenModeSelect: (() => void) | null = null;
  onOpenModeDetail: ((modeId: ModeId) => void) | null = null;
  onOpenRecords: (() => void) | null = null;
  onOpenSettings: (() => void) | null = null;
  onOpenCollection: (() => void) | null = null;
  onClaimWeeklyReward: (() => void) | null = null;
  onHome: (() => void) | null = null;
  onRetry: (() => void) | null = null;
  onHomePrimaryStart: (() => void) | null = null;
  onPreferencesChange: ((patch: Partial<Omit<PlayerPreferences, "version">>) => void) | null = null;
  onSettingsLogin: (() => void) | null = null;
  onSettingsShare: (() => void) | null = null;
  onResumeGame: (() => void) | null = null;

  private readonly boot = new Container();
  private readonly loading = new Container();
  private readonly home = new Container();
  private readonly modeSelect = new Container();
  private readonly modeDetail = new Container();
  private readonly result = new Container();
  private readonly records = new Container();
  private readonly settings = new Container();
  private readonly collection = new Container();
  private readonly qa = new Container();
  private readonly pauseOverlay = new Container();
  private readonly pauseOverlayDimmer = new Graphics();
  private readonly pauseOverlayCard = new Graphics();
  private readonly pauseOverlayTitle = new Text({ text: "", style: textStyle({ fontSize: 70, fontWeight: "bold", fill: 0xf8fafc }) });
  private readonly pauseOverlayBody = new Text({ text: "", style: textStyle({ fontSize: 44, lineHeight: 60, fill: 0xcbd5e1, wordWrap: true, wordWrapWidth: 710 }) });
  private pauseOverlayResume: Container | null = null;
  private pauseOverlayResumeText: Text | null = null;
  private pauseOverlayInitialized = false;
  private readonly qaResultLabels = new Map<DevQaScenarioId, Text>();
  private viewportMetrics: AppShellViewportMetrics = { width: 360, height: 800 };
  private modeAvailability: ModeAvailability | undefined;
  private activeResult: { result: ModeResult; options: { runSource?: AppRunSource; outcome?: ProgressRecordOutcome } } | null = null;
  private resultFlowStep: ResultFlowStep = "summary";
  private modeCards = 0;
  private modeCardLayouts: Array<{ modeId: ModeId; x: number; y: number }> = [];
  private qaResults: DevQaResults = {
    touchHud: false,
    boss: false,
    special: false,
    blitz: false,
  };
  private selectedDifficultyByMode: Record<ModeId, DifficultyId> = {
    story: "rookie",
    freeDefense: "rookie",
    ranked: "rookie",
    bossRush: "defender",
    blitz60: "rookie",
    daily: "defender",
  };
  private selectedFreeDefensePreset: FreeDefensePresetId = "standard";
  private selectedPracticeBossId: BossId = "ringed_destroyer";
  private selectedStoryStageId: StoryStageId = "story-1";
  private lastProgress: ProgressSnapshot | undefined;
  private adReviveReadiness: AdReviveReadiness | undefined;
  private visualTimeMs = 0;
  private preferences: PlayerPreferences = defaultPlayerPreferences();
  private settingsAccountState: SettingsAccountState = { status: "anonymous" };
  private settingsShareState: SettingsShareState = "idle";

  constructor() {
    this.container = new Container();
    this.container.zIndex = LAYER.OVERLAY;
    this.container.sortableChildren = true;

    this.buildBoot();
    this.buildLoading();
    this.buildHome();
    this.buildModeSelect();
    this.buildModeDetail("freeDefense");
    this.buildResult();
    this.buildRecords();
    this.buildSettings();
    this.buildCollection(this.lastProgress);
    this.buildPauseOverlay();
    if (import.meta.env.DEV) this.buildQa();
    this.container.addChild(this.boot, this.loading, this.home, this.modeSelect, this.modeDetail, this.result, this.records, this.settings, this.collection, this.qa, this.pauseOverlay);
    this.showBoot();
  }

  showBoot(): void {
    this.hidePauseOverlay();
    this.boot.visible = true;
    this.loading.visible = false;
    this.home.visible = false;
    this.modeSelect.visible = false;
    this.modeDetail.visible = false;
    this.result.visible = false;
    this.records.visible = false;
    this.settings.visible = false;
    this.collection.visible = false;
    this.qa.visible = false;
    this.container.visible = true;
  }

  showLoading(): void {
    this.hidePauseOverlay();
    this.boot.visible = false;
    this.loading.visible = true;
    this.home.visible = false;
    this.modeSelect.visible = false;
    this.modeDetail.visible = false;
    this.result.visible = false;
    this.records.visible = false;
    this.settings.visible = false;
    this.collection.visible = false;
    this.qa.visible = false;
    this.container.visible = true;
  }

  showHome(progress?: ProgressSnapshot): void {
    this.hidePauseOverlay();
    if (progress) this.lastProgress = progress;
    this.buildHome();
    this.boot.visible = false;
    this.loading.visible = false;
    this.home.visible = true;
    this.modeSelect.visible = false;
    this.modeDetail.visible = false;
    this.result.visible = false;
    this.records.visible = false;
    this.settings.visible = false;
    this.collection.visible = false;
    this.qa.visible = false;
    this.container.visible = true;
  }

  showModeSelect(progress?: ProgressSnapshot): void {
    this.hidePauseOverlay();
    this.lastProgress = progress;
    this.buildModeSelect(progress);
    this.boot.visible = false;
    this.loading.visible = false;
    this.home.visible = false;
    this.modeSelect.visible = true;
    this.modeDetail.visible = false;
    this.result.visible = false;
    this.records.visible = false;
    this.settings.visible = false;
    this.collection.visible = false;
    this.qa.visible = false;
    this.container.visible = true;
  }

  showModeDetail(modeId: ModeId, progress?: ProgressSnapshot, options: AppShellModeDetailOptions = {}): void {
    this.hidePauseOverlay();
    this.lastProgress = progress;
    this.adReviveReadiness = options.adReviveReadiness;
    this.modeAvailability = options.availability;
    if (modeId === "story") this.syncSelectedStoryStage(progress);
    this.buildModeDetail(modeId, progress);
    this.boot.visible = false;
    this.loading.visible = false;
    this.home.visible = false;
    this.modeSelect.visible = false;
    this.modeDetail.visible = true;
    this.result.visible = false;
    this.records.visible = false;
    this.settings.visible = false;
    this.collection.visible = false;
    this.qa.visible = false;
    this.container.visible = true;
  }

  setViewportMetrics(metrics: AppShellViewportMetrics): void {
    if (!Number.isFinite(metrics.width) || !Number.isFinite(metrics.height) || metrics.width <= 0 || metrics.height <= 0) return;
    this.viewportMetrics = metrics;
    if (this.result.visible && this.activeResult) {
      this.refreshResultContent();
      return;
    }
    if (this.settings.visible) {
      this.buildSettings();
      return;
    }
    if (this.home.visible) {
      this.buildHome();
      return;
    }
    if (!this.modeDetail.visible) return;
    const modeId = this.modeDetailModeId();
    if (modeId) this.buildModeDetail(modeId, this.lastProgress);
  }

  showRecords(progress?: ProgressSnapshot, leaderboardStatus: LeaderboardBoundaryState = resolveLeaderboardBoundary(), leaderboardRows: PublicLeaderboardRow[] = []): void {
    this.hidePauseOverlay();
    this.lastProgress = progress;
    this.buildRecords(progress, leaderboardStatus, leaderboardRows);
    this.boot.visible = false;
    this.loading.visible = false;
    this.home.visible = false;
    this.modeSelect.visible = false;
    this.modeDetail.visible = false;
    this.result.visible = false;
    this.records.visible = true;
    this.settings.visible = false;
    this.collection.visible = false;
    this.qa.visible = false;
    this.container.visible = true;
  }

  showSettings(preferences?: PlayerPreferences, presentation?: SettingsPresentationState): void {
    this.hidePauseOverlay();
    if (preferences) this.preferences = preferences;
    if (presentation?.account) this.settingsAccountState = presentation.account;
    if (presentation?.share) this.settingsShareState = presentation.share;
    this.buildSettings();
    this.boot.visible = false;
    this.loading.visible = false;
    this.home.visible = false;
    this.modeSelect.visible = false;
    this.modeDetail.visible = false;
    this.result.visible = false;
    this.records.visible = false;
    this.settings.visible = true;
    this.collection.visible = false;
    this.qa.visible = false;
    this.container.visible = true;
  }

  showCollection(progress?: ProgressSnapshot): void {
    this.hidePauseOverlay();
    this.lastProgress = progress;
    this.buildCollection(progress);
    this.boot.visible = false;
    this.loading.visible = false;
    this.home.visible = false;
    this.modeSelect.visible = false;
    this.modeDetail.visible = false;
    this.result.visible = false;
    this.records.visible = false;
    this.settings.visible = false;
    this.collection.visible = true;
    this.qa.visible = false;
    this.container.visible = true;
  }

  showQa(): void {
    if (!import.meta.env.DEV) return;
    this.hidePauseOverlay();
    this.boot.visible = false;
    this.loading.visible = false;
    this.home.visible = false;
    this.modeSelect.visible = false;
    this.modeDetail.visible = false;
    this.result.visible = false;
    this.records.visible = false;
    this.settings.visible = false;
    this.collection.visible = false;
    this.qa.visible = true;
    this.container.visible = true;
  }

  showResult(result: ModeResult, options: { runSource?: AppRunSource; outcome?: ProgressRecordOutcome } = {}): void {
    this.hidePauseOverlay();
    this.activeResult = { result, options };
    this.resultFlowStep = "summary";
    this.refreshResultContent();
    this.boot.visible = false;
    this.loading.visible = false;
    this.home.visible = false;
    this.modeSelect.visible = false;
    this.modeDetail.visible = false;
    this.result.visible = true;
    this.records.visible = false;
    this.settings.visible = false;
    this.collection.visible = false;
    this.qa.visible = false;
    this.container.visible = true;
  }

  updateResult(result: ModeResult): void {
    if (!this.activeResult) return;
    this.activeResult = { result, options: this.activeResult.options };
    this.refreshResultContent();
  }

  private refreshResultContent(): void {
    const active = this.activeResult;
    if (!active) return;
    const { result, options } = active;
    this.buildResult(result, options.outcome, options.runSource);
  }

  hide(): void {
    this.container.visible = false;
  }

  showPauseOverlay(): void {
    this.buildPauseOverlay();
    this.boot.visible = false;
    this.loading.visible = false;
    this.home.visible = false;
    this.modeSelect.visible = false;
    this.modeDetail.visible = false;
    this.result.visible = false;
    this.records.visible = false;
    this.settings.visible = false;
    this.collection.visible = false;
    this.qa.visible = false;
    this.pauseOverlay.visible = true;
    this.container.visible = true;
  }

  hidePauseOverlay(): void {
    this.pauseOverlay.visible = false;
  }

  pauseOverlayVisible(): boolean {
    return this.pauseOverlay.visible;
  }

  triggerPauseOverlayResume(): void {
    if (!this.pauseOverlay.visible) return;
    this.hidePauseOverlay();
    this.onResumeGame?.();
  }

  modeCardCount(): number {
    return this.modeCards;
  }

  modeCardLayoutSnapshot(): Array<{ modeId: ModeId; x: number; y: number }> {
    return [...this.modeCardLayouts];
  }

  update(dtMs: number): void {
    this.visualTimeMs += dtMs;
    const seconds = this.visualTimeMs / 1000;
    this.setLayerFloat(this.homeVisualLayerLabel(), Math.sin(seconds * 0.9) * 8);
    this.setLayerFloat(this.resultVisualLayerLabel(), Math.sin(seconds * 0.7) * 5);
    this.rotateLabeledSprite("home-earth-sprite", dtMs * 0.00008);
    this.rotateLabeledSprite("home-earth-shield-sprite", -dtMs * 0.00012);
    this.rotateLabeledSprite("home-boss-sprite", -dtMs * 0.00004);
    this.rotateLabeledSprite("home-meteor-sprite", dtMs * 0.00018);
    for (const mode of modeDefinitions()) {
      this.rotateLabeledSprite(`mode-sprite-${mode.id}`, dtMs * (mode.id === "bossRush" ? -0.00005 : 0.00011));
    }
    this.rotateLabeledSprite("result-backdrop-sprite", dtMs * 0.00004);
    this.rotateLabeledSprite("result-debris-sprite", dtMs * 0.00018);
    this.rotateLabeledSprite("result-debris-sprite-2", -dtMs * 0.00016);
  }

  visualLayerCount(): { home: number; modeSelect: number; result: number } {
    return {
      home: this.countLabeledChildren(this.homeVisualLayerLabel()),
      modeSelect: modeDefinitions().filter((mode) => this.container.getChildByLabel(`mode-visual-${mode.id}`, true)).length,
      result: this.countLabeledChildren(this.resultVisualLayerLabel()),
    };
  }

  screenVisibilitySnapshot(): Record<"boot" | "loading" | "home" | "modeSelect" | "modeDetail" | "result" | "records" | "settings" | "collection" | "qa", boolean> {
    return {
      boot: this.boot.visible,
      loading: this.loading.visible,
      home: this.home.visible,
      modeSelect: this.modeSelect.visible,
      modeDetail: this.modeDetail.visible,
      result: this.result.visible,
      records: this.records.visible,
      settings: this.settings.visible,
      collection: this.collection.visible,
      qa: this.qa.visible,
    };
  }

  triggerResultAction(action: ResultAction): void {
    if (action === "retry") this.onRetry?.();
    if (action === "modeSelect") this.onOpenModeSelect?.();
    if (action === "home") this.onHome?.();
    if (action === "collection") this.onOpenCollection?.();
    if (action === "unlockReveal" && this.activeResult?.options.outcome) {
      this.resultFlowStep = "unlock_reveal";
      this.refreshResultContent();
    }
  }

  triggerModeCard(modeId: ModeId): void {
    this.onOpenModeDetail?.(modeId);
  }

  triggerModeDetailAction(action: "start" | "records" | "back"): void {
    if (action === "start") {
      const modeId = this.modeDetailModeId();
      if (modeId && this.modeDetailStartEnabled()) {
        if (modeId === "freeDefense") this.onStartRun?.(modeId, this.freeDefenseLaunchOptions());
        else if (modeId === "story") this.onStartRun?.(modeId, { storyStageId: this.selectedStoryStageId });
        else if (modeId === "ranked") this.onStartRun?.(modeId, { difficulty: this.selectedDifficultyByMode.ranked });
        else this.onStartRun?.(modeId);
      }
    }
    if (action === "records") this.onOpenRecords?.();
    if (action === "back") this.onOpenModeSelect?.();
  }

  triggerModeDetailChoice(choice: string): void {
    const modeId = this.modeDetailModeId();
    if (!modeId) return;
    const [kind, value] = choice.split(":");
    if (kind === "difficulty" && isDifficultyId(value)) {
      this.selectedDifficultyByMode[modeId] = value;
      this.buildModeDetail(modeId, this.lastProgress);
    }
    if (modeId === "freeDefense" && kind === "freeDefensePreset" && isFreeDefensePresetId(value)) {
      this.selectedFreeDefensePreset = value;
      this.buildModeDetail(modeId, this.lastProgress);
    }
    if (modeId === "freeDefense" && kind === "practiceBoss" && isBossId(value)) {
      this.selectedPracticeBossId = value;
      this.selectedFreeDefensePreset = "bossPractice";
      this.buildModeDetail(modeId, this.lastProgress);
    }
    if (modeId === "story" && kind === "storyStage" && isStoryStageId(value) && this.storyStageUnlocked(value)) {
      this.selectedStoryStageId = value;
      this.buildModeDetail(modeId, this.lastProgress);
    }
  }

  triggerSettingsAction(action: `locale:${Locale}` | "bgm" | "sfx" | "haptic" | "reducedMotion" | "login" | "share" | "back"): void {
    if (action === "back") {
      if (this.onHome) this.onHome();
      else this.showHome();
      return;
    }
    if (action === "login") {
      if (this.settingsAccountState.status === "anonymous" || this.settingsAccountState.status === "error") {
        this.onSettingsLogin?.();
      }
      return;
    }
    if (action === "share") {
      if (this.settingsShareState !== "sharing") this.onSettingsShare?.();
      return;
    }
    if (action.startsWith("locale:")) {
      const [, locale] = action.split(":") as ["locale", Locale];
      setLocale(locale);
      this.preferences = { ...this.preferences, locale };
      this.onPreferencesChange?.({ locale });
      this.rebuildLocalizedStaticScreens();
      this.showSettings();
      return;
    }
    const key = action === "bgm" ? "bgmEnabled" : action === "sfx" ? "sfxEnabled" : action === "haptic" ? "hapticEnabled" : "reducedMotion";
    const patch = { [key]: !this.preferences[key] } as Partial<Omit<PlayerPreferences, "version">>;
    this.preferences = { ...this.preferences, ...patch };
    this.onPreferencesChange?.(patch);
    this.showSettings();
  }

  triggerHomeAction(action: "collection" | "settings" | "qa"): void {
    if (action === "collection") this.onOpenCollection?.();
    if (action === "settings") {
      if (this.onOpenSettings) this.onOpenSettings();
      else this.showSettings();
    }
    if (action === "qa") this.showQa();
  }

  triggerCollectionAction(action: "claimWeekly"): void {
    if (action === "claimWeekly") this.onClaimWeeklyReward?.();
  }

  triggerQaAction(action: QaAction): void {
    const scenario = DEV_QA_SCENARIOS[action];
    this.onStartQaRun?.(scenario.modeId, scenario.preset);
  }

  triggerQaResultToggle(scenarioId: DevQaScenarioId): void {
    this.onToggleQaResult?.(scenarioId);
  }

  updateQaResults(results: DevQaResults): void {
    this.qaResults = { ...results };
    this.syncQaResultLabels();
  }

  private buildBoot(): void {
    this.boot.removeChildren();
    this.boot.label = "app-shell-boot";
    this.boot.addChild(this.backdrop(0.94));
    const title = new Text({ text: t("app.title"), style: textStyle({ fontSize: 74, fontWeight: "bold", fill: 0xf8fafc }) });
    title.anchor.set(0.5);
    title.position.set(BASE_WIDTH / 2, 820);
    const status = new Text({ text: t("boot.readying"), style: textStyle({ fontSize: 38, fontWeight: "bold", fill: 0x7dd3fc }) });
    status.anchor.set(0.5);
    status.position.set(BASE_WIDTH / 2, 920);
    this.boot.addChild(title, status);
  }

  private buildPauseOverlay(): void {
    const cardX = 110;
    const cardY = 610;
    const cardWidth = BASE_WIDTH - cardX * 2;
    const cardHeight = 700;
    if (!this.pauseOverlayInitialized) {
      this.pauseOverlayInitialized = true;
      this.pauseOverlay.label = "lifecycle-pause-overlay";
      this.pauseOverlay.zIndex = LAYER.OVERLAY + 1;
      this.pauseOverlay.eventMode = "static";
      this.pauseOverlay.hitArea = new Rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT);
      this.pauseOverlay.on("pointerdown", (event) => event.stopPropagation());
      this.pauseOverlay.on("pointertap", (event) => event.stopPropagation());

      this.pauseOverlayDimmer.label = "lifecycle-pause-backdrop";
      this.pauseOverlayDimmer.rect(0, 0, BASE_WIDTH, BASE_HEIGHT).fill({ color: 0x020617, alpha: 0.84 });

      this.pauseOverlayCard.label = "lifecycle-pause-card";
      this.pauseOverlayCard.roundRect(cardX, cardY + 18, cardWidth, cardHeight, 42).fill({ color: 0x000000, alpha: 0.45 });
      this.pauseOverlayCard.roundRect(cardX, cardY, cardWidth, cardHeight, 42).fill({ color: 0x071120, alpha: 0.98 });
      this.pauseOverlayCard.roundRect(cardX, cardY, cardWidth, cardHeight, 42).stroke({ width: 5, color: 0x3fd8ff, alpha: 0.76 });
      this.pauseOverlayCard.roundRect(cardX + 18, cardY + 18, cardWidth - 36, cardHeight - 36, 30).stroke({ width: 2, color: 0xffffff, alpha: 0.13 });
      this.pauseOverlayCard.moveTo(cardX + 72, cardY + 114).lineTo(cardX + cardWidth - 72, cardY + 114).stroke({ width: 5, color: 0x3fd8ff, alpha: 0.38, cap: "round" });

      this.pauseOverlayTitle.label = "lifecycle-pause-title";
      this.pauseOverlayTitle.anchor.set(0.5);
      this.pauseOverlayTitle.position.set(BASE_WIDTH / 2, cardY + 205);
      this.pauseOverlayBody.label = "lifecycle-pause-body";
      this.pauseOverlayBody.anchor.set(0.5);
      this.pauseOverlayBody.position.set(BASE_WIDTH / 2, cardY + 365);

      this.pauseOverlayResume = this.button(
        BASE_WIDTH / 2 - 320,
        cardY + 475,
        640,
        safePauseOverlayLayout().touchHeight,
        t("lifecyclePause.resume"),
        0x3fd8ff,
        () => this.triggerPauseOverlayResume(),
      );
      this.pauseOverlayResume.label = "lifecycle-pause-resume";
      this.pauseOverlayResumeText = this.pauseOverlayResume.children.find((child): child is Text => child instanceof Text) ?? null;
      this.pauseOverlay.addChild(this.pauseOverlayDimmer, this.pauseOverlayCard, this.pauseOverlayTitle, this.pauseOverlayBody, this.pauseOverlayResume);
    }
    this.pauseOverlayTitle.text = t("lifecyclePause.title");
    this.pauseOverlayBody.text = t("lifecyclePause.body");
    if (this.pauseOverlayResumeText) this.pauseOverlayResumeText.text = t("lifecyclePause.resume");
  }

  private buildLoading(): void {
    this.loading.removeChildren();
    this.loading.label = "app-shell-loading";
    this.loading.addChild(this.backdrop(0.94));
    const title = new Text({ text: t("loading.title"), style: textStyle({ fontSize: 58, fontWeight: "bold", fill: 0xf8fafc }) });
    title.anchor.set(0.5);
    title.position.set(BASE_WIDTH / 2, 860);
    const status = new Text({ text: t("loading.progress"), style: textStyle({ fontSize: 34, fill: 0x7dd3fc }) });
    status.anchor.set(0.5);
    status.position.set(BASE_WIDTH / 2, 940);
    this.loading.addChild(title, status);
  }

  private buildHome(): void {
    for (const child of this.home.removeChildren()) child.destroy({ children: true });
    this.home.addChild(this.backdrop(0.84));
    this.home.addChild(this.homeVisualLayer());
    const layout = appShellLayoutMetrics(this.viewportMetrics);
    const homeProgress = buildHomeViewModel(this.lastProgress);
    const title = new Text({ text: t("app.title"), style: textStyle({ fontSize: 86, fontWeight: "bold", fill: 0xf8fafc }) });
    title.anchor.set(0.5);
    title.position.set(BASE_WIDTH / 2, 540);

    const startRect = layout.homeButtons.start;
    const collectionRect = layout.homeButtons.collection;
    const settingsRect = layout.homeSettingsTrigger;
    const start = this.button(startRect.x, startRect.y, startRect.w, startRect.h, t(homeProgress.primaryAction.labelKey), 0xf59e0b, () => {
      if (this.onHomePrimaryStart) {
        this.onHomePrimaryStart();
        return;
      }
      if (homeProgress.primaryAction.kind === "open_recommended_mode") {
        this.onOpenModeSelect?.();
        return;
      }
      this.onStartRun?.("story", { storyStageId: "story-1" });
    });
    start.label = "home-primary";
    const startLabel = start.children.find((child): child is Text => child instanceof Text);
    if (startLabel) startLabel.label = "home-primary-label";
    const startHint = new Text({
      text: t(homeProgress.primaryAction.hintKey),
      style: textStyle({ fontSize: 25, fill: 0xcbd5e1, wordWrap: true, wordWrapWidth: 760 }),
    });
    startHint.label = "home-primary-hint";
    startHint.anchor.set(0.5);
    startHint.position.set(BASE_WIDTH / 2, startRect.y + startRect.h + 24);
    const collection = this.button(collectionRect.x, collectionRect.y, collectionRect.w, collectionRect.h, t("home.collection"), 0x94a3b8, () => this.onOpenCollection?.());
    const settings = this.homeSettingsButton(settingsRect, () => {
      if (this.onOpenSettings) this.onOpenSettings();
      else this.showSettings();
    });

    const defs = modeDefinitions();
    this.modeCards = defs.length;
    this.modeCardLayouts = [];
    for (const mode of defs) {
      const card = layout.modeCards.find((candidate) => candidate.modeId === mode.id);
      if (!card) continue;
      const { x, y, w, h } = card.rect;
      this.modeCardLayouts.push({ modeId: mode.id, x, y });
      this.home.addChild(this.modeCard(
        x,
        y,
        w,
        h,
        mode.id,
        t(mode.labelKey),
        t(mode.descriptionKey),
        this.modeSummary(mode.id, this.lastProgress),
      ));
    }

    if (this.lastProgress) {
      const summary = new Text({ text: `${t("home.progress")}: ${homeProgress.totalRuns}`, style: textStyle({ fontSize: 26, fill: 0x94a3b8 }) });
      summary.anchor.set(0.5);
      summary.position.set(BASE_WIDTH / 2, 620);
      this.home.addChild(summary);
    }
    this.home.addChild(title, start, startHint, collection, settings);
  }

  private buildModeSelect(progress?: ProgressSnapshot): void {
    this.modeSelect.removeChildren();
    this.modeSelect.addChild(this.backdrop(0.9));
    const title = new Text({ text: t("home.modes"), style: textStyle({ fontSize: 66, fontWeight: "bold", fill: 0xf8fafc }) });
    title.anchor.set(0.5);
    title.position.set(BASE_WIDTH / 2, 210);
    this.modeSelect.addChild(title);

    const layout = appShellLayoutMetrics();
    const defs = modeDefinitions();
    this.modeCards = defs.length;
    this.modeCardLayouts = [];
    defs.forEach((mode, index) => {
      const card = layout.modeCards[index]!;
      const { x, y, w, h } = card.rect;
      this.modeCardLayouts.push({ modeId: mode.id, x, y });
      this.modeSelect.addChild(this.modeCard(
        x,
        y,
        w,
        h,
        mode.id,
        t(mode.labelKey),
        t(mode.descriptionKey),
        this.modeSummary(mode.id, progress),
      ));
    });

    const bottom = layout.bottomNav;
    this.modeSelect.addChild(this.button(bottom.x, bottom.y, bottom.w, bottom.h, t("result.home"), 0x64748b, () => this.onHome?.()));
  }

  private buildModeDetail(modeId: ModeId, progress?: ProgressSnapshot): void {
    this.modeDetail.removeChildren();
    const mode = modeDefinitions().find((candidate) => candidate.id === modeId) ?? modeDefinitions()[0]!;
    const summary = this.modeSummary(mode.id, progress);
    this.modeDetail.label = `mode-detail-${mode.id}`;
    this.modeDetail.addChild(this.backdrop(0.92));

    const title = new Text({ text: t(mode.labelKey), style: textStyle({ fontSize: 68, fontWeight: "bold", fill: 0xf8fafc }) });
    title.anchor.set(0.5);
    title.position.set(BASE_WIDTH / 2, 220);

    const visual = this.modeCardVisual(mode.id, 360, 260);
    visual.position.set(BASE_WIDTH / 2, 420);
    visual.scale.set(1.8);

    const rankedAvailability = mode.id === "ranked" ? this.modeAvailability : undefined;
    const status = new Text({
      text: summary.comingSoon
        ? t("status.comingSoon")
        : !summary.unlocked
          ? t("status.locked")
          : rankedAvailability?.startKind === "server_verified"
            ? t("ranking.serverVerified")
            : rankedAvailability?.startKind === "local_practice"
              ? t("ranking.localPractice")
              : summary.progressLabel,
      style: textStyle({ fontSize: 38, fontWeight: "bold", fill: summary.unlocked ? 0x7dd3fc : 0xffc14d }),
    });
    status.anchor.set(0.5);
    status.position.set(BASE_WIDTH / 2, 620);
    status.visible = mode.id !== "freeDefense";

    const freeDefenseLayout = mode.id === "freeDefense" ? modeDetailLayout(this.viewportMetrics, "freeDefense") : undefined;
    const bodyFontSize = mode.id === "story" ? 30 : mode.id === "freeDefense" ? 27 : 34;
    const body = new Text({
      text: this.modeDetailBody(mode.id, summary),
      style: textStyle({ fontSize: bodyFontSize, lineHeight: bodyFontSize + 8, fill: 0xcbd5e1, wordWrap: true, wordWrapWidth: BASE_WIDTH - 180 }),
    });
    body.anchor.set(0.5, 0);
    body.position.set(BASE_WIDTH / 2, freeDefenseLayout?.body.y ?? 700);

    const startEnabled = summary.unlocked && !(mode.id === "freeDefense" && this.freeDefenseStandardLocked());
    const startColor = startEnabled ? this.modeAccent(mode.id) : 0x64748b;
    const controls = this.modeDetailControls(mode.id, freeDefenseLayout);
    const startY = freeDefenseLayout?.start.y ?? (mode.id === "story" ? 1220 : 1000);
    const startHeight = freeDefenseLayout?.start.h ?? 92;
    const bottomY = freeDefenseLayout ? freeDefenseLayout.secondaryActions.y : mode.id === "story" ? 1340 : 1120;
    const secondaryHeight = freeDefenseLayout?.secondaryActions.h ?? 76;
    const startLabel = startEnabled
      ? mode.id === "ranked"
        ? rankedAvailability?.startKind === "server_verified" ? t("ranking.startRanked") : t("ranking.startPractice")
        : t("start.button")
      : mode.id === "freeDefense" && summary.unlocked ? t("freeDefense.dailyLimit.locked") : t("status.locked");
    const start = this.button(BASE_WIDTH / 2 - 190, startY, 380, startHeight, startLabel, startColor, () => {
      if (!startEnabled) return;
      if (mode.id === "freeDefense") this.onStartRun?.(mode.id, this.freeDefenseLaunchOptions());
      else if (mode.id === "story") this.onStartRun?.(mode.id, { storyStageId: this.selectedStoryStageId });
      else if (mode.id === "ranked") this.onStartRun?.(mode.id, { difficulty: this.selectedDifficultyByMode.ranked });
      else this.onStartRun?.(mode.id);
    });
    start.label = startEnabled ? "mode-detail-start-enabled" : "mode-detail-start-locked";

    const records = this.button(BASE_WIDTH / 2 - 190, bottomY, 180, secondaryHeight, t("records.title"), 0x94a3b8, () => this.onOpenRecords?.());
    const back = this.button(BASE_WIDTH / 2 + 10, bottomY, 180, secondaryHeight, t("result.modeSelect"), 0x64748b, () => this.onOpenModeSelect?.());

    this.modeDetail.addChild(title, visual, status, body, controls, start, records, back);
  }

  private buildResult(
    result = this.activeResult?.result,
    outcome = this.activeResult?.options.outcome,
    runSource = this.activeResult?.options.runSource,
  ): void {
    const previousChildren = this.result.removeChildren();
    for (const child of previousChildren) child.destroy({ children: true });
    this.result.addChild(this.backdrop(0.82));
    this.result.addChild(this.resultVisualLayer());
    if (!result) return;

    const presentation = buildResultViewModel(outcome, result);
    const fit = computeRootFit(
      this.viewportMetrics.width,
      this.viewportMetrics.height,
      this.viewportMetrics.safeArea,
    );
    const qaDetailRows = import.meta.env.DEV && runSource === "devQa" ? 1 : 0;
    const layout = resultLayout({
      detailRows: presentation.details.length + qaDetailRows,
      unlockCards: presentation.unlockCards.length,
      featuredUnlockCards: presentation.unlockCards.some((card) => card.kind === "skill" && card.id === "nova_pulse") ? 1 : 0,
      // computeRootFit already removes the platform safe-area from the logical root.
      safeBottom: 0,
      rootFitScale: fit.scale,
    });
    const accent = this.resultToneAccent(presentation.tone);
    const panel = new Graphics();
    panel.label = `result-panel-${presentation.tone}`;
    panel.roundRect(layout.panel.x + 8, layout.panel.y + 14, layout.panel.w - 16, layout.panel.h, 28).fill({ color: 0x020617, alpha: 0.5 });
    panel.roundRect(layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h, 28).fill({ color: 0x071324, alpha: 0.97 });
    panel.roundRect(layout.header.x, layout.header.y, layout.header.w, layout.header.h, 22).fill({ color: 0x12213f, alpha: 0.58 });
    panel.roundRect(layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h, 28).stroke({ width: 5, color: accent, alpha: 0.76 });
    panel.roundRect(layout.panel.x + 14, layout.panel.y + 14, layout.panel.w - 28, layout.panel.h - 28, 20).stroke({ width: 2, color: 0x7dd3fc, alpha: 0.2 });
    panel.circle(layout.panel.x + 28, layout.panel.y + 28, 8).fill({ color: 0xffc14d, alpha: 0.8 });
    panel.circle(layout.panel.x + layout.panel.w - 28, layout.panel.y + 28, 8).fill({ color: accent, alpha: 0.82 });

    const title = new Text({ text: t(this.resultTitleKey(result)), style: textStyle({ fontSize: 64, fontWeight: "bold", fill: accent }) });
    title.label = "result-title";
    title.anchor.set(0.5, 0);
    title.position.set(layout.header.x + layout.header.w / 2, layout.header.y + 8);

    const mode = modeDefinitions().find((candidate) => candidate.id === result.modeId);
    const context = new Text({ text: t(mode?.labelKey ?? "mode.freeDefense.title"), style: textStyle({ fontSize: 28, fill: 0xcbd5e1 }) });
    context.label = "result-mode-context";
    context.anchor.set(0.5, 0);
    context.position.set(layout.header.x + layout.header.w / 2, layout.header.y + 82);

    const body = new Text({
      text: "",
      style: textStyle({ fontSize: 1, fill: 0xf8fafc }),
    });
    body.label = "result-body";
    body.visible = false;

    const stats = this.resultStatGrid(presentation.stats, layout.statGrid);
    const details = this.resultDetailCard(presentation.details, layout.detailCard, result, runSource);
    const revealVisible = this.resultFlowStep === "unlock_reveal";
    const unlocks = this.resultUnlockCards(presentation.unlockCards, layout.unlockCard, revealVisible);

    const flow = outcome ? resultFlowFor(outcome) : { steps: ["summary"] as ResultFlowStep[] };
    const unlockActions: Container[] = [];
    if (layout.unlockAction) {
      const reveal = this.button(layout.unlockAction.x, layout.unlockAction.y, layout.unlockAction.w, layout.unlockAction.h, t("result.unlocks"), 0xa78bfa, () => this.triggerResultAction("unlockReveal"));
      reveal.label = "result-unlock-reveal-action";
      reveal.visible = flow.steps.includes("unlock_reveal") && this.resultFlowStep === "summary";
      const collection = this.button(layout.unlockAction.x, layout.unlockAction.y, layout.unlockAction.w, layout.unlockAction.h, t("home.collection"), 0xa78bfa, () => this.triggerResultAction("collection"));
      collection.label = "result-collection-action";
      collection.visible = flow.steps.includes("collection_choice") && revealVisible;
      unlockActions.push(reveal, collection);
    }

    const actions = this.resultActionRow(presentation.primaryAction, layout.actions);
    this.result.addChild(panel, title, context, body, stats);
    if (details) this.result.addChild(details);
    if (unlocks) this.result.addChild(unlocks);
    this.result.addChild(...unlockActions, actions);
  }

  private resultStatGrid(stats: ResultStatCard[], rect: AppShellRect): Container {
    const grid = new Container();
    grid.label = "result-stat-grid";
    grid.hitArea = new Rectangle(0, 0, rect.w, rect.h);
    grid.position.set(rect.x, rect.y);
    const gap = 14;
    const cardWidth = (rect.w - gap) / 2;
    const cardHeight = (rect.h - gap) / 2;
    stats.forEach((stat, index) => {
      const card = new Container();
      card.label = `result-stat-${stat.id}`;
      card.position.set((index % 2) * (cardWidth + gap), Math.floor(index / 2) * (cardHeight + gap));
      const bg = new Graphics();
      bg.roundRect(0, 0, cardWidth, cardHeight, 18).fill({ color: 0x0b1b31, alpha: 0.96 });
      bg.roundRect(0, 0, cardWidth, cardHeight, 18).stroke({ width: 2, color: 0x3fd8ff, alpha: 0.34 });
      const label = new Text({ text: t(stat.labelKey), style: textStyle({ fontSize: 24, fill: 0xb9c8db }) });
      label.label = `result-stat-${stat.id}-label`;
      label.anchor.set(0.5, 0);
      label.position.set(cardWidth / 2, 12);
      const value = new Text({ text: this.resultStatValue(stat), style: textStyle({ fontSize: 42, fontWeight: "bold", fill: 0xf8fafc }) });
      value.label = `result-stat-${stat.id}-value`;
      value.anchor.set(0.5, 0);
      value.position.set(cardWidth / 2, 48);
      card.addChild(bg, label, value);
      grid.addChild(card);
    });
    return grid;
  }

  private resultDetailCard(
    details: ResultDetailRow[],
    rect: AppShellRect | undefined,
    result: ModeResult,
    runSource: AppRunSource | undefined,
  ): Container | null {
    if (!rect) return null;
    const card = new Container();
    card.label = "result-detail-card";
    card.hitArea = new Rectangle(0, 0, rect.w, rect.h);
    card.position.set(rect.x, rect.y);
    const bg = new Graphics();
    bg.roundRect(0, 0, rect.w, rect.h, 18).fill({ color: 0x0b1728, alpha: 0.94 });
    bg.roundRect(0, 0, rect.w, rect.h, 18).stroke({ width: 2, color: 0x7dd3fc, alpha: 0.26 });
    card.addChild(bg);
    const rows = [...details];
    if (import.meta.env.DEV && runSource === "devQa") rows.push({ id: "qa", labelKey: "result.qaProgressOff", value: "" });
    rows.forEach((detail, index) => {
      const row = new Container();
      row.label = `result-detail-${detail.id}`;
      row.position.set(18, 18 + index * 28);
      const text = new Text({ text: this.resultDetailText(detail, result), style: textStyle({ fontSize: 24, fill: detail.id === "qa" ? 0xa78bfa : 0xdbeafe, align: "left" }) });
      text.anchor.set(0, 0);
      row.addChild(text);
      card.addChild(row);
    });
    return card;
  }

  private resultUnlockCards(cards: ResultUnlockCard[], rect: AppShellRect | undefined, visible: boolean): Container | null {
    if (!rect) return null;
    const section = new Container();
    section.label = "result-unlock-card-area";
    section.hitArea = new Rectangle(0, 0, rect.w, rect.h);
    section.position.set(rect.x, rect.y);
    const bg = new Graphics();
    bg.visible = visible;
    bg.roundRect(0, 0, rect.w, rect.h, 18).fill({ color: 0x160f2f, alpha: 0.95 });
    bg.roundRect(0, 0, rect.w, rect.h, 18).stroke({ width: 3, color: 0xa78bfa, alpha: 0.72 });
    const title = new Text({ text: t("result.unlocks"), style: textStyle({ fontSize: 26, fontWeight: "bold", fill: 0xd8b4fe }) });
    title.visible = visible;
    title.anchor.set(0.5, 0);
    title.position.set(rect.w / 2, 10);
    section.addChild(bg, title);

    const indexedCards = cards.map((unlock, index) => ({ unlock, index }));
    const nova = indexedCards.find(({ unlock }) => unlock.kind === "skill" && unlock.id === "nova_pulse");
    const compactCards = indexedCards.filter(({ index }) => index !== nova?.index);
    let compactStartY = 48;
    if (nova) {
      const wrapper = new Container();
      wrapper.label = `result-unlock-card-${nova.index}`;
      wrapper.visible = visible;
      wrapper.position.set(14, 48);

      const featured = new Container();
      featured.label = "result-unlock-nova-card";
      featured.visible = visible;
      const featuredWidth = rect.w - 28;
      const featuredHeight = 180;
      const titleSafeHeight = 36;
      const instructionSafeHeight = 50;
      const metaSafeHeight = 24;
      const contrastSafeHeight = 22;
      featured.hitArea = new Rectangle(0, 0, featuredWidth, featuredHeight);
      const featuredBg = new Graphics();
      featuredBg.visible = visible;
      featuredBg.roundRect(0, 0, featuredWidth, featuredHeight, 18).fill({ color: 0x241547, alpha: 0.98 });
      featuredBg.roundRect(0, 0, featuredWidth, featuredHeight, 18).stroke({ width: 2.5, color: 0xc4b5fd, alpha: 0.82 });

      const gesture = new Graphics();
      gesture.label = "result-unlock-nova-gesture";
      gesture.visible = visible;
      gesture.circle(76, 78, 52).fill({ color: 0x0b1b35, alpha: 0.86 });
      gesture.circle(76, 78, 52).stroke({ width: 2, color: 0x67e8f9, alpha: 0.42 });
      drawSkillGestureIcon(gesture, "nova_pulse", 76, 78, 40, 0x67e8f9, 1);

      const novaTitle = new Text({
        text: this.resultUnlockLabel(nova.unlock),
        style: textStyle({ fontSize: 28, lineHeight: 34, fontWeight: "bold", fill: 0xf5f3ff, align: "left" }),
      });
      novaTitle.label = "result-unlock-nova-title";
      novaTitle.visible = visible;
      novaTitle.position.set(146, 14);
      novaTitle.hitArea = new Rectangle(0, 0, featuredWidth - 166, titleSafeHeight);

      const instruction = new Text({
        text: t("result.unlockNova.instruction"),
        style: textStyle({ fontSize: 21, lineHeight: 25, fontWeight: "bold", fill: 0xe0f2fe, align: "left", wordWrap: false }),
      });
      instruction.label = "result-unlock-nova-instruction";
      instruction.visible = visible;
      instruction.position.set(146, novaTitle.y + titleSafeHeight + 6);
      instruction.hitArea = new Rectangle(0, 0, featuredWidth - 166, instructionSafeHeight);

      const activeSkills = RemoteConfig.getSkills() as unknown;
      const novaConfig = resolveNovaPulseDefinition(
        typeof activeSkills === "object" && activeSkills !== null
          ? (activeSkills as { nova_pulse?: unknown }).nova_pulse
          : undefined,
      );
      const meta = new Text({
        text: t("result.unlockNova.meta", { cost: novaConfig.gaugeCost, seconds: novaConfig.cooldownSec }),
        style: textStyle({ fontSize: 20, lineHeight: 24, fill: 0xfcd34d, align: "left" }),
      });
      meta.label = "result-unlock-nova-meta";
      meta.visible = visible;
      meta.position.set(146, instruction.y + instructionSafeHeight + 8);
      meta.hitArea = new Rectangle(0, 0, featuredWidth - 166, metaSafeHeight);

      const contrast = new Text({
        text: t("result.unlockNova.contrast"),
        style: textStyle({ fontSize: 18, lineHeight: 22, fill: 0xa5b4fc, align: "left" }),
      });
      contrast.label = "result-unlock-nova-contrast";
      contrast.visible = visible;
      contrast.position.set(146, meta.y + metaSafeHeight + 8);
      contrast.hitArea = new Rectangle(0, 0, featuredWidth - 166, contrastSafeHeight);

      featured.addChild(featuredBg, gesture, novaTitle, instruction, meta, contrast);
      wrapper.addChild(featured);
      section.addChild(wrapper);
      compactStartY += 192;
    }

    const gap = 12;
    const cardWidth = (rect.w - 40 - gap) / 2;
    compactCards.forEach(({ unlock, index }, compactIndex) => {
      const card = new Container();
      card.label = `result-unlock-card-${index}`;
      card.visible = visible;
      card.position.set(14 + (compactIndex % 2) * (cardWidth + gap), compactStartY + Math.floor(compactIndex / 2) * 48);
      const cardBg = new Graphics();
      cardBg.roundRect(0, 0, cardWidth, 40, 12).fill({ color: 0x261a48, alpha: 0.94 });
      cardBg.roundRect(0, 0, cardWidth, 40, 12).stroke({ width: 1.5, color: 0xc4b5fd, alpha: 0.52 });
      const label = new Text({ text: this.resultUnlockLabel(unlock), style: textStyle({ fontSize: 22, fontWeight: "bold", fill: 0xf5f3ff }) });
      label.anchor.set(0.5);
      label.position.set(cardWidth / 2, 20);
      card.addChild(cardBg, label);
      section.addChild(card);
    });
    return section;
  }

  private resultActionRow(primary: "retry" | "modeSelect" | "home", rect: AppShellRect): Container {
    const row = new Container();
    row.label = "result-action-row";
    row.hitArea = new Rectangle(0, 0, rect.w, rect.h);
    row.position.set(rect.x, rect.y);
    const gap = 16;
    const width = (rect.w - gap * 2) / 3;
    const actions = [
      { id: "retry" as const, label: t("result.retry"), color: 0x3fd8ff, tap: () => this.triggerResultAction("retry") },
      { id: "modeSelect" as const, label: t("result.modeSelect"), color: 0x3fd8ff, tap: () => this.triggerResultAction("modeSelect") },
      { id: "home" as const, label: t("result.home"), color: 0x94a3b8, tap: () => this.triggerResultAction("home") },
    ];
    actions.forEach((action, index) => {
      const button = this.button(index * (width + gap), 0, width, rect.h, action.label, action.id === primary ? 0xffc14d : action.color, action.tap);
      button.label = `result-action-${action.id}`;
      if (action.id === primary) {
        const marker = new Container();
        marker.label = `result-primary-action-${action.id}`;
        button.addChild(marker);
      }
      row.addChild(button);
    });
    return row;
  }

  private resultStatValue(stat: ResultStatCard): string {
    if (stat.id === "time") return t("unit.seconds", { value: this.formatNumber(Number(stat.value)) });
    if (stat.id === "combo") return stat.value;
    return this.formatNumber(Number(stat.value));
  }

  private resultDetailText(detail: ResultDetailRow, result: ModeResult): string {
    if (detail.id === "mode" || detail.id === "qa") return t(detail.labelKey);
    if (detail.id === "boss-progress") {
      const value = result.modeId === "bossRush" ? `${detail.value}/${BOSS_IDS.length}` : detail.value;
      return `${t("result.bossKills")}: ${value}`;
    }
    if (detail.id === "story-stage") return `${t("mode.story.title")}: ${t(detail.labelKey)}`;
    if (detail.id === "daily-modifier") return `${t("mode.daily.title")}: ${t(detail.labelKey)}`;
    if (detail.id === "objective") return `${t("result.objective")}: ${t(detail.labelKey)}`;
    if (detail.id === "ranking") return `${t("result.ranking")}: ${t(detail.labelKey)}`;
    return detail.value ? `${t(detail.labelKey)}: ${detail.value}` : t(detail.labelKey);
  }

  private resultToneAccent(tone: "failure" | "success" | "survived"): number {
    if (tone === "success") return 0xffc14d;
    if (tone === "survived") return 0x3fd8ff;
    return 0xff5a5a;
  }

  private resultUnlockLabel(card: ResultUnlockCard): string {
    if (card.kind === "mode") {
      const mode = modeDefinitions().find((candidate) => candidate.id === card.id);
      return mode ? t(mode.labelKey) : t("result.unlocks");
    }
    if (card.kind === "skill") return this.resultLocalizedLabel(`skill.${card.id}`);
    if (card.kind === "boss") {
      const definition = BOSS_DEFINITIONS[card.id as BossId];
      return definition ? t("result.unlockCategory.boss", { name: t(definition.labelKey) }) : t("result.unlocks");
    }
    if (card.kind === "story") return isStoryStageId(card.id) ? this.storyStageLabel(card.id) : t("result.unlocks");

    const [kind, id] = card.id.split(":", 2);
    if (kind === "boss" && id) {
      const definition = BOSS_DEFINITIONS[id as BossId];
      return definition ? t("result.unlockCategory.bossCodex", { name: t(definition.labelKey) }) : t("result.unlocks");
    }
    if (kind === "specialObject" && id) return this.resultLocalizedLabel(`collection.special.${id}`);
    if (kind === "title" && id) return this.resultLocalizedLabel(`collection.title.${id}`);
    return t("result.unlocks");
  }

  private resultLocalizedLabel(key: string): string {
    const localized = t(key);
    return localized === key ? t("result.unlocks") : localized;
  }

  private resultTitleKey(result: ModeResult): "result.gameOver" | "result.cleared" | "result.survivedTitle" {
    if (result.objectiveOutcome === "cleared" || result.endReason === "stage_objective_complete" || result.endReason === "boss_sequence_complete") {
      return "result.cleared";
    }
    if (result.objectiveOutcome === "survived" || result.endReason === "timer_expired") {
      return "result.survivedTitle";
    }
    return "result.gameOver";
  }

  private buildRecords(progress?: ProgressSnapshot, leaderboardStatus: LeaderboardBoundaryState = resolveLeaderboardBoundary(), leaderboardRows: PublicLeaderboardRow[] = []): void {
    this.records.removeChildren();
    this.records.addChild(this.backdrop(0.92));
    const title = new Text({ text: t("records.title"), style: textStyle({ fontSize: 66, fontWeight: "bold", fill: 0xf8fafc }) });
    title.anchor.set(0.5);
    title.position.set(BASE_WIDTH / 2, 210);

    const lines = modeDefinitions().map((mode) => {
      const summary = this.modeSummary(mode.id, progress);
      return `${t(mode.labelKey)} · ${this.formatNumber(summary.bestScore)} · ${summary.progressLabel}`;
    });
    if (progress?.story.clearedStageIds.length) {
      const lastCleared = progress.story.clearedStageIds.at(-1);
      const lastLabel = lastCleared ? ` · ${this.storyStageLabel(lastCleared)}` : "";
      lines.push(`${t("records.storyClear")}: ${this.formatNumber(progress.story.clearedStageIds.length)}/${STORY_STAGE_PLAN.length}${lastLabel}`);
    }
    if (progress?.daily.clearCount) {
      const modifiers = progress.daily.completedModifierIds.length ? ` · ${progress.daily.completedModifierIds.map((id) => this.dailyModifierLabel(id)).join(", ")}` : "";
      lines.push(`${t("records.dailyClear")}: ${this.formatNumber(progress.daily.clearCount)}${modifiers}`);
    }
    const body = new Text({
      text: lines.join("\n"),
      style: textStyle({ fontSize: 34, fill: 0xcbd5e1, wordWrap: true, wordWrapWidth: BASE_WIDTH - 160 }),
    });
    body.anchor.set(0.5, 0);
    body.position.set(BASE_WIDTH / 2, 330);
    const leaderboard = leaderboardStatus;
    const rankingStatus = new Text({
      text: t(leaderboard.publicAvailable ? "records.leaderboardPublic" : "records.leaderboardLocked"),
      style: textStyle({ fontSize: 38, fontWeight: "bold", fill: 0xffc14d }),
    });
    rankingStatus.anchor.set(0.5);
    rankingStatus.position.set(BASE_WIDTH / 2, 960);
    const rankingHint = new Text({
      text: t(leaderboard.publicAvailable ? "records.leaderboardReadyHint" : "records.leaderboardRequirement"),
      style: textStyle({ fontSize: 28, fill: 0xcbd5e1 }),
    });
    rankingHint.anchor.set(0.5);
    rankingHint.position.set(BASE_WIDTH / 2, 1010);
    const rankingRows = new Text({
      text: leaderboard.publicAvailable && leaderboardRows.length > 0 ? leaderboardRows.map((row) => this.leaderboardRowText(row)).join("\n") : "",
      style: textStyle({ fontSize: 29, fill: 0xf8fafc, wordWrap: true, wordWrapWidth: BASE_WIDTH - 160 }),
    });
    rankingRows.anchor.set(0.5, 0);
    rankingRows.position.set(BASE_WIDTH / 2, 1060);

    this.records.addChild(title, body, rankingStatus, rankingHint, rankingRows, this.button(64, BASE_HEIGHT - 180, 230, 78, t("result.home"), 0x64748b, () => this.onHome?.()));
  }

  private leaderboardRowText(row: PublicLeaderboardRow): string {
    return `#${row.rank} · ${this.formatNumber(row.score)} · ${Math.floor(row.survivalMs / 1000)}s · ${this.formatNumber(row.kills)}K · x${this.formatNumber(row.maxCombo)}`;
  }

  private buildSettings(): void {
    this.settings.removeChildren();
    this.settings.addChild(this.backdrop(0.94));
    const title = new Text({ text: t("home.settings"), style: textStyle({ fontSize: 66, fontWeight: "bold", fill: 0xf8fafc }) });
    title.anchor.set(0.5);
    title.position.set(BASE_WIDTH / 2, 180);

    const touchHeight = settingsControlLayout(
      this.viewportMetrics.width,
      this.viewportMetrics.height,
      this.viewportMetrics.safeArea,
    ).touchHeight;
    const sensoryFirstRowY = 680;
    const sensorySecondRowY = sensoryFirstRowY + touchHeight + 16;
    const sensoryCardHeight = sensorySecondRowY + touchHeight + 26 - 585;
    const languageCardY = 585 + sensoryCardHeight + 30;
    const languageCardHeight = touchHeight + 106;
    const shareCardY = languageCardY + languageCardHeight + 30;
    const shareCardHeight = touchHeight + 256;
    const back = this.button(64, 112, 180, touchHeight, t("result.home"), 0x64748b, () => this.triggerSettingsAction("back"));
    back.label = "settings-back";

    const accountCard = this.settingsCard("settings-account-card", 80, 285, 920, 270, 0x3fd8ff);
    const accountTitle = this.settingsSectionTitle("settings.account.title", 126, 325, 0x7dd3fc);
    const accountStatus = new Text({
      text: this.settingsAccountStatusText(),
      style: textStyle({ fontSize: 29, fill: 0xcbd5e1, align: "left", wordWrap: true, wordWrapWidth: 500 }),
    });
    accountStatus.label = "settings-account-status";
    accountStatus.anchor.set(0, 0.5);
    accountStatus.position.set(126, 430);
    const login = this.settingsAccountState.status === "anonymous" || this.settingsAccountState.status === "error"
      ? this.button(670, 350, 280, touchHeight, t("settings.account.login"), 0x3fd8ff, () => this.triggerSettingsAction("login"))
      : null;
    if (login) login.label = "settings-login";

    const sensoryCard = this.settingsCard("settings-sensory-card", 80, 585, 920, sensoryCardHeight, 0xffc14d);
    const sensoryTitle = this.settingsSectionTitle("settings.sensory", 126, 625, 0xffc14d);
    const toggleLabel = (key: "settings.bgm" | "settings.sfx" | "settings.haptic" | "settings.reducedMotion", enabled: boolean) =>
      `${t(key)} · ${t(enabled ? "settings.on" : "settings.off")}`;
    const bgm = this.button(120, sensoryFirstRowY, 400, touchHeight, toggleLabel("settings.bgm", this.preferences.bgmEnabled), this.preferences.bgmEnabled ? 0x3fd8ff : 0x475569, () => this.triggerSettingsAction("bgm"));
    bgm.label = "settings-bgm";
    const sfx = this.button(560, sensoryFirstRowY, 400, touchHeight, toggleLabel("settings.sfx", this.preferences.sfxEnabled), this.preferences.sfxEnabled ? 0x3fd8ff : 0x475569, () => this.triggerSettingsAction("sfx"));
    sfx.label = "settings-sfx";
    const haptic = this.button(120, sensorySecondRowY, 400, touchHeight, toggleLabel("settings.haptic", this.preferences.hapticEnabled), this.preferences.hapticEnabled ? 0xffc14d : 0x475569, () => this.triggerSettingsAction("haptic"));
    haptic.label = "settings-haptic";
    const motion = this.button(560, sensorySecondRowY, 400, touchHeight, toggleLabel("settings.reducedMotion", this.preferences.reducedMotion), this.preferences.reducedMotion ? 0x3fd8ff : 0x475569, () => this.triggerSettingsAction("reducedMotion"));
    motion.label = "settings-reduced-motion";

    const languageCard = this.settingsCard("settings-language-card", 80, languageCardY, 920, languageCardHeight, 0x64748b);
    const languageTitle = this.settingsSectionTitle("settings.language", 126, languageCardY + 40, 0xcbd5e1);
    const ko = this.button(120, languageCardY + 85, 400, touchHeight, t("settings.locale.ko"), getLocale() === "ko" ? 0x3fd8ff : 0x64748b, () => this.triggerSettingsAction("locale:ko"));
    ko.label = "settings-locale-ko";
    const en = this.button(560, languageCardY + 85, 400, touchHeight, t("settings.locale.en"), getLocale() === "en" ? 0x3fd8ff : 0x64748b, () => this.triggerSettingsAction("locale:en"));
    en.label = "settings-locale-en";

    const shareCard = this.settingsCard("settings-share-card", 80, shareCardY, 920, shareCardHeight, 0x3fd8ff);
    const shareTitle = this.settingsSectionTitle("settings.share.title", 126, shareCardY + 40, 0x7dd3fc);
    const shareStatus = new Text({ text: t(`settings.share.${this.settingsShareState}`), style: textStyle({ fontSize: 30, fill: this.settingsShareState === "error" ? 0xffc14d : 0xcbd5e1, align: "left" }) });
    shareStatus.label = "settings-share-status";
    shareStatus.anchor.set(0, 0.5);
    shareStatus.position.set(126, shareCardY + 120);
    const inviteComingSoon = new Text({
      text: t("settings.share.inviteComingSoon"),
      style: textStyle({ fontSize: 27, fill: 0x94a3b8, align: "left", wordWrap: true, wordWrapWidth: 480 }),
    });
    inviteComingSoon.label = "settings-invite-coming-soon";
    inviteComingSoon.anchor.set(0, 0.5);
    inviteComingSoon.position.set(126, shareCardY + 215);
    const share = this.button(650, shareCardY + 180, 300, touchHeight, t("settings.share.action"), 0x3fd8ff, () => this.triggerSettingsAction("share"));
    share.label = "settings-share";
    if (this.settingsShareState === "sharing") {
      share.eventMode = "none";
      share.cursor = "default";
      share.alpha = 0.56;
    }

    this.settings.addChild(
      title,
      back,
      accountCard,
      accountTitle,
      accountStatus,
      ...(login ? [login] : []),
      sensoryCard,
      sensoryTitle,
      bgm,
      sfx,
      haptic,
      motion,
      languageCard,
      languageTitle,
      ko,
      en,
      shareCard,
      shareTitle,
      shareStatus,
      inviteComingSoon,
      share,
    );
  }

  private settingsAccountStatusText(): string {
    if (this.settingsAccountState.status === "anonymous") return t("settings.account.anonymous");
    if (this.settingsAccountState.status === "loading") return t("settings.account.loading");
    if (this.settingsAccountState.status === "linked") {
      const providerKey = this.settingsProviderLabelKey(this.settingsAccountState.provider);
      return providerKey
        ? t("settings.account.linked", { provider: t(providerKey) })
        : t("settings.account.linkedGeneric");
    }
    return t(this.settingsAccountState.reason ? `settings.account.error.${this.settingsAccountState.reason}` : "settings.account.error");
  }

  private settingsProviderLabelKey(provider: string): string | null {
    if (provider === "apps_in_toss") return "settings.account.provider.appsInToss";
    if (provider === "google_play") return "settings.account.provider.googlePlay";
    if (provider === "web_stub") return "settings.account.provider.webStub";
    return null;
  }

  private settingsSectionTitle(key: string, x: number, y: number, color: number): Text {
    const title = new Text({ text: t(key), style: textStyle({ fontSize: 35, fontWeight: "bold", fill: color, align: "left" }) });
    title.anchor.set(0, 0.5);
    title.position.set(x, y);
    return title;
  }

  private settingsCard(label: string, x: number, y: number, width: number, height: number, accent: number): Container {
    const card = new Container();
    card.label = label;
    card.position.set(x, y);
    card.hitArea = new Rectangle(0, 0, width, height);
    const surface = new Graphics();
    surface.roundRect(8, 10, width - 8, height - 8, 28).fill({ color: 0x020617, alpha: 0.48 });
    surface.roundRect(0, 0, width - 8, height - 8, 28).fill({ color: 0x071120, alpha: 0.9 });
    surface.roundRect(0, 0, width - 8, height - 8, 28).stroke({ width: 3, color: accent, alpha: 0.5 });
    surface.roundRect(12, 12, width - 32, height - 32, 20).stroke({ width: 1, color: 0xffffff, alpha: 0.1 });
    card.addChild(surface);
    return card;
  }

  private buildCollection(progress?: ProgressSnapshot): void {
    this.collection.removeChildren();
    this.collection.addChild(this.backdrop(0.9));
    const title = new Text({ text: t("home.collection"), style: textStyle({ fontSize: 66, fontWeight: "bold", fill: 0xf8fafc }) });
    title.anchor.set(0.5);
    title.position.set(BASE_WIDTH / 2, 210);

    const bossCodex = new Set(progress?.collection.bossCodex ?? []);
    const specialCodex = new Set(progress?.collection.specialObjectCodex ?? []);
    const titleCodex = new Set(progress?.collection.titles ?? []);
    const unlockedModes = new Set(progress?.unlocks.modes ?? ["story", "freeDefense"]);
    const bossLines = BOSS_IDS.map((id) => `${bossCodex.has(id) ? t("collection.unlocked") : t("collection.locked")} ${this.bossLabel(id)}`);
    const modeLines = modeDefinitions().map((mode) => `${unlockedModes.has(mode.id) ? t("collection.unlocked") : t("collection.locked")} ${t(mode.labelKey)}`);
    const specialLines = ["friendlyRescue", "satellite", "energyCapsule", "empMine"].map(
      (id) => `${specialCodex.has(id) ? t("collection.unlocked") : t("collection.locked")} ${t(`collection.special.${id}`)}`,
    );
    const titleLines = ["bossBreaker", "dailyClear", "blitzSurvivor", "comboPilot", "weekly_five_day"].map(
      (id) => `${titleCodex.has(id) ? t("collection.unlocked") : t("collection.locked")} ${t(`collection.title.${id}`)}`,
    );
    const returnProgress = progress
      ? buildCollectionViewModel(progress, new Date(), RemoteConfig.getRetention())
      : {
          medals: { gold: 0, silver: 0, bronze: 0, unearned: 32 },
          dailyClearDays: 0,
          weeklyClaims: 0,
          weekly: {
            weekKey: "",
            clearCount: 0,
            requiredClearDays: RemoteConfig.getRetention().weekly.requiredDistinctClearDays,
            claimable: false,
            claimed: false,
            titleId: RemoteConfig.getRetention().weekly.titleId,
          },
        };
    const medalSummary = new Text({
      text: `${t("collection.stageMedals")} · ${t("collection.gold")} ${returnProgress.medals.gold} · ${t("collection.silver")} ${returnProgress.medals.silver} · ${t("collection.bronze")} ${returnProgress.medals.bronze}\n${t("collection.dailyClearDays")} ${returnProgress.dailyClearDays} · ${t("collection.weeklyClaims")} ${returnProgress.weeklyClaims}`,
      style: textStyle({ fontSize: 25, lineHeight: 32, fill: 0xffc14d, wordWrap: true, wordWrapWidth: BASE_WIDTH - 180 }),
    });
    medalSummary.anchor.set(0.5, 0);
    medalSummary.position.set(BASE_WIDTH / 2, 305);

    const weeklyState = returnProgress.weekly.claimable
      ? t("collection.weeklyClaimable")
      : returnProgress.weekly.claimed
        ? t("collection.weeklyClaimed")
        : t("collection.weeklyInProgress");
    const weeklyGoal = new Text({
      text: `${t("collection.weeklyGoal")} ${returnProgress.weekly.clearCount}/${returnProgress.weekly.requiredClearDays} · ${t(`collection.title.${returnProgress.weekly.titleId}`)} · ${weeklyState}`,
      style: textStyle({ fontSize: 25, lineHeight: 32, fill: returnProgress.weekly.claimable ? 0x7dd3fc : 0xa78bfa, wordWrap: true, wordWrapWidth: BASE_WIDTH - 180 }),
    });
    weeklyGoal.label = "collection-weekly-goal";
    weeklyGoal.anchor.set(0.5, 0);
    weeklyGoal.position.set(BASE_WIDTH / 2, 375);

    const weeklyClaim = this.button(
      340,
      423,
      400,
      76,
      t("collection.weeklyClaimable"),
      0x3fd8ff,
      () => this.triggerCollectionAction("claimWeekly"),
    );
    weeklyClaim.label = "collection-weekly-claim";
    weeklyClaim.visible = returnProgress.weekly.claimable;

    const body = new Text({
      text: `${t("collection.bosses")}\n${bossLines.join("\n")}\n\n${t("collection.modes")}\n${modeLines.join("\n")}\n\n${t("collection.specialObjects")}\n${specialLines.join("\n")}\n\n${t("collection.titles")}\n${titleLines.join("\n")}`,
      style: textStyle({ fontSize: 26, fill: 0xcbd5e1, wordWrap: true, wordWrapWidth: BASE_WIDTH - 180 }),
    });
    body.anchor.set(0.5, 0);
    body.position.set(BASE_WIDTH / 2, returnProgress.weekly.claimable ? 525 : 455);

    this.collection.addChild(title, medalSummary, weeklyGoal, weeklyClaim, body, this.button(64, BASE_HEIGHT - 180, 230, 78, t("result.home"), 0x64748b, () => this.onHome?.()));
  }

  private buildQa(): void {
    this.qaResultLabels.clear();
    this.qa.removeChildren();
    this.qa.addChild(this.backdrop(0.92));
    const title = new Text({ text: t("devQa.title"), style: textStyle({ fontSize: 66, fontWeight: "bold", fill: 0xf8fafc }) });
    title.anchor.set(0.5);
    title.position.set(BASE_WIDTH / 2, 220);

    const body = new Text({
      text: t("devQa.body"),
      style: textStyle({ fontSize: 32, fill: 0xcbd5e1, wordWrap: true, wordWrapWidth: BASE_WIDTH - 160 }),
    });
    body.anchor.set(0.5, 0);
    body.position.set(BASE_WIDTH / 2, 310);

    const home = this.button(64, BASE_HEIGHT - 180, 230, 78, t("result.home"), 0x64748b, () => this.onHome?.());

    this.qa.addChild(title, body);
    DEV_QA_SCENARIO_LIST.forEach((scenario, index) => {
      const scenarioId = scenario.id;
      const y = 430 + index * 132;
      const color = QA_SCENARIO_COLOR[scenarioId];
      const launch = this.button(64, y, 666, 92, t(scenario.labelKey), color, () => this.triggerQaAction(scenarioId));
      const result = this.qaResultButton(762, y, 254, 92, scenarioId, color);
      this.qa.addChild(launch, result);
    });
    this.qa.addChild(home);
    this.syncQaResultLabels();
  }

  private qaResultButton(x: number, y: number, w: number, h: number, scenarioId: DevQaScenarioId, color: number): Container {
    const btn = this.button(x, y, w, h, this.qaResults[scenarioId] ? t("devQa.pass") : t("devQa.pending"), color, () => this.triggerQaResultToggle(scenarioId));
    btn.label = `qa-result-button-${scenarioId}`;
    const label = btn.children.find((child): child is Text => child instanceof Text);
    if (label) {
      label.label = `qa-result-label-${scenarioId}`;
      this.qaResultLabels.set(scenarioId, label);
    }
    return btn;
  }

  private syncQaResultLabels(): void {
    for (const [scenarioId, label] of this.qaResultLabels) {
      label.text = this.qaResults[scenarioId] ? t("devQa.pass") : t("devQa.pending");
      label.style = textStyle({
        fontSize: 34,
        fontWeight: "bold",
        fill: this.qaResults[scenarioId] ? 0xbbf7d0 : 0xfef3c7,
      });
    }
  }

  private backdrop(alpha: number): Graphics {
    const g = new Graphics();
    g.rect(0, 0, BASE_WIDTH, BASE_HEIGHT).fill({ color: 0x05060f, alpha });
    g.circle(BASE_WIDTH * 0.18, BASE_HEIGHT * 0.18, 360).fill({ color: 0x10245f, alpha: 0.16 * alpha });
    g.circle(BASE_WIDTH * 0.82, BASE_HEIGHT * 0.32, 420).fill({ color: 0x3d1a72, alpha: 0.13 * alpha });
    g.circle(BASE_WIDTH * 0.46, BASE_HEIGHT * 0.78, 480).fill({ color: 0x012a3a, alpha: 0.14 * alpha });
    g.ellipse(BASE_WIDTH / 2, 520, 560, 130).stroke({ width: 3, color: 0x3fd8ff, alpha: 0.11 * alpha });
    g.ellipse(BASE_WIDTH / 2, 780, 720, 190).stroke({ width: 2, color: 0xffc14d, alpha: 0.08 * alpha });
    let seed = 7127;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < 86; i += 1) {
      const x = rand() * BASE_WIDTH;
      const y = rand() * BASE_HEIGHT;
      const r = 0.7 + rand() * 1.9;
      const color = rand() > 0.82 ? 0x7dd3fc : 0xffffff;
      g.circle(x, y, r).fill({ color, alpha: (0.12 + rand() * 0.42) * alpha });
    }
    for (let i = 0; i < 9; i += 1) {
      const y = 230 + i * 176;
      const x = i % 2 === 0 ? 68 : BASE_WIDTH - 68;
      g.moveTo(x, y).lineTo(i % 2 === 0 ? x + 180 : x - 180, y + 44).stroke({
        width: 2,
        color: i % 3 === 0 ? 0xffc14d : 0x3fd8ff,
        alpha: 0.08 * alpha,
        cap: "round",
      });
    }
    return g;
  }

  private modeCard(x: number, y: number, w: number, h: number, modeId: ModeId, title: string, description: string, summary: ModeProgressSummary): Container {
    const card = new Container();
    card.eventMode = "static";
    card.cursor = "pointer";
    const bg = new Graphics();
    const accentColor = this.modeAccent(modeId);
    bg.roundRect(6, 10, w, h, 22).fill({ color: 0x020617, alpha: 0.5 });
    bg.roundRect(0, 0, w, h, 22).fill({ color: 0x071120, alpha: 0.94 });
    bg.roundRect(0, 0, w, Math.min(84, h * 0.42), 22).fill({ color: accentColor, alpha: 0.13 });
    bg.roundRect(12, 12, w - 24, h - 24, 18).stroke({ width: 2, color: 0xffffff, alpha: 0.1 });
    bg.roundRect(0, 0, w, h, 22).stroke({ width: 3, color: accentColor, alpha: 0.58 });
    bg.moveTo(26, h - 24).lineTo(w - 26, h - 24).stroke({ width: 3, color: accentColor, alpha: 0.22, cap: "round" });

    const titleText = new Text({ text: title, style: textStyle({ fontSize: 31, fontWeight: "bold", align: "left" }) });
    titleText.anchor.set(0, 0);
    titleText.position.set(28, 32);

    const body = new Text({ text: description, style: textStyle({ fontSize: 20, fill: 0xcbd5e1, align: "left", wordWrap: true, wordWrapWidth: w - 132 }) });
    body.anchor.set(0, 0);
    body.position.set(28, 92);
    const progress = new Text({
      text: summary.unlocked ? summary.progressLabel : t("status.locked"),
      style: textStyle({ fontSize: 20, fill: summary.unlocked ? 0x7dd3fc : 0xffc14d, align: "left" }),
    });
    progress.anchor.set(0, 0);
    progress.position.set(28, 174);

    const accent = this.modeCardVisual(modeId, w, h);
    card.position.set(x, y);
    card.addChild(bg, accent, titleText, body, progress);
    card.on("pointertap", () => this.triggerModeCard(modeId));
    return card;
  }

  private modeSummary(modeId: ModeId, progress: ProgressSnapshot | undefined): ModeProgressSummary {
    if (progress) return buildModeProgressSummary(progress, modeId);
    return {
      modeId,
      unlocked: true,
      comingSoon: false,
      plays: 0,
      bestScore: 0,
      bestSurvivalMs: 0,
      bestCombo: 0,
      bestKills: 0,
      bestBossKills: 0,
      bestLabel: t("progress.noRecord"),
      progressLabel: t("progress.firstPlay"),
    };
  }

  private modeDetailBody(modeId: ModeId, summary: ModeProgressSummary): string {
    const mode = modeDefinitions().find((candidate) => candidate.id === modeId)!;
    const base = `${t(mode.descriptionKey)}\n${summary.bestLabel}\n${t("label.kills")} ${this.formatNumber(summary.bestKills)} · ${t("hud.combo")} x${summary.bestCombo}`;
    if (modeId === "bossRush") {
      return [
        base,
        t("bossRush.detail.sequence"),
        this.bossRushSequenceLabel(),
        t("bossRush.detail.weakPoint"),
        t("bossRush.detail.localRecord"),
      ].join("\n");
    }
    if (modeId === "story") {
      const selectedStage = this.selectedStoryStage();
      return [
        base,
        t("story.chapterStageCount", { chapters: STORY_CHAPTERS.length, stages: STORY_STAGE_PLAN.length }),
        `${t("story.currentStage")}: ${t(selectedStage.labelKey)}`,
        `${t("story.tutorial.label")}: ${t(selectedStage.tutorialKey)}`,
        this.storyUnlockSummary(),
      ].join("\n");
    }
    if (modeId === "freeDefense") {
      return [
        `${t(mode.descriptionKey)} · ${summary.bestLabel}`,
        this.freeDefenseDailyLimitText(),
        this.freeDefenseAdReviveText(),
        this.selectedFreeDefensePreset === "standard"
          ? t("freeDefense.detail.standardRecord")
          : t("freeDefense.detail.practiceRecordOff"),
      ].join("\n");
    }
    return base;
  }

  private modeDetailControls(modeId: ModeId, freeDefenseLayout?: ModeDetailLayout): Container {
    const controls = new Container();
    controls.label = `mode-detail-controls-${modeId}`;
    if (modeId === "story") return this.storyDetailControls();
    if (modeId === "ranked") {
      const difficultyLabel = new Text({ text: t("modeDetail.difficulty"), style: textStyle({ fontSize: 30, fontWeight: "bold", fill: 0xffc14d }) });
      difficultyLabel.anchor.set(0.5);
      difficultyLabel.position.set(BASE_WIDTH / 2, 845);
      controls.addChild(difficultyLabel);

      const difficulties: Array<{ id: DifficultyId; labelKey: string }> = [
        { id: "rookie", labelKey: "difficulty.rookie" },
        { id: "defender", labelKey: "difficulty.defender" },
        { id: "elite", labelKey: "difficulty.elite" },
        { id: "master", labelKey: "difficulty.master" },
      ];
      difficulties.forEach((difficulty, index) => {
        const selected = this.selectedDifficultyByMode.ranked === difficulty.id;
        controls.addChild(this.button(
          92 + index * 224,
          880,
          190,
          62,
          t(difficulty.labelKey),
          selected ? 0xffc14d : 0x64748b,
          () => this.triggerModeDetailChoice(`difficulty:${difficulty.id}`),
        ));
      });
      return controls;
    }
    if (modeId !== "freeDefense") return controls;

    const difficultyLayout = freeDefenseLayout?.difficultyControls;
    const practiceLayout = freeDefenseLayout?.practiceControls;
    const bossLayout = freeDefenseLayout?.bossControls;
    const touchHeight = difficultyLayout?.h ?? 62;
    const difficultyLabel = new Text({ text: t("modeDetail.difficulty"), style: textStyle({ fontSize: 30, fontWeight: "bold", fill: 0x7dd3fc }) });
    difficultyLabel.anchor.set(0.5);
    difficultyLabel.position.set(BASE_WIDTH / 2, (difficultyLayout?.y ?? 880) - 36);
    controls.addChild(difficultyLabel);

    const difficulties: Array<{ id: DifficultyId; labelKey: string }> = [
      { id: "rookie", labelKey: "difficulty.rookie" },
      { id: "defender", labelKey: "difficulty.defender" },
      { id: "elite", labelKey: "difficulty.elite" },
      { id: "master", labelKey: "difficulty.master" },
    ];
    difficulties.forEach((difficulty, index) => {
      const selected = this.selectedDifficultyByMode.freeDefense === difficulty.id;
      const btn = this.button(
        92 + index * 224,
        difficultyLayout?.y ?? 880,
        190,
        touchHeight,
        t(difficulty.labelKey),
        selected ? 0x3fd8ff : 0x64748b,
        () => this.triggerModeDetailChoice(`difficulty:${difficulty.id}`),
      );
      controls.addChild(btn);
    });

    const practiceLabel = new Text({ text: t("freeDefense.practice"), style: textStyle({ fontSize: 30, fontWeight: "bold", fill: 0xffc14d }) });
    practiceLabel.anchor.set(0.5);
    practiceLabel.position.set(BASE_WIDTH / 2, (practiceLayout?.y ?? 1008) - 36);
    controls.addChild(practiceLabel);

    freeDefensePresetDefinitions().forEach((preset, index) => {
      const selected = this.selectedFreeDefensePreset === preset.id;
      const btn = this.button(
        126 + index * 278,
        practiceLayout?.y ?? 1008,
        238,
        practiceLayout?.h ?? 62,
        t(preset.labelKey),
        selected ? 0xffc14d : 0x64748b,
        () => this.triggerModeDetailChoice(`freeDefensePreset:${preset.id}`),
      );
      controls.addChild(btn);
    });

    const bossLabel = new Text({ text: t("freeDefense.practiceBoss"), style: textStyle({ fontSize: 28, fontWeight: "bold", fill: 0xff9f6e }) });
    bossLabel.anchor.set(0.5);
    bossLabel.position.set(BASE_WIDTH / 2, (bossLayout?.y ?? 1124) - 36);
    controls.addChild(bossLabel);

    BOSS_IDS.forEach((bossId, index) => {
      const selected = this.selectedPracticeBossId === bossId;
      const col = index % 3;
      const row = Math.floor(index / 3);
      const btn = this.button(
        96 + col * 298 + (row === 1 ? 150 : 0),
        (bossLayout?.y ?? 1124) + row * ((bossLayout?.h ? (bossLayout.h - 12) / 2 + 12 : 70)),
        258,
        bossLayout?.h ? (bossLayout.h - 12) / 2 : 54,
        this.bossLabel(bossId),
        selected ? 0xff7a45 : 0x64748b,
        () => this.triggerModeDetailChoice(`practiceBoss:${bossId}`),
      );
      controls.addChild(btn);
    });

    return controls;
  }

  private storyDetailControls(): Container {
    const controls = new Container();
    controls.label = "mode-detail-controls-story";
    const selected = this.selectedStoryStage();
    const selectedNumber = Number(selected.id.replace("story-", ""));
    const neighbors = [selectedNumber - 1, selectedNumber, selectedNumber + 1]
      .filter((value) => value >= 1 && value <= STORY_STAGE_PLAN.length)
      .map((value) => STORY_STAGE_PLAN[value - 1]!);

    const label = new Text({ text: t("story.stageSelect"), style: textStyle({ fontSize: 30, fontWeight: "bold", fill: 0x7dd3fc }) });
    label.anchor.set(0.5);
    label.position.set(BASE_WIDTH / 2, 1000);
    controls.addChild(label);

    neighbors.forEach((stage, index) => {
      const unlocked = this.storyStageUnlocked(stage.id);
      const active = stage.id === this.selectedStoryStageId;
      const btn = this.button(
        160 + index * 260,
        1052,
        220,
        66,
        `${stage.id.replace("story-", "")}. ${t(stage.labelKey)}`,
        !unlocked ? 0x475569 : active ? 0x3fd8ff : 0x64748b,
        () => this.triggerModeDetailChoice(`storyStage:${stage.id}`),
      );
      controls.addChild(btn);
    });
    return controls;
  }

  private freeDefenseLaunchOptions(): RunLaunchOptions {
    return {
      difficulty: this.selectedDifficultyByMode.freeDefense,
      freeDefensePreset: this.selectedFreeDefensePreset,
      practiceBossId: this.selectedFreeDefensePreset === "bossPractice" ? this.selectedPracticeBossId : undefined,
    };
  }

  private freeDefenseAdReviveText(): string {
    const availability = resolveReviveAvailability(buildRunConfig("freeDefense", this.freeDefenseLaunchOptions()), this.adReviveReadiness);
    return t(availability.enabled ? "freeDefense.adRevive.ready" : "freeDefense.adRevive.locked");
  }

  private selectedStoryStage(): (typeof STORY_STAGE_PLAN)[number] {
    return STORY_STAGE_PLAN.find((stage) => stage.id === this.selectedStoryStageId) ?? STORY_STAGE_PLAN[0]!;
  }

  private syncSelectedStoryStage(progress: ProgressSnapshot | undefined): void {
    if (!progress) return;
    if (this.storyStageUnlocked(this.selectedStoryStageId, progress)) return;
    const maxUnlocked = Math.max(1, ...progress.unlocks.storyStages);
    const bounded = Math.min(maxUnlocked, STORY_STAGE_PLAN.length);
    this.selectedStoryStageId = `story-${bounded}`;
  }

  private storyStageUnlocked(stageId: StoryStageId, progress = this.lastProgress): boolean {
    if (!progress) return true;
    const stageNumber = Number(stageId.replace("story-", ""));
    return progress.unlocks.storyStages.includes(stageNumber);
  }

  private storyUnlockSummary(): string {
    const progress = this.lastProgress;
    if (!progress) return t("story.unlockSummary", { current: 1, max: STORY_STAGE_PLAN.length });
    const maxUnlocked = Math.max(1, ...progress.unlocks.storyStages);
    return t("story.unlockSummary", {
      current: Math.min(maxUnlocked, STORY_STAGE_PLAN.length),
      max: STORY_STAGE_PLAN.length,
    });
  }

  private storyStageLabel(stageId: StoryStageId): string {
    const stage = STORY_STAGE_PLAN.find((candidate) => candidate.id === stageId);
    return stage ? t(stage.labelKey) : stageId;
  }

  private dailyModifierLabel(id: DailyModifierId): string {
    return t(dailyModifierById(id).labelKey);
  }

  private bossLabel(id: string): string {
    return BOSS_DEFINITIONS[id as BossId] ? t(BOSS_DEFINITIONS[id as BossId].labelKey) : id;
  }

  private bossRushSequenceLabel(): string {
    const sequence = buildRunConfig("bossRush").rules.bossPolicy.sequence ?? BOSS_IDS;
    return sequence.map((id) => this.bossLabel(id)).join(" -> ");
  }

  private formatNumber(value: number): string {
    return value.toLocaleString(getLocale() === "ko" ? "ko-KR" : "en-US");
  }

  private rebuildLocalizedStaticScreens(): void {
    const detailModeId = this.modeDetailModeId() ?? "freeDefense";
    this.buildBoot();
    this.buildLoading();
    this.buildHome();
    this.buildModeSelect(this.lastProgress);
    this.buildModeDetail(detailModeId, this.lastProgress);
    this.buildResult();
    this.buildRecords(this.lastProgress);
    this.buildSettings();
    this.buildCollection();
    if (import.meta.env.DEV) this.buildQa();
  }

  private freeDefenseDailyLimitText(): string {
    const progress = this.lastProgress?.freeDefense;
    const todayCount = progress?.dailyPlayDate === freeDefenseDateKey() ? progress.dailyPlayCount : 0;
    return t("freeDefense.dailyLimit", {
      current: todayCount,
      max: FREE_DEFENSE_DAILY_PLAY_LIMIT,
    });
  }

  private freeDefenseStandardLocked(): boolean {
    if (this.selectedFreeDefensePreset !== "standard") return false;
    const progress = this.lastProgress?.freeDefense;
    const todayCount = progress?.dailyPlayDate === freeDefenseDateKey() ? progress.dailyPlayCount : 0;
    return todayCount >= FREE_DEFENSE_DAILY_PLAY_LIMIT;
  }

  private modeDetailModeId(): ModeId | null {
    const label = this.modeDetail.label;
    if (!label?.startsWith("mode-detail-")) return null;
    const id = label.slice("mode-detail-".length);
    return modeDefinitions().some((mode) => mode.id === id) ? (id as ModeId) : null;
  }

  private modeDetailStartEnabled(): boolean {
    return Boolean(this.modeDetail.getChildByLabel("mode-detail-start-enabled", true));
  }

  private homeSettingsButton(rect: AppShellRect, onTap: () => void): Container {
    const button = new Container();
    button.label = "home-settings-trigger";
    button.eventMode = "static";
    button.cursor = "pointer";
    button.position.set(rect.x, rect.y);
    button.hitArea = new Rectangle(0, 0, rect.w, rect.h);

    const shell = new Graphics();
    const visualSize = Math.min(156, rect.w, rect.h);
    const visualX = (rect.w - visualSize) / 2;
    const visualY = (rect.h - visualSize) / 2;
    shell.roundRect(visualX + 8, visualY + 10, visualSize - 8, visualSize - 8, 36).fill({ color: 0x020617, alpha: 0.56 });
    shell.roundRect(visualX, visualY, visualSize - 8, visualSize - 8, 36).fill({ color: 0x071120, alpha: 0.94 });
    shell.roundRect(visualX, visualY, visualSize - 8, visualSize - 8, 36).stroke({ width: 4, color: 0x3fd8ff, alpha: 0.76 });

    const gear = new Graphics();
    const centerX = rect.w / 2 - 4;
    const centerY = rect.h / 2 - 4;
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      gear
        .moveTo(centerX + Math.cos(angle) * 34, centerY + Math.sin(angle) * 34)
        .lineTo(centerX + Math.cos(angle) * 50, centerY + Math.sin(angle) * 50)
        .stroke({ width: 13, color: 0x3fd8ff, alpha: 0.94, cap: "round" });
    }
    gear.circle(centerX, centerY, 32).stroke({ width: 13, color: 0x3fd8ff, alpha: 0.94 });
    gear.circle(centerX, centerY, 10).fill({ color: 0xffc14d, alpha: 0.95 });

    button.addChild(shell, gear);
    button.on("pointertap", onTap);
    return button;
  }

  private button(x: number, y: number, w: number, h: number, label: string, color: number, onTap: () => void): Container {
    const btn = new Container();
    btn.eventMode = "static";
    btn.cursor = "pointer";
    btn.hitArea = new Rectangle(0, 0, w, h);
    const bg = new Graphics();
    bg.label = "premium-button-shell";
    const radius = Math.min(24, Math.max(14, h * 0.22));
    bg.roundRect(6, 9, w, h, radius).fill({ color: 0x020617, alpha: 0.52 });
    bg.roundRect(0, 0, w, h, radius).fill({ color: 0x071120, alpha: 0.92 });
    bg.roundRect(2, 2, w - 4, h * 0.5, radius).fill({ color, alpha: 0.23 });
    bg.roundRect(2, h * 0.52, w - 4, h * 0.42, radius).fill({ color: 0x000000, alpha: 0.18 });
    bg.roundRect(0, 0, w, h, radius).stroke({ width: 4, color, alpha: 0.82 });
    bg.roundRect(10, 10, w - 20, h - 20, Math.max(8, radius - 8)).stroke({ width: 1.5, color: 0xffffff, alpha: 0.18 });
    bg.moveTo(24, 16).lineTo(w - 24, 16).stroke({ width: Math.max(2, h * 0.035), color: 0xffffff, alpha: 0.2, cap: "round" });
    bg.moveTo(26, h - 12).lineTo(w - 26, h - 12).stroke({ width: Math.max(2, h * 0.04), color: 0x000000, alpha: 0.3, cap: "round" });
    bg.circle(22, h / 2, Math.max(4, h * 0.07)).fill({ color, alpha: 0.55 });
    bg.circle(w - 22, h / 2, Math.max(4, h * 0.07)).fill({ color, alpha: 0.4 });
    const text = new Text({ text: label, style: textStyle({ fontSize: Math.min(38, Math.max(24, w / Math.max(5, label.length))), fontWeight: "bold", fill: 0xf8fafc }) });
    text.anchor.set(0.5);
    text.position.set(w / 2, h / 2);
    btn.position.set(x, y);
    btn.addChild(bg, text);
    btn.on("pointertap", onTap);
    return btn;
  }

  private homeVisualLayer(): Container {
    const layer = new Container();
    layer.label = this.homeVisualLayerLabel();

    const halo = new Graphics();
    halo.circle(BASE_WIDTH / 2, 250, 300).fill({ color: 0x1d4ed8, alpha: 0.22 });
    halo.circle(BASE_WIDTH / 2 + 230, 260, 220).fill({ color: 0xff5a5a, alpha: 0.12 });
    halo.circle(BASE_WIDTH / 2 - 270, 438, 180).fill({ color: 0xffa94d, alpha: 0.08 });
    halo.ellipse(BASE_WIDTH / 2, 284, 410, 92).stroke({ width: 7, color: 0x3fd8ff, alpha: 0.14 });
    halo.ellipse(BASE_WIDTH / 2, 338, 520, 118).stroke({ width: 4, color: 0xffc14d, alpha: 0.1 });
    halo.moveTo(96, 684).lineTo(BASE_WIDTH - 118, 588).stroke({ width: 5, color: 0x3fd8ff, alpha: 0.08, cap: "round" });
    halo.moveTo(164, 250).lineTo(400, 182).stroke({ width: 4, color: 0xffffff, alpha: 0.08, cap: "round" });

    const earthCore = this.spriteLayer("home-earth-sprite", earthAssetUrl("core"), BASE_WIDTH / 2 - 34, 236, 0.7, {
      alpha: 0.94,
      rotation: -0.08,
    });
    const earthShield = this.spriteLayer("home-earth-shield-sprite", earthAssetUrl("shield"), BASE_WIDTH / 2 - 34, 236, 0.8, {
      alpha: 0.5,
      rotation: 0.1,
    });
    const boss = this.spriteLayer("home-boss-sprite", enemyAssetUrl("eclipse_core"), BASE_WIDTH / 2 + 214, 292, 0.54, {
      alpha: 0.8,
      rotation: 0.24,
      tint: 0xffc14d,
    });
    const meteor = this.spriteLayer("home-meteor-sprite", enemyAssetUrl("shard_meteor"), BASE_WIDTH / 2 - 262, 430, 0.46, {
      alpha: 0.86,
      rotation: -0.48,
    });

    const meteorB = this.spriteLayer("home-meteor-sprite-2", enemyAssetUrl("fast_comet"), BASE_WIDTH / 2 + 326, 476, 0.35, {
      alpha: 0.72,
      rotation: 0.78,
      tint: 0xffc14d,
    });
    layer.addChild(halo, earthShield, earthCore, boss, meteor, meteorB);
    return layer;
  }

  private resultVisualLayer(): Container {
    const layer = new Container();
    layer.label = this.resultVisualLayerLabel();

    const glow = new Graphics();
    glow.circle(BASE_WIDTH / 2, 390, 310).fill({ color: 0xff5a5a, alpha: 0.12 });
    glow.circle(BASE_WIDTH / 2 - 210, 470, 210).fill({ color: 0xffc14d, alpha: 0.08 });
    glow.ellipse(BASE_WIDTH / 2, 418, 440, 96).stroke({ width: 5, color: 0xff5a5a, alpha: 0.13 });
    glow.ellipse(BASE_WIDTH / 2, 468, 560, 128).stroke({ width: 3, color: 0x3fd8ff, alpha: 0.08 });

    const backdrop = this.spriteLayer("result-backdrop-sprite", earthAssetUrl("core"), BASE_WIDTH / 2, 386, 1.05, {
      alpha: 0.18,
      rotation: -0.16,
      tint: 0xff9f9f,
    });
    const debrisA = this.spriteLayer("result-debris-sprite", enemyAssetUrl("heavy_asteroid"), 180, 432, 0.42, {
      alpha: 0.5,
      rotation: 0.8,
    });
    const debrisB = this.spriteLayer("result-debris-sprite-2", enemyAssetUrl("small_meteor"), BASE_WIDTH - 170, 448, 0.36, {
      alpha: 0.44,
      rotation: -0.62,
    });

    const slash = new Graphics();
    slash.moveTo(168, 250).lineTo(408, 512).stroke({ width: 22, color: 0xff6b6b, alpha: 0.1, cap: "round" });
    slash.moveTo(168, 250).lineTo(408, 512).stroke({ width: 7, color: 0xffffff, alpha: 0.18, cap: "round" });
    slash.moveTo(BASE_WIDTH - 168, 280).lineTo(BASE_WIDTH - 380, 544).stroke({ width: 18, color: 0xffc14d, alpha: 0.1, cap: "round" });
    slash.moveTo(BASE_WIDTH - 168, 280).lineTo(BASE_WIDTH - 380, 544).stroke({ width: 5, color: 0xffffff, alpha: 0.14, cap: "round" });

    layer.addChild(glow, backdrop, debrisA, debrisB, slash);
    return layer;
  }

  private modeCardVisual(modeId: ModeId, w: number, h: number): Container {
    const layer = new Container();
    layer.label = `mode-visual-${modeId}`;
    layer.position.set(w - 68, h / 2 + 8);

    const halo = new Graphics();
    const accent = this.modeAccent(modeId);
    halo.circle(0, 0, 66).fill({ color: accent, alpha: 0.12 });
    halo.circle(0, 0, 42).stroke({ width: 4, color: accent, alpha: 0.28 });
    halo.ellipse(0, 7, 82, 23).stroke({ width: 3, color: 0xffffff, alpha: 0.12 });

    const assetByMode: Record<ModeId, string> = {
      story: earthAssetUrl("shield"),
      freeDefense: earthAssetUrl("core"),
      ranked: enemyAssetUrl("directional_comet"),
      bossRush: enemyAssetUrl("eclipse_core"),
      blitz60: enemyAssetUrl("fast_comet"),
      daily: enemyAssetUrl("iron_planet"),
    };
    const rotationByMode: Record<ModeId, number> = {
      story: 0.1,
      freeDefense: -0.08,
      ranked: -0.34,
      bossRush: 0.18,
      blitz60: 0.52,
      daily: -0.2,
    };

    const sprite = this.spriteLayer(`mode-sprite-${modeId}`, assetByMode[modeId], 0, 0, modeId === "bossRush" ? 0.14 : 0.3, {
      alpha: 0.88,
      rotation: rotationByMode[modeId],
      tint: modeId === "ranked" ? 0xffd36b : undefined,
    });

    layer.addChild(halo, sprite);
    if (modeId === "bossRush") {
      layer.addChild(
        this.spriteLayer("mode-sprite-bossRush-lava", enemyAssetUrl("lava_titan"), -34, 20, 0.07, { alpha: 0.72, rotation: -0.35 }),
        this.spriteLayer("mode-sprite-bossRush-ice", enemyAssetUrl("ice_colossus"), 36, 24, 0.065, { alpha: 0.68, rotation: 0.4 }),
      );
    }
    return layer;
  }

  private modeAccent(modeId: ModeId): number {
    if (modeId === "story") return 0x60a5fa;
    if (modeId === "freeDefense") return 0x3fd8ff;
    if (modeId === "ranked") return 0xffc14d;
    if (modeId === "bossRush") return 0xff6b6b;
    if (modeId === "blitz60") return 0xa78bfa;
    return 0x4ade80;
  }

  private spriteLayer(
    label: string,
    assetUrl: string,
    x: number,
    y: number,
    scale: number,
    options: { alpha?: number; rotation?: number; tint?: number } = {},
  ): Sprite {
    const sprite = new Sprite(textureFromAsset(assetUrl) ?? Texture.EMPTY);
    sprite.label = label;
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    sprite.scale.set(scale);
    sprite.alpha = options.alpha ?? 1;
    sprite.rotation = options.rotation ?? 0;
    if (options.tint != null) sprite.tint = options.tint;
    return sprite;
  }

  private homeVisualLayerLabel(): string {
    return "home-visual-layer";
  }

  private resultVisualLayerLabel(): string {
    return "result-visual-layer";
  }

  private countLabeledChildren(label: string): number {
    const layer = this.container.getChildByLabel(label, true) as Container | null;
    return layer?.children.length ?? 0;
  }

  private setLayerFloat(label: string, y: number): void {
    const layer = this.container.getChildByLabel(label, true) as Container | null;
    if (layer) layer.y = y;
  }

  private rotateLabeledSprite(label: string, deltaRad: number): void {
    const sprite = this.container.getChildByLabel(label, true) as Sprite | null;
    if (sprite) sprite.rotation += deltaRad;
  }
}
