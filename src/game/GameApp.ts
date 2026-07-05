import { Application, Container } from "pixi.js";
import { computeRootFit } from "./coords";
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
import { AppShell } from "../render/AppShell";
import { createLocalRunStart, validatePublicRankedStart, type BackendAdapter, type RankedRunStart } from "../platform/BackendAdapter";
import { createDefaultBackendAdapter } from "../platform/BackendAdapterFactory";
import { resolveLeaderboardBoundary } from "../platform/LeaderboardBoundary";
import type { IPlatformAdapter } from "../platform/PlatformAdapter";
import { createDefaultPlatformAdapter } from "../platform/PlatformAdapterFactory";
import type { AdReviveReadiness } from "./RevivePolicy";

// 앱 수명주기 (implementation-plan §1 [P1], §4.1). PixiJS init, RAF 루프 소유,
// 1080x1920 반응형 캔버스 + scale = min(sw/1080, sh/1920).
// AppState drives home/detail/gameplay/result/settings/collection flow.

const MAX_DT_MS = 50; // dt 클램프 — 탭 백그라운드 점프 방지 (§4.1)
const DEV_QA_RESULTS_STORAGE_KEY = "orbitslash.devQaResults.v1";

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

export class GameApp {
  private app: Application;
  private root: Container; // 스케일 컨테이너 (내부 좌표계 1080x1920)
  private scene: GameScene | null = null;
  private shell: AppShell;
  private state: AppState;
  private platform: IPlatformAdapter;
  private rankingBackend: BackendAdapter;
  private progress: ProgressStore;
  private progressSnapshot: ProgressSnapshot | null = null;
  private qaResults: DevQaResults = createDefaultDevQaResults();
  private lastTime = 0;

  constructor(options: { platform?: IPlatformAdapter; backend?: BackendAdapter } = {}) {
    this.app = new Application();
    this.root = new Container();
    this.shell = new AppShell();
    this.state = initialAppState();
    this.platform = options.platform ?? createDefaultPlatformAdapter();
    this.rankingBackend = options.backend ?? createDefaultBackendAdapter();
    this.progress = new ProgressStore(this.platform);
    this.shell.onStartRun = (modeId, options) => {
      const source = modeId === "freeDefense" && options?.freeDefensePreset && options.freeDefensePreset !== "standard" ? "practice" : "play";
      void this.startRun(modeId, source, options);
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
    this.shell.onOpenSettings = () => {
      this.clearScene();
      this.state = appStateReducer(this.state, { type: "OPEN_SETTINGS" });
      this.shell.showSettings();
    };
    this.shell.onOpenCollection = () => {
      this.clearScene();
      this.state = appStateReducer(this.state, { type: "OPEN_COLLECTION" });
      void this.openCollection();
    };
    this.shell.onHome = () => {
      this.clearScene();
      this.state = appStateReducer(this.state, { type: "OPEN_HOME" });
      this.shell.showHome();
    };
    this.shell.onRetry = () => {
      void this.retryRun();
    };
  }

  async init(mount: HTMLElement, beforeReady?: () => Promise<void>): Promise<void> {
    this.state = appStateReducer(this.state, { type: "APP_LOADING" });
    this.shell.showLoading();
    await this.app.init({
      background: 0x05060f,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      resizeTo: window,
    });
    mount.appendChild(this.app.canvas);

    this.root.addChild(this.shell.container);
    this.app.stage.addChild(this.root);

    await beforeReady?.();
    this.loadQaResults();
    await this.loadProgressSnapshot();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    if (!this.startDevQaModeFromSearch()) {
      this.state = appStateReducer(this.state, { type: "APP_READY" });
      this.shell.showHome();
    }

    // RAF 루프 (deltaTime 계산, 상한 클램프 후 scene.update)
    this.lastTime = performance.now();
    this.app.ticker.add(() => {
      const now = performance.now();
      let dt = now - this.lastTime;
      this.lastTime = now;
      if (dt > MAX_DT_MS) dt = MAX_DT_MS;
      this.shell.update(dt);
      this.scene?.update(dt);
    });
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
      this.rankingBackend.publicLeaderboardRows().catch(async () => ({
        status: await this.rankingBackend.leaderboardStatus().catch(() => resolveLeaderboardBoundary()),
        rows: [],
      })),
    ]);
    this.shell.showRecords(progress, leaderboard.status, leaderboard.rows);
  }

  private async openCollection(): Promise<void> {
    this.shell.showCollection(await this.loadProgressSnapshot());
  }

  private async startRun(modeId: ModeId, source: AppRunSource = "play", options: RunLaunchOptions = {}): Promise<void> {
    const progress = await this.loadProgressSnapshot();
    if (!shouldAllowRunStart(modeId, source, progress)) {
      this.state = appStateReducer(this.state, { type: "OPEN_MODE_DETAIL", modeId });
      await this.showModeDetailWithReadiness(modeId, progress);
      return;
    }
    this.state = appStateReducer(this.state, {
      type: "START_RUN",
      modeId,
      source,
      difficulty: options.difficulty,
      freeDefensePreset: options.freeDefensePreset,
      storyStageId: options.storyStageId,
    });
    await this.prepareAndLaunchRun(this.state.runConfig, source);
  }

  private async retryRun(): Promise<void> {
    this.state = appStateReducer(this.state, { type: "RETRY_RUN" });
    await this.prepareAndLaunchRun(this.state.runConfig, this.state.runSource);
  }

  private async prepareAndLaunchRun(runConfig: RunConfig, source: AppRunSource): Promise<void> {
    const launch = await this.resolveRunLaunch(runConfig, source);
    this.state = { ...this.state, runConfig: launch.runConfig };
    this.launchRun(launch.runConfig, launch.runStart);
  }

  private async resolveRunLaunch(runConfig: RunConfig, source: AppRunSource): Promise<{ runConfig: RunConfig; runStart?: RankedRunStart }> {
    if (runConfig.modeId !== "ranked" || source === "devQa") return { runConfig };
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
    this.shell.showModeDetail(modeId, progress, { adReviveReadiness });
  }

  private launchRun(runConfig: RunConfig, runStart?: RankedRunStart): void {
    this.clearScene();
    this.scene = new GameScene(runConfig, {
      showResultOverlay: false,
      backend: this.rankingBackend,
      runStart,
      platformTelemetryContext: this.platform.telemetryContext(),
    });
    this.scene.onRunEnd = (result) => {
      void this.handleRunEnd(result);
    };
    this.scene.onRankedSubmissionUpdate = (rankingSubmissionState) => {
      this.updateRankedSubmissionState(rankingSubmissionState);
    };
    this.root.addChildAt(this.scene.stage, 0);
    this.shell.hide();
  }

  private async handleRunEnd(result: ModeResult): Promise<void> {
    const runSource = this.state.runSource;
    this.state = appStateReducer(this.state, { type: "RUN_ENDED", result });
    if (shouldRecordProgressForRun(runSource)) this.progressSnapshot = await this.progress.recordResult(result);
    this.shell.showResult(result, { runSource });
  }

  private updateRankedSubmissionState(rankingSubmissionState: NonNullable<ModeResult["rankingSubmissionState"]>): void {
    const current = this.state.lastResult;
    if (!current || current.modeId !== "ranked") return;
    const next = { ...current, rankingSubmissionState };
    this.state = appStateReducer(this.state, { type: "RUN_ENDED", result: next });
    this.shell.showResult(next, { runSource: this.state.runSource });
  }

  private clearScene(): void {
    if (!this.scene) return;
    if (this.scene.stage.parent) this.scene.stage.parent.removeChild(this.scene.stage);
    this.scene.stage.destroy({ children: true });
    this.scene = null;
  }

  /** 1080x1920 내부 좌표계를 화면에 맞춰 스케일·센터링 (design §3). */
  private resize(): void {
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const fit = computeRootFit(sw, sh);
    this.root.scale.set(fit.scale);
    this.root.x = fit.x;
    this.root.y = fit.y;
  }
}
