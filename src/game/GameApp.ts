import { Application, Container } from "pixi.js";
import { computeRootFit, type SafeAreaInsets } from "./coords";
import { GameScene } from "./GameScene";
import { appStateReducer, initialAppState, type AppRunSource, type AppState } from "./AppState";
import { buildRunConfig, type ModeId, type ModeResult, type RunConfig, type RunLaunchOptions } from "./ModeConfig";
import {
  createDefaultDevQaResults,
  parseDevQaResults,
  readDevModeParam,
  readDevStringParam,
  type DevQaLaunchPreset,
  type DevQaResults,
  type DevQaScenarioId,
} from "./DevQa";
import { BOSS_IDS, type BossId } from "./BossDefinitions";
import { canStartFreeDefenseRun, ProgressStore, type ProgressSnapshot } from "./ProgressStore";
import { AppShell, type SettingsAccountErrorReason, type SettingsAccountState, type SettingsShareState } from "../render/AppShell";
import { createLocalRunStart, currentPublicLeaderboardQuery, validatePublicRankedStart, type BackendAdapter, type RankedRunStart } from "../platform/BackendAdapter";
import { createDefaultBackendAdapter, type BackendEnv } from "../platform/BackendAdapterFactory";
import { resolveLeaderboardBoundary } from "../platform/LeaderboardBoundary";
import type { IPlatformAdapter } from "../platform/PlatformAdapter";
import { createDefaultPlatformAdapter } from "../platform/PlatformAdapterFactory";
import type { AdReviveReadiness } from "./RevivePolicy";
import { evaluatePlayerUnlocks, resolveModeAvailability, type ModeAvailability } from "./progression/UnlockPolicy";
import { reduceFirstSession } from "./onboarding/FirstSessionState";
import { resolveHomePrimaryAction } from "./onboarding/HomeFlowPolicy";
import type { TutorialStep } from "./onboarding/TutorialFlow";
import { ProductTelemetryQueue, type ProductEventName } from "../platform/ProductTelemetry";
import { getLocale, setLocale, t } from "../i18n";
import { defaultPlayerPreferences, PlayerPreferencesStore, type PlayerPreferences } from "./PlayerPreferencesStore";
import { FeedbackController } from "../feedback/FeedbackController";
import { WebAudioEngine } from "../feedback/WebAudioEngine";
import { AppLifecycle } from "../platform/AppLifecycle";
import { IdentityService } from "../platform/identity/IdentityService";
import { CloudProgressRepository, type CloudProgressSyncPort } from "../platform/progress/CloudProgressRepository";
import { LocalProgressRepository } from "../platform/progress/LocalProgressRepository";
import { ProgressMutationOutbox } from "../platform/progress/ProgressMutationQueue";
import { SupabaseProgressSyncPort } from "../platform/progress/SupabaseProgressSyncPort";
import { kstDayKey } from "./retention/WeeklyGoalRules";
import { preloadRunVisualAssets } from "../render/AppVisualAssets";
import type { ShareService } from "../platform/share/ShareService";
import { createDefaultShareService } from "../platform/share/createDefaultShareService";

// 앱 수명주기 (implementation-plan §1 [P1], §4.1). PixiJS init, RAF 루프 소유,
// 1080x1920 반응형 캔버스 + scale = min(sw/1080, sh/1920).
// AppState drives home/detail/gameplay/result/settings/collection flow.

const MAX_DT_MS = 50; // dt 클램프 — 탭 백그라운드 점프 방지 (§4.1)
const DEV_QA_RESULTS_STORAGE_KEY = "orbitslash.devQaResults.v1";
const NO_SAFE_AREA: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const PROGRESS_OUTBOX_STORAGE_KEY = "orbitslash.progress-sync-outbox.v1";
const LAST_OPEN_DAY_STORAGE_KEY = "orbitslash.last-open-day.v1";

export function devQaLaunchOptionsFromSearch(modeId: ModeId, search: string): RunLaunchOptions | undefined {
  const qaPreset = readDevStringParam(search, "qaPreset", ["boss", "blockedBody"] as const);
  if (modeId !== "freeDefense" || !qaPreset) return undefined;
  return {
    freeDefensePreset: "bossPractice",
    practiceBossId: readDevStringParam(search, "qaBoss", BOSS_IDS) ?? ("ringed_destroyer" as BossId),
  };
}

export function shouldRecordProgressForRun(source: AppRunSource): boolean {
  return source === "play";
}

export function shouldAllowRunStart(modeId: ModeId, source: AppRunSource, progress: ProgressSnapshot): boolean {
  if (source === "play" && !evaluatePlayerUnlocks(progress).modes.includes(modeId)) return false;
  if (modeId === "freeDefense" && source === "play") return canStartFreeDefenseRun(progress);
  return true;
}

export async function resolveAdReviveReadiness(
  platform: Pick<IPlatformAdapter, "rewardedAdCapability">,
  backend: Pick<BackendAdapter, "rewardedAdTelemetryStatus">,
): Promise<AdReviveReadiness> {
  const [capability, telemetryStatus] = await Promise.all([
    platform.rewardedAdCapability().catch(() => null),
    backend.rewardedAdTelemetryStatus().catch(() => null),
  ]);
  return {
    adsAdapterReady: Boolean(capability),
    platformSupportsRewardedAd: capability?.supported === true,
    rewardedTelemetryReady: telemetryStatus?.ready === true,
  };
}

export function publicShareUrlFromHref(href: string | undefined): string {
  if (!href) return "";
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

type GameAudioCapability = Pick<
  WebAudioEngine,
  "attemptAutoplay" | "pause" | "play" | "setBgmEnabled" | "unlockFromUserGesture"
>;

type GameShareCapability = Pick<ShareService, "share">;

interface GameAppOptions {
  platform?: IPlatformAdapter;
  backend?: BackendAdapter;
  backendEnv?: BackendEnv;
  progressCloud?: CloudProgressSyncPort;
  audio?: GameAudioCapability;
  shareService?: GameShareCapability;
}

export class GameApp {
  private app: Application;
  private root: Container; // 스케일 컨테이너 (내부 좌표계 1080x1920)
  private scene: GameScene | null = null;
  private shell: AppShell;
  private state: AppState;
  private platform: IPlatformAdapter;
  private readonly identity: IdentityService;
  private rankingBackend: BackendAdapter;
  private progress: ProgressStore;
  private readonly localProgressRepository: LocalProgressRepository;
  private readonly progressOutbox = new ProgressMutationOutbox();
  private readonly cloudProgress?: CloudProgressRepository;
  private progressSnapshot: ProgressSnapshot | null = null;
  private preferences: PlayerPreferences = defaultPlayerPreferences();
  private preferenceStore: PlayerPreferencesStore;
  private preferencesRevision = 0;
  private preferencesSaveQueue: Promise<void> = Promise.resolve();
  private readonly audio: GameAudioCapability;
  private readonly shareService: GameShareCapability;
  private settingsAccountErrorReason: Exclude<SettingsAccountErrorReason, "cancelled"> | null = null;
  private settingsShareState: SettingsShareState = "idle";
  private feedback: FeedbackController;
  private readonly lifecycle = new AppLifecycle();
  private platformLifecycleUnsubscribe: (() => Promise<void>) | null = null;
  private initPromise: Promise<void> | null = null;
  private disposePromise: Promise<void> | null = null;
  private disposeRequested = false;
  private disposed = false;
  private appInitialized = false;
  private canvasMounted = false;
  private browserWindow: Window | null = null;
  private browserDocument: Document | null = null;
  private tickerAttached = false;
  private firstGestureUnlockInstalled = false;
  private qaResults: DevQaResults = createDefaultDevQaResults();
  private productTelemetry = new ProductTelemetryQueue(`local-${Math.random().toString(36).slice(2)}`);
  private lastTime = 0;
  private safeAreaInsets: SafeAreaInsets = NO_SAFE_AREA;

  constructor(options: GameAppOptions = {}) {
    this.app = new Application();
    this.root = new Container();
    this.shell = new AppShell();
    this.state = initialAppState();
    this.platform = options.platform ?? createDefaultPlatformAdapter();
    this.identity = new IdentityService(this.platform);
    this.audio = options.audio ?? new WebAudioEngine();
    this.shareService = options.shareService ?? createDefaultShareService();
    const backendEnv = options.backendEnv ?? import.meta.env;
    this.rankingBackend = options.backend ?? createDefaultBackendAdapter(backendEnv, {
      accessTokenProvider: () => this.identity.getVerifiedSessionAccessToken(),
    });
    this.progress = new ProgressStore(this.platform);
    this.localProgressRepository = new LocalProgressRepository(this.progress);
    const progressCloud = options.progressCloud ?? createProgressSyncPort(backendEnv, () => this.identity.getVerifiedSessionAccessToken());
    if (progressCloud) {
      this.cloudProgress = new CloudProgressRepository(
        this.localProgressRepository,
        this.progressOutbox,
        async () => this.identity.getState(),
        progressCloud,
      );
    }
    this.preferenceStore = new PlayerPreferencesStore(this.platform);
    this.feedback = new FeedbackController(
      () => this.preferences,
      { haptic: (kind) => this.platform.haptic(kind), play: (cue) => this.audio.play(cue) },
    );
    this.shell.onStartRun = (modeId, options) => {
      const source = modeId === "freeDefense" && options?.freeDefensePreset && options.freeDefensePreset !== "standard" ? "practice" : "play";
      void this.startRun(modeId, source, options);
    };
    this.shell.onHomePrimaryStart = () => {
      void this.startHomePrimary();
    };
    this.shell.onStartQaRun = (modeId, preset) => this.startQaRun(modeId, preset);
    this.shell.onToggleQaResult = (scenarioId) => this.toggleQaResult(scenarioId);
    this.shell.onOpenModeSelect = () => {
      void this.openModeSelect();
    };
    this.shell.onOpenModeDetail = (modeId) => {
      void this.openModeDetail(modeId);
    };
    this.shell.onOpenRecords = () => {
      void this.openRecords();
    };
    this.shell.onOpenSettings = () => void this.openSettings();
    this.shell.onPreferencesChange = (patch) => void this.updatePreferences(patch);
    this.shell.onSettingsLogin = () => void this.handleSettingsLogin();
    this.shell.onSettingsShare = () => void this.handleSettingsShare();
    this.shell.onResumeGame = () => this.resumePausedRun();
    this.shell.onOpenCollection = () => {
      this.clearScene();
      this.state = appStateReducer(this.state, { type: "OPEN_COLLECTION" });
      this.trackProductEvent("collection_open", { source: "navigation" });
      void this.openCollection();
    };
    this.shell.onClaimWeeklyReward = () => {
      void this.claimWeeklyReward();
    };
    this.shell.onHome = () => {
      this.clearScene();
      this.state = appStateReducer(this.state, { type: "OPEN_HOME" });
      this.shell.showHome(this.progressSnapshot ?? undefined);
    };
    this.shell.onRetry = () => {
      this.trackProductEvent("retry_selected", { modeId: this.state.runConfig.modeId });
      void this.retryRun();
    };
  }

  init(mount: HTMLElement, beforeReady?: () => Promise<void>): Promise<void> {
    if (this.disposeRequested || this.disposed) return this.disposePromise ?? Promise.resolve();
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initialize(mount, beforeReady);
    return this.initPromise;
  }

  private async initialize(mount: HTMLElement, beforeReady?: () => Promise<void>): Promise<void> {
    this.state = appStateReducer(this.state, { type: "APP_LOADING" });
    this.shell.showLoading();
    await this.app.init({
      background: 0x05060f,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      resizeTo: window,
    });
    this.appInitialized = true;
    if (this.disposeRequested) return;
    mount.appendChild(this.app.canvas);
    this.canvasMounted = true;

    this.root.addChild(this.shell.container);
    this.app.stage.addChild(this.root);

    await beforeReady?.();
    if (this.disposeRequested) return;
    this.loadQaResults();
    await this.loadPreferences();
    if (this.disposeRequested) return;
    this.attemptAutoplaySafely();
    this.browserWindow = window;
    this.browserDocument = document;
    this.installFirstGestureAudioUnlock();
    await this.loadProgressSnapshot();
    if (this.disposeRequested) return;
    await this.restoreProgressOutbox();
    if (this.disposeRequested) return;
    this.trackProductEvent("app_open", { locale: getLocale(), runtime: this.platform.telemetryContext().runtime });
    await this.trackReturnVisit();
    if (this.disposeRequested) return;
    this.resize();
    this.browserWindow.addEventListener("resize", this.handleWindowResize);
    this.browserDocument.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.browserWindow.addEventListener("pagehide", this.handlePageHide);
    this.browserWindow.addEventListener("pageshow", this.handlePageShow);
    await this.bindPlatformLifecycle();
    if (this.disposeRequested) return;
    if (!this.startDevQaModeFromSearch()) {
      this.state = appStateReducer(this.state, { type: "APP_READY" });
      void this.loadProgressSnapshot().then((progress) => {
        if (this.disposeRequested) return;
        this.shell.showHome(progress);
      });
      this.trackProductEvent("home_view", { locale: getLocale() });
    }

    this.lastTime = performance.now();
    this.app.ticker.add(this.handleTickerUpdate);
    this.tickerAttached = true;
  }

  public dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise;
    this.disposeRequested = true;
    this.disposePromise = this.performDispose();
    return this.disposePromise;
  }

  private async performDispose(): Promise<void> {
    await this.initPromise?.catch(() => undefined);
    this.removeFirstGestureAudioUnlock();
    this.browserWindow?.removeEventListener("resize", this.handleWindowResize);
    this.browserDocument?.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.browserWindow?.removeEventListener("pagehide", this.handlePageHide);
    this.browserWindow?.removeEventListener("pageshow", this.handlePageShow);
    this.browserWindow = null;
    this.browserDocument = null;

    if (this.tickerAttached) {
      this.app.ticker.remove(this.handleTickerUpdate);
      this.tickerAttached = false;
    }

    const unsubscribe = this.platformLifecycleUnsubscribe;
    this.platformLifecycleUnsubscribe = null;
    if (unsubscribe) await unsubscribe().catch(() => undefined);

    this.audio.pause();
    this.clearScene();
    if (this.appInitialized && this.canvasMounted) {
      this.app.canvas.remove();
      this.canvasMounted = false;
    }
    this.disposed = true;
  }

  private startDevQaModeFromSearch(): boolean {
    if (!import.meta.env.DEV || typeof window === "undefined") return false;
    const modeId = readDevModeParam(window.location.search, "qaMode");
    if (!modeId) return false;
    void this.startRun(modeId, "devQa", devQaLaunchOptionsFromSearch(modeId, window.location.search));
    return true;
  }

  private startQaRun(modeId: ModeId, preset: DevQaLaunchPreset): void {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("qaMode", modeId);
    url.searchParams.set("qaPreset", preset);
    url.searchParams.set("qaGauge", "100");
    if (!url.searchParams.has("seed")) url.searchParams.set("seed", "1234");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    void this.startRun(modeId, "devQa");
  }

  private loadQaResults(): void {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    this.qaResults = parseDevQaResults(window.localStorage.getItem(DEV_QA_RESULTS_STORAGE_KEY));
    this.shell.updateQaResults(this.qaResults);
  }

  private toggleQaResult(scenarioId: DevQaScenarioId): void {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    this.qaResults = { ...this.qaResults, [scenarioId]: !this.qaResults[scenarioId] };
    window.localStorage.setItem(DEV_QA_RESULTS_STORAGE_KEY, JSON.stringify(this.qaResults));
    this.shell.updateQaResults(this.qaResults);
  }

  private async loadProgressSnapshot(): Promise<ProgressSnapshot> {
    this.progressSnapshot = await this.progress.load();
    return this.progressSnapshot;
  }

  private trackProductEvent(eventName: ProductEventName, props: Record<string, unknown>): void {
    this.productTelemetry.track(eventName, props);
    void this.productTelemetry.flush(async (event) => {
      const result = await this.rankingBackend.recordProductEvent(event, this.platform.telemetryContext());
      if (!result.accepted) throw new Error(result.reason ?? "product_telemetry_not_accepted");
    });
  }

  private async trackReturnVisit(): Promise<void> {
    const today = kstDayKey(new Date());
    const previous = await this.platform.storageGet(LAST_OPEN_DAY_STORAGE_KEY).catch(() => null);
    await this.platform.storageSet(LAST_OPEN_DAY_STORAGE_KEY, today).catch(() => undefined);
    if (previous && previous !== today) this.trackProductEvent("return_next_day", { dayKey: today });
  }

  private async loadPreferences(): Promise<PlayerPreferences> {
    this.preferences = await this.preferenceStore.load();
    setLocale(this.preferences.locale);
    this.audio.setBgmEnabled(this.preferences.bgmEnabled);
    return this.preferences;
  }

  private async openSettings(): Promise<void> {
    this.clearScene();
    this.state = appStateReducer(this.state, { type: "OPEN_SETTINGS" });
    this.renderSettings();
  }

  private updatePreferences(patch: Partial<Omit<PlayerPreferences, "version">>): Promise<void> {
    this.preferences = { ...this.preferences, ...patch };
    const snapshot = this.preferences;
    const revision = ++this.preferencesRevision;
    if (patch.locale) setLocale(patch.locale);
    if (patch.bgmEnabled != null) this.audio.setBgmEnabled(this.preferences.bgmEnabled);
    if (patch.reducedMotion != null) this.scene?.setReducedMotion(this.preferences.reducedMotion);
    this.renderSettingsIfActive();

    const persist = this.preferencesSaveQueue.then(async () => {
      const saved = await this.preferenceStore.save(snapshot);
      if (revision === this.preferencesRevision) this.preferences = saved;
    }).catch(() => undefined);
    this.preferencesSaveQueue = persist;
    return persist;
  }

  private async handleSettingsLogin(): Promise<void> {
    const current = this.identity.getState();
    if (current.status === "loading" || current.status === "linked") return;
    this.settingsAccountErrorReason = null;
    const signIn = this.identity.signIn();
    this.renderSettingsIfActive();

    try {
      const identity = await signIn;
      this.settingsAccountErrorReason = identity.status === "anonymous"
        ? "unavailable"
        : identity.status === "error"
          ? "failed"
          : null;
    } catch {
      this.settingsAccountErrorReason = "failed";
    }
    this.renderSettingsIfActive();
  }

  private get settingsAccountState(): SettingsAccountState {
    const identity = this.identity.getState();
    if (identity.status === "linked") return { status: "linked", provider: identity.provider };
    if (identity.status === "loading") return { status: "loading" };
    if (this.settingsAccountErrorReason) return { status: "error", reason: this.settingsAccountErrorReason };
    if (identity.status === "error") return { status: "error", reason: "failed" };
    return { status: "anonymous" };
  }

  private async handleSettingsShare(): Promise<void> {
    if (this.settingsShareState === "sharing") return;
    this.settingsShareState = "sharing";
    this.renderSettingsIfActive();

    try {
      const title = t("app.title");
      const href = typeof window === "undefined" ? undefined : window.location?.href;
      const result = await this.shareService.share({
        message: title,
        title,
        webUrl: publicShareUrlFromHref(href),
      });
      this.settingsShareState = result.status === "shared" ? "success" : result.status === "cancelled" ? "idle" : "error";
    } catch {
      this.settingsShareState = "error";
    }
    this.renderSettingsIfActive();
  }

  private renderSettings(): void {
    this.shell.showSettings(this.preferences, {
      account: this.settingsAccountState,
      share: this.settingsShareState,
    });
  }

  private renderSettingsIfActive(): void {
    if (this.state.screen === "settings") this.renderSettings();
  }

  private async openModeSelect(): Promise<void> {
    this.state = appStateReducer(this.state, { type: "OPEN_MODE_SELECT" });
    this.shell.showModeSelect(await this.loadProgressSnapshot());
  }

  private async openModeDetail(modeId?: ModeId): Promise<void> {
    this.state = appStateReducer(this.state, { type: "OPEN_MODE_DETAIL", modeId });
    const selectedModeId = this.state.selectedModeId ?? this.state.runConfig.modeId;
    await this.showModeDetailWithReadiness(selectedModeId, await this.loadProgressSnapshot());
  }

  private async openRecords(): Promise<void> {
    this.state = appStateReducer(this.state, { type: "OPEN_RANKING" });
    const [progress, leaderboard] = await Promise.all([
      this.loadProgressSnapshot(),
      this.rankingBackend.publicLeaderboardRows(currentPublicLeaderboardQuery()).catch(async () => ({
        status: await this.rankingBackend.leaderboardStatus().catch(() => resolveLeaderboardBoundary()),
        rows: [],
      })),
    ]);
    this.shell.showRecords(progress, leaderboard.status, leaderboard.rows);
  }

  private async openCollection(): Promise<void> {
    this.shell.showCollection(await this.loadProgressSnapshot());
  }

  private async claimWeeklyReward(): Promise<void> {
    const outcome = await this.progress.claimWeeklyReward();
    this.progressSnapshot = outcome.snapshot;
    if (outcome.claimed) {
      this.trackProductEvent("weekly_reward_claimed", { weekKey: outcome.weekKey, titleId: outcome.titleId });
      void this.queueProgressSync();
    }
    this.shell.showCollection(outcome.snapshot);
  }

  private async startRun(modeId: ModeId, source: AppRunSource = "play", options: RunLaunchOptions = {}): Promise<void> {
    const progress = await this.loadProgressSnapshot();
    if (!shouldAllowRunStart(modeId, source, progress)) {
      this.state = appStateReducer(this.state, { type: "OPEN_MODE_DETAIL", modeId });
      await this.showModeDetailWithReadiness(modeId, progress);
      return;
    }
    const availability = modeId === "ranked" ? await this.rankedModeAvailability(progress) : undefined;
    const effectiveSource = source === "play" && availability?.startKind === "local_practice" ? "practice" : source;
    this.state = appStateReducer(this.state, {
      type: "START_RUN",
      modeId,
      source: effectiveSource,
      difficulty: options.difficulty,
      freeDefensePreset: options.freeDefensePreset,
      storyStageId: options.storyStageId,
      unlockedSkills: evaluatePlayerUnlocks(progress).skills,
    });
    await this.prepareAndLaunchRun(this.state.runConfig, effectiveSource);
  }

  private async startHomePrimary(): Promise<void> {
    const progress = await this.loadProgressSnapshot();
    const action = resolveHomePrimaryAction(progress.onboarding);
    if (action.kind === "open_recommended_mode") {
      await this.openModeSelect();
      return;
    }
    const started = reduceFirstSession(progress.onboarding, { type: "start" }, new Date().toISOString());
    this.progressSnapshot = await this.progress.saveOnboarding(started);
    this.trackProductEvent("primary_start", { modeId: "story", storyStageId: action.storyStageId });
    this.trackProductEvent("tutorial_step_started", { tutorialStep: started.step });
    await this.startRun("story", "play", { storyStageId: action.storyStageId });
  }

  private async retryRun(): Promise<void> {
    this.state = appStateReducer(this.state, { type: "RETRY_RUN" });
    await this.prepareAndLaunchRun(this.state.runConfig, this.state.runSource);
  }

  private async prepareAndLaunchRun(runConfig: RunConfig, source: AppRunSource): Promise<void> {
    const launch = await this.resolveRunLaunch(runConfig, source);
    this.state = { ...this.state, runConfig: launch.runConfig };
    await preloadRunVisualAssets(launch.runConfig.modeId);
    this.launchRun(launch.runConfig, launch.runStart);
  }

  private async resolveRunLaunch(runConfig: RunConfig, source: AppRunSource): Promise<{ runConfig: RunConfig; runStart?: RankedRunStart }> {
    if (runConfig.modeId !== "ranked" || source === "devQa" || source === "practice") return { runConfig };
    let runStart: RankedRunStart;
    try {
      runStart = await this.rankingBackend.beginRankedRun(runConfig.difficulty);
    } catch {
      runStart = createLocalRunStart(runConfig.difficulty, Date.now() >>> 0, "ranked");
    }
    const publicRanked = validatePublicRankedStart(runStart);
    const nextConfig = publicRanked.ok
      ? buildRunConfig("ranked", {
          difficulty: runStart.difficulty,
          seed: runStart.seed,
          configVersion: runStart.configVersion,
        })
      : buildRunConfig("ranked", {
          difficulty: runConfig.difficulty,
          seed: runStart.seed,
          configVersion: "local",
        });
    return { runConfig: nextConfig, runStart };
  }

  private async showModeDetailWithReadiness(modeId: ModeId, progress: ProgressSnapshot): Promise<void> {
    const adReviveReadiness =
      modeId === "freeDefense" ? await resolveAdReviveReadiness(this.platform, this.rankingBackend) : undefined;
    const availability = modeId === "ranked" ? await this.rankedModeAvailability(progress) : undefined;
    this.shell.showModeDetail(modeId, progress, { adReviveReadiness, availability });
  }

  private async rankedModeAvailability(progress: ProgressSnapshot): Promise<ModeAvailability> {
    const rankedServiceReady = await this.rankingBackend.leaderboardStatus()
      .then((status) => status.publicAvailable)
      .catch(() => false);
    return resolveModeAvailability("ranked", progress, rankedServiceReady);
  }

  private launchRun(runConfig: RunConfig, runStart?: RankedRunStart): void {
    this.lifecycle.resume();
    this.shell.hidePauseOverlay();
    this.clearScene();
    const scene = new GameScene(runConfig, {
      showResultOverlay: false,
      backend: this.rankingBackend,
      runStart,
      platformTelemetryContext: this.platform.telemetryContext(),
      feedback: this.feedback,
      onUserGesture: () => this.audio.unlockFromUserGesture(),
      reducedMotion: this.preferences.reducedMotion,
      guidedTutorialInitialStep: runConfig.modeId === "story"
        ? guidedTutorialStepFor(this.progressSnapshot?.onboarding.step)
        : undefined,
    });
    this.scene = scene;
    scene.onRunEnd = (result) => {
      void this.handleRunEnd(result);
    };
    scene.onRankedSubmissionUpdate = (rankingSubmissionState) => {
      if (this.scene !== scene) return;
      this.updateRankedSubmissionState(rankingSubmissionState);
    };
    scene.onGuidedTutorialStep = (step) => {
      void this.persistGuidedTutorialStep(step);
    };
    this.root.addChildAt(scene.stage, 0);
    this.shell.hide();
  }

  private async handleRunEnd(result: ModeResult): Promise<void> {
    const runSource = this.state.runSource;
    this.state = appStateReducer(this.state, { type: "RUN_ENDED", result });
    const outcome = shouldRecordProgressForRun(runSource) ? await this.progress.recordResult(result) : undefined;
    if (outcome) {
      await this.localProgressRepository.saveLocal(outcome);
      this.progressSnapshot = outcome.snapshot;
      void this.queueProgressSync();
    }
    if (result.activeStoryStageId === "story-1" && result.objectiveOutcome === "cleared" && this.progressSnapshot?.onboarding.step === "reward") {
      this.progressSnapshot = await this.progress.saveOnboarding(
        reduceFirstSession(this.progressSnapshot.onboarding, { type: "reward_claimed" }, new Date().toISOString()),
      );
      this.trackProductEvent("tutorial_step_completed", { tutorialStep: "reward" });
      this.trackProductEvent("tutorial_complete", { locale: getLocale() });
    }
    this.trackProductEvent("run_end", {
      modeId: result.modeId,
      storyStageId: result.activeStoryStageId ?? "",
      tutorialStep: this.progressSnapshot?.onboarding.step ?? "",
    });
    const unlockCount = outcome
      ? outcome.delta.newModes.length + outcome.delta.newSkills.length + outcome.delta.newBosses.length + outcome.delta.newCollectionEntries.length + outcome.delta.newStoryStages.length
      : 0;
    if (unlockCount > 0) this.trackProductEvent("unlock_reveal", { unlockCount });
    const latestResult = this.state.lastResult?.modeId === result.modeId ? this.state.lastResult : result;
    this.shell.showResult(latestResult, { runSource, outcome });
  }

  private async persistGuidedTutorialStep(step: TutorialStep): Promise<void> {
    const progress = await this.loadProgressSnapshot();
    const signal = step === "last_save"
      ? { type: "slash_committed" as const }
      : step === "solar_lance"
        ? { type: "last_save" as const }
        : step === "reward"
          ? { type: "solar_lance_fired" as const }
          : null;
    if (!signal) return;
    const next = reduceFirstSession(progress.onboarding, signal, new Date().toISOString());
    this.progressSnapshot = await this.progress.saveOnboarding(next);
    void this.queueProgressSync();
    if (next.step !== progress.onboarding.step) {
      this.trackProductEvent("tutorial_step_completed", { tutorialStep: progress.onboarding.step });
      this.trackProductEvent("tutorial_step_started", { tutorialStep: next.step });
    }
  }

  private updateRankedSubmissionState(rankingSubmissionState: NonNullable<ModeResult["rankingSubmissionState"]>): void {
    if (this.state.screen !== "result") return;
    const current = this.state.lastResult;
    if (!current || current.modeId !== "ranked") return;
    const next = { ...current, rankingSubmissionState };
    this.state = appStateReducer(this.state, { type: "RUN_ENDED", result: next });
    this.shell.updateResult(next);
  }

  private clearScene(): void {
    this.shell.hidePauseOverlay();
    if (!this.scene) return;
    if (this.scene.stage.parent) this.scene.stage.parent.removeChild(this.scene.stage);
    this.scene.stage.destroy({ children: true });
    this.scene = null;
  }

  private pauseForLifecycle(): void {
    this.lifecycle.hidden();
    this.audio.pause();
    this.scene?.cancelActivePointer();
  }

  private async bindPlatformLifecycle(): Promise<void> {
    if (this.platformLifecycleUnsubscribe) return;
    this.platformLifecycleUnsubscribe =
      (await this.platform.subscribeLifecycle?.(this.handlePlatformLifecycle)) ?? null;
  }

  private shownFromLifecycle(): void {
    this.lifecycle.shown();
    if (this.state.screen === "gameplay" && this.lifecycle.resumeRequired()) {
      this.shell.showPauseOverlay();
      return;
    }
    if (this.state.screen !== "gameplay") {
      this.lifecycle.resume();
      this.attemptAutoplaySafely();
    }
    this.shell.hidePauseOverlay();
  }

  private attemptAutoplaySafely(): void {
    try {
      void this.audio.attemptAutoplay().catch(() => undefined);
    } catch {
      // Autoplay capability failures must never interrupt app flow.
    }
  }

  private installFirstGestureAudioUnlock(): void {
    const target = this.browserDocument;
    if (!target || this.firstGestureUnlockInstalled) return;
    target.addEventListener("pointerdown", this.handleFirstGestureAudioUnlock);
    target.addEventListener("keydown", this.handleFirstGestureAudioUnlock);
    this.firstGestureUnlockInstalled = true;
  }

  private removeFirstGestureAudioUnlock(): void {
    const target = this.browserDocument;
    if (!target || !this.firstGestureUnlockInstalled) return;
    target.removeEventListener("pointerdown", this.handleFirstGestureAudioUnlock);
    target.removeEventListener("keydown", this.handleFirstGestureAudioUnlock);
    this.firstGestureUnlockInstalled = false;
  }

  private readonly handleFirstGestureAudioUnlock = () => {
    this.audio.unlockFromUserGesture();
    this.removeFirstGestureAudioUnlock();
  };

  private readonly handleWindowResize = () => this.resize();

  private readonly handleVisibilityChange = () => {
    if (this.browserDocument?.hidden) this.pauseForLifecycle();
    else this.shownFromLifecycle();
  };

  private readonly handlePageHide = () => this.pauseForLifecycle();
  private readonly handlePageShow = () => this.shownFromLifecycle();

  private readonly handlePlatformLifecycle = (event: "background" | "foreground") => {
    if (event === "background") this.pauseForLifecycle();
    if (event === "foreground") this.shownFromLifecycle();
  };

  private readonly handleTickerUpdate = () => {
    const now = performance.now();
    let dt = now - this.lastTime;
    this.lastTime = now;
    if (!this.lifecycle.canAdvance()) return;
    if (dt > MAX_DT_MS) dt = MAX_DT_MS;
    this.shell.update(dt);
    this.scene?.update(dt);
  };

  private resumePausedRun(): void {
    if (this.state.screen !== "gameplay" || !this.lifecycle.resumeRequired()) return;
    this.lifecycle.resume();
    if (!this.lifecycle.canAdvance()) return;
    this.audio.unlockFromUserGesture();
    this.shell.hidePauseOverlay();
    this.shell.hide();
  }

  /** 1080x1920 내부 좌표계를 화면에 맞춰 스케일·센터링 (design §3). */
  private resize(): void {
    this.applyRootFit();
    void this.platform.safeAreaInsets?.()
      .then((insets) => {
        this.safeAreaInsets = normalizeSafeAreaInsets(insets);
        this.applyRootFit();
      })
      .catch(() => undefined);
  }

  private applyRootFit(): void {
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const fit = computeRootFit(sw, sh, this.safeAreaInsets);
    this.root.scale.set(fit.scale);
    this.root.x = fit.x;
    this.root.y = fit.y;
    this.shell.setViewportMetrics({ width: sw, height: sh, safeArea: this.safeAreaInsets });
  }

  private async restoreProgressOutbox(): Promise<void> {
    if (!this.cloudProgress) return;
    try {
      const stored = await this.platform.storageGet(PROGRESS_OUTBOX_STORAGE_KEY);
      this.progressOutbox.restore(stored ? JSON.parse(stored) : []);
    } catch {
      this.progressOutbox.restore([]);
    }
  }

  private async persistProgressOutbox(): Promise<void> {
    if (!this.cloudProgress) return;
    await this.platform.storageSet(PROGRESS_OUTBOX_STORAGE_KEY, JSON.stringify(this.progressOutbox.list()));
  }

  /** The local snapshot has already been written before this mutation enters the outbox. */
  private async queueProgressSync(): Promise<void> {
    if (!this.cloudProgress) return;
    await this.localProgressRepository.load();
    this.progressOutbox.enqueue({ id: createProgressMutationId(), type: "snapshot_sync", createdAt: new Date().toISOString() });
    await this.persistProgressOutbox();
    const sync = await this.cloudProgress.syncInBackground();
    await this.persistProgressOutbox();
    if (sync.status === "synced") this.progressSnapshot = await this.localProgressRepository.load();
  }
}

function normalizeSafeAreaInsets(value: SafeAreaInsets | undefined): SafeAreaInsets {
  if (!value) return NO_SAFE_AREA;
  const finiteNonNegative = (candidate: unknown) => typeof candidate === "number" && Number.isFinite(candidate) ? Math.max(0, candidate) : 0;
  return {
    top: finiteNonNegative(value.top),
    right: finiteNonNegative(value.right),
    bottom: finiteNonNegative(value.bottom),
    left: finiteNonNegative(value.left),
  };
}

function guidedTutorialStepFor(step: ProgressSnapshot["onboarding"]["step"] | undefined): TutorialStep | undefined {
  return step === "basic_slash" || step === "last_save" || step === "solar_lance" || step === "reward" ? step : undefined;
}

function createProgressSyncPort(env: BackendEnv, accessTokenProvider: () => Promise<string | null>): CloudProgressSyncPort | undefined {
  const enabled = env.VITE_PROGRESS_SYNC_REMOTE_ENABLED === true || env.VITE_PROGRESS_SYNC_REMOTE_ENABLED === "true";
  if (!enabled || !env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) return undefined;
  const endpointUrl = `${env.VITE_SUPABASE_URL.replace(/\/$/, "")}/functions/v1/orbitslash-progress`;
  return new SupabaseProgressSyncPort(endpointUrl, env.VITE_SUPABASE_ANON_KEY, env.fetch ?? fetch, undefined, accessTokenProvider);
}

function createProgressMutationId(): string {
  return crypto.randomUUID();
}
