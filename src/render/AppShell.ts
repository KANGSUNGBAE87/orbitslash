import { Container, Graphics, Sprite, Text, Texture, type TextStyle, type TextStyleOptions } from "pixi.js";
import { BASE_HEIGHT, BASE_WIDTH } from "../game/coords";
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
import { getLocale, setLocale, t, type Locale } from "../i18n";
import type { PublicLeaderboardRow } from "../platform/BackendAdapter";
import { resolveLeaderboardBoundary, type LeaderboardBoundaryState } from "../platform/LeaderboardBoundary";
import { earthAssetUrl } from "./EarthVisual";
import { enemyAssetUrl } from "./EnemyVisual";
import { textureFromAsset } from "./TextureAssets";

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

type ResultAction = "retry" | "modeSelect" | "home";
type QaAction = DevQaScenarioId;

export interface AppShellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AppShellLayoutMetrics {
  homeButtons: Record<"start" | "collection" | "settings", AppShellRect>;
  modeCards: Array<{ modeId: ModeId; rect: AppShellRect }>;
  bottomNav: AppShellRect;
}

export interface AppShellModeDetailOptions {
  adReviveReadiness?: AdReviveReadiness;
}

export const APP_SHELL_SAFE_AREA = {
  top: 96,
  right: 32,
  bottom: 96,
  left: 32,
} as const;

export function appShellLayoutMetrics(): AppShellLayoutMetrics {
  return {
    homeButtons: {
      start: { x: 180, y: 920, w: 720, h: 112 },
      collection: { x: 160, y: 1698, w: 330, h: 76 },
      settings: { x: BASE_WIDTH - 490, y: 1698, w: 330, h: 76 },
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
  onHome: (() => void) | null = null;
  onRetry: (() => void) | null = null;

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
  private readonly qaResultLabels = new Map<DevQaScenarioId, Text>();
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
    if (import.meta.env.DEV) this.buildQa();
    this.container.addChild(this.boot, this.loading, this.home, this.modeSelect, this.modeDetail, this.result, this.records, this.settings, this.collection, this.qa);
    this.showBoot();
  }

  showBoot(): void {
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

  showHome(): void {
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
    this.lastProgress = progress;
    this.adReviveReadiness = options.adReviveReadiness;
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

  showRecords(progress?: ProgressSnapshot, leaderboardStatus: LeaderboardBoundaryState = resolveLeaderboardBoundary(), leaderboardRows: PublicLeaderboardRow[] = []): void {
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

  showSettings(): void {
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

  showResult(result: ModeResult, options: { runSource?: AppRunSource } = {}): void {
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
    const title = this.result.getChildByLabel("result-title") as Text | null;
    if (title) title.text = t(this.resultTitleKey(result));
    const body = this.result.getChildByLabel("result-body") as Text | null;
    if (body) {
      const sec = Math.floor(result.survivalMs / 1000);
      const qaLabel = import.meta.env.DEV && options.runSource === "devQa" ? `\n${t("result.qaProgressOff")}` : "";
      const extra = this.resultExtraLines(result);
      body.text = `${t("result.score")}: ${this.formatNumber(Math.floor(result.score))}\n${t("result.time")}: ${sec}${t("unit.secondsSuffix")}\n${t("hud.combo")}: x${result.maxCombo}\n${t("hud.energy")}: ${this.formatNumber(Math.floor(result.remainingEnergy))}${extra}${qaLabel}`;
    }
  }

  hide(): void {
    this.container.visible = false;
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

  triggerSettingsAction(action: `locale:${Locale}` | "back"): void {
    if (action === "back") {
      this.showHome();
      return;
    }
    const [, locale] = action.split(":") as ["locale", Locale];
    setLocale(locale);
    this.rebuildLocalizedStaticScreens();
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
    this.home.removeChildren();
    this.home.addChild(this.backdrop(0.84));
    this.home.addChild(this.homeVisualLayer());
    const layout = appShellLayoutMetrics();
    const title = new Text({ text: t("app.title"), style: textStyle({ fontSize: 86, fontWeight: "bold", fill: 0xf8fafc }) });
    title.anchor.set(0.5);
    title.position.set(BASE_WIDTH / 2, 540);

    const startRect = layout.homeButtons.start;
    const collectionRect = layout.homeButtons.collection;
    const settingsRect = layout.homeButtons.settings;
    const start = this.button(startRect.x, startRect.y, startRect.w, startRect.h, t("home.start"), 0x3fd8ff, () => {
      this.onStartRun?.("freeDefense");
    });
    const collection = this.button(collectionRect.x, collectionRect.y, collectionRect.w, collectionRect.h, t("home.collection"), 0x94a3b8, () => this.onOpenCollection?.());
    const settings = this.button(settingsRect.x, settingsRect.y, settingsRect.w, settingsRect.h, t("home.settings"), 0x94a3b8, () => {
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

    this.home.addChild(title, start, collection, settings);
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

    const status = new Text({
      text: summary.comingSoon ? t("status.comingSoon") : summary.unlocked ? summary.progressLabel : t("status.locked"),
      style: textStyle({ fontSize: 38, fontWeight: "bold", fill: summary.unlocked ? 0x7dd3fc : 0xffc14d }),
    });
    status.anchor.set(0.5);
    status.position.set(BASE_WIDTH / 2, 620);

    const bodyFontSize = mode.id === "story" ? 30 : 34;
    const body = new Text({
      text: this.modeDetailBody(mode.id, summary),
      style: textStyle({ fontSize: bodyFontSize, lineHeight: bodyFontSize + 8, fill: 0xcbd5e1, wordWrap: true, wordWrapWidth: BASE_WIDTH - 180 }),
    });
    body.anchor.set(0.5, 0);
    body.position.set(BASE_WIDTH / 2, 700);

    const startEnabled = summary.unlocked && !(mode.id === "freeDefense" && this.freeDefenseStandardLocked());
    const startColor = startEnabled ? this.modeAccent(mode.id) : 0x64748b;
    const controls = this.modeDetailControls(mode.id);
    const startY = mode.id === "freeDefense" ? 1288 : mode.id === "story" ? 1220 : 1000;
    const bottomY = mode.id === "freeDefense" ? 1408 : mode.id === "story" ? 1340 : 1120;
    const startLabel = startEnabled ? t("start.button") : mode.id === "freeDefense" && summary.unlocked ? t("freeDefense.dailyLimit.locked") : t("status.locked");
    const start = this.button(BASE_WIDTH / 2 - 190, startY, 380, 92, startLabel, startColor, () => {
      if (!startEnabled) return;
      if (mode.id === "freeDefense") this.onStartRun?.(mode.id, this.freeDefenseLaunchOptions());
      else if (mode.id === "story") this.onStartRun?.(mode.id, { storyStageId: this.selectedStoryStageId });
      else if (mode.id === "ranked") this.onStartRun?.(mode.id, { difficulty: this.selectedDifficultyByMode.ranked });
      else this.onStartRun?.(mode.id);
    });
    start.label = startEnabled ? "mode-detail-start-enabled" : "mode-detail-start-locked";

    const records = this.button(BASE_WIDTH / 2 - 190, bottomY, 180, 76, t("records.title"), 0x94a3b8, () => this.onOpenRecords?.());
    const back = this.button(BASE_WIDTH / 2 + 10, bottomY, 180, 76, t("result.modeSelect"), 0x64748b, () => this.onOpenModeSelect?.());

    this.modeDetail.addChild(title, visual, status, body, controls, start, records, back);
  }

  private buildResult(): void {
    this.result.removeChildren();
    this.result.addChild(this.backdrop(0.82));
    this.result.addChild(this.resultVisualLayer());
    const panel = new Graphics();
    panel.roundRect(130, 520, BASE_WIDTH - 260, 720, 22).fill({ color: 0x0c1730, alpha: 0.96 });
    panel.roundRect(130, 520, BASE_WIDTH - 260, 720, 22).stroke({ width: 3, color: 0xff5a5a, alpha: 0.72 });

    const title = new Text({ text: t("result.gameOver"), style: textStyle({ fontSize: 70, fontWeight: "bold", fill: 0xff6b6b }) });
    title.label = "result-title";
    title.anchor.set(0.5);
    title.position.set(BASE_WIDTH / 2, 650);

    const body = new Text({ text: "", style: textStyle({ fontSize: 42, fill: 0xf8fafc }) });
    body.label = "result-body";
    body.anchor.set(0.5);
    body.position.set(BASE_WIDTH / 2, 835);

    const retry = this.button(210, 1050, 190, 82, t("result.retry"), 0x3fd8ff, () => this.triggerResultAction("retry"));
    const mode = this.button(445, 1050, 190, 82, t("result.modeSelect"), 0xffc14d, () => this.triggerResultAction("modeSelect"));
    const home = this.button(680, 1050, 190, 82, t("result.home"), 0x94a3b8, () => this.triggerResultAction("home"));

    this.result.addChild(panel, title, body, retry, mode, home);
  }

  private resultExtraLines(result: ModeResult): string {
    const lines: string[] = [];
    if (result.bossKills != null || result.defeatedBossIds?.length) {
      lines.push(`${t("result.bossKills")}: ${this.formatNumber(result.bossKills ?? 0)}`);
      if (result.modeId === "bossRush") lines.push(`${t("mode.bossRush.title")}: ${this.formatNumber(result.bossKills ?? 0)}/${BOSS_IDS.length}`);
      if (result.defeatedBossIds?.length) lines.push(`${t("result.defeated")}: ${result.defeatedBossIds.map((id) => this.bossLabel(id)).join(", ")}`);
    }
    if (result.objectiveOutcome) lines.push(`${t("result.objective")}: ${t(`result.objective.${result.objectiveOutcome}`)}`);
    if (result.activeStoryStageId) lines.push(`${t("mode.story.title")}: ${this.storyStageLabel(result.activeStoryStageId)}`);
    if (result.activeDailyModifierId) lines.push(`${t("mode.daily.title")}: ${this.dailyModifierLabel(result.activeDailyModifierId)}`);
    if (result.rankingSubmissionState) lines.push(`${t("result.ranking")}: ${t(`ranking.state.${result.rankingSubmissionState}`)}`);
    return lines.length > 0 ? `\n${lines.join("\n")}` : "";
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
    this.settings.addChild(this.backdrop(0.9));
    const title = new Text({ text: t("home.settings"), style: textStyle({ fontSize: 66, fontWeight: "bold", fill: 0xf8fafc }) });
    title.anchor.set(0.5);
    title.position.set(BASE_WIDTH / 2, 210);

    const language = new Text({ text: t("settings.language"), style: textStyle({ fontSize: 42, fontWeight: "bold", fill: 0x7dd3fc }) });
    language.anchor.set(0.5);
    language.position.set(BASE_WIDTH / 2, 420);

    const ko = this.button(220, 520, 280, 86, t("settings.locale.ko"), getLocale() === "ko" ? 0x3fd8ff : 0x64748b, () => this.triggerSettingsAction("locale:ko"));
    const en = this.button(580, 520, 280, 86, t("settings.locale.en"), getLocale() === "en" ? 0x3fd8ff : 0x64748b, () => this.triggerSettingsAction("locale:en"));
    const home = this.button(64, BASE_HEIGHT - 180, 230, 78, t("result.home"), 0x64748b, () => this.triggerSettingsAction("back"));

    this.settings.addChild(title, language, ko, en, home);
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
    const titleLines = ["bossBreaker", "dailyClear", "blitzSurvivor", "comboPilot"].map(
      (id) => `${titleCodex.has(id) ? t("collection.unlocked") : t("collection.locked")} ${t(`collection.title.${id}`)}`,
    );

    const body = new Text({
      text: `${t("collection.bosses")}\n${bossLines.join("\n")}\n\n${t("collection.modes")}\n${modeLines.join("\n")}\n\n${t("collection.specialObjects")}\n${specialLines.join("\n")}\n\n${t("collection.titles")}\n${titleLines.join("\n")}`,
      style: textStyle({ fontSize: 28, fill: 0xcbd5e1, wordWrap: true, wordWrapWidth: BASE_WIDTH - 180 }),
    });
    body.anchor.set(0.5, 0);
    body.position.set(BASE_WIDTH / 2, 320);

    this.collection.addChild(title, body, this.button(64, BASE_HEIGHT - 180, 230, 78, t("result.home"), 0x64748b, () => this.onHome?.()));
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
    return g;
  }

  private modeCard(x: number, y: number, w: number, h: number, modeId: ModeId, title: string, description: string, summary: ModeProgressSummary): Container {
    const card = new Container();
    card.eventMode = "static";
    card.cursor = "pointer";
    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 18).fill({ color: 0x0b1224, alpha: 0.94 });
    bg.roundRect(0, 0, w, h, 18).stroke({ width: 3, color: 0x3fd8ff, alpha: 0.42 });

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
        base,
        t("freeDefense.detail.survival"),
        this.freeDefenseDailyLimitText(),
        ...(this.freeDefenseStandardLocked() ? [t("freeDefense.dailyLimit.locked")] : []),
        this.freeDefenseAdReviveText(),
        this.selectedFreeDefensePreset === "standard"
          ? t("freeDefense.detail.standardRecord")
          : t("freeDefense.detail.practiceRecordOff"),
      ].join("\n");
    }
    return base;
  }

  private modeDetailControls(modeId: ModeId): Container {
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

    const difficultyLabel = new Text({ text: t("modeDetail.difficulty"), style: textStyle({ fontSize: 30, fontWeight: "bold", fill: 0x7dd3fc }) });
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
      const selected = this.selectedDifficultyByMode.freeDefense === difficulty.id;
      const btn = this.button(
        92 + index * 224,
        880,
        190,
        62,
        t(difficulty.labelKey),
        selected ? 0x3fd8ff : 0x64748b,
        () => this.triggerModeDetailChoice(`difficulty:${difficulty.id}`),
      );
      controls.addChild(btn);
    });

    const practiceLabel = new Text({ text: t("freeDefense.practice"), style: textStyle({ fontSize: 30, fontWeight: "bold", fill: 0xffc14d }) });
    practiceLabel.anchor.set(0.5);
    practiceLabel.position.set(BASE_WIDTH / 2, 974);
    controls.addChild(practiceLabel);

    freeDefensePresetDefinitions().forEach((preset, index) => {
      const selected = this.selectedFreeDefensePreset === preset.id;
      const btn = this.button(
        126 + index * 278,
        1008,
        238,
        62,
        t(preset.labelKey),
        selected ? 0xffc14d : 0x64748b,
        () => this.triggerModeDetailChoice(`freeDefensePreset:${preset.id}`),
      );
      controls.addChild(btn);
    });

    const bossLabel = new Text({ text: t("freeDefense.practiceBoss"), style: textStyle({ fontSize: 28, fontWeight: "bold", fill: 0xff9f6e }) });
    bossLabel.anchor.set(0.5);
    bossLabel.position.set(BASE_WIDTH / 2, 1092);
    controls.addChild(bossLabel);

    BOSS_IDS.forEach((bossId, index) => {
      const selected = this.selectedPracticeBossId === bossId;
      const col = index % 3;
      const row = Math.floor(index / 3);
      const btn = this.button(
        96 + col * 298 + (row === 1 ? 150 : 0),
        1124 + row * 70,
        258,
        54,
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

  private button(x: number, y: number, w: number, h: number, label: string, color: number, onTap: () => void): Container {
    const btn = new Container();
    btn.eventMode = "static";
    btn.cursor = "pointer";
    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 18).fill({ color, alpha: 0.18 });
    bg.roundRect(0, 0, w, h, 18).stroke({ width: 3, color, alpha: 0.8 });
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
    halo.circle(BASE_WIDTH / 2, 240, 220).fill({ color: 0x1d4ed8, alpha: 0.22 });
    halo.circle(BASE_WIDTH / 2 + 220, 250, 150).fill({ color: 0xff5a5a, alpha: 0.12 });
    halo.circle(BASE_WIDTH / 2 - 250, 430, 145).fill({ color: 0xffa94d, alpha: 0.08 });

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

    layer.addChild(halo, earthShield, earthCore, boss, meteor);
    return layer;
  }

  private resultVisualLayer(): Container {
    const layer = new Container();
    layer.label = this.resultVisualLayerLabel();

    const glow = new Graphics();
    glow.circle(BASE_WIDTH / 2, 390, 260).fill({ color: 0xff5a5a, alpha: 0.11 });
    glow.circle(BASE_WIDTH / 2 - 210, 470, 180).fill({ color: 0xffc14d, alpha: 0.07 });

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
    slash.moveTo(168, 250).lineTo(408, 512).stroke({ width: 12, color: 0xff6b6b, alpha: 0.16 });
    slash.moveTo(BASE_WIDTH - 168, 280).lineTo(BASE_WIDTH - 380, 544).stroke({ width: 9, color: 0xffc14d, alpha: 0.14 });

    layer.addChild(glow, backdrop, debrisA, debrisB, slash);
    return layer;
  }

  private modeCardVisual(modeId: ModeId, w: number, h: number): Container {
    const layer = new Container();
    layer.label = `mode-visual-${modeId}`;
    layer.position.set(w - 68, h / 2 + 8);

    const halo = new Graphics();
    const accent = this.modeAccent(modeId);
    halo.circle(0, 0, 48).fill({ color: accent, alpha: 0.14 });

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

    const sprite = this.spriteLayer(`mode-sprite-${modeId}`, assetByMode[modeId], 0, 0, modeId === "bossRush" ? 0.3 : 0.28, {
      alpha: 0.88,
      rotation: rotationByMode[modeId],
      tint: modeId === "ranked" ? 0xffd36b : undefined,
    });

    layer.addChild(halo, sprite);
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
