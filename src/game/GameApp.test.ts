import { describe, expect, it, vi } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as gameAppModule from "./GameApp";
import { devQaLaunchOptionsFromSearch, GameApp, resolveAdReviveReadiness, shouldAllowRunStart, shouldRecordProgressForRun } from "./GameApp";
import { FREE_DEFENSE_DAILY_PLAY_LIMIT, ProgressStore } from "./ProgressStore";
import { LocalBackendAdapter, validatePublicRankedStart } from "../platform/BackendAdapter";
import { WebStubAdapter } from "../platform/WebStubAdapter";
import { PlayerPreferencesStore } from "./PlayerPreferencesStore";
import { Container, EventBoundary, FederatedPointerEvent } from "pixi.js";
import { computeRootFit } from "./coords";
import { weekKeyFor } from "./retention/WeeklyGoalRules";
import { kstDayKey } from "./retention/WeeklyGoalRules";
import { buildRunConfig } from "./ModeConfig";
import { setLocale, t } from "../i18n";
import type { ShareRequest } from "../platform/share/ShareService";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createAudioCapability() {
  return {
    attemptAutoplay: vi.fn(async () => true),
    pause: vi.fn(),
    play: vi.fn(),
    setBgmEnabled: vi.fn(),
    unlockFromUserGesture: vi.fn(),
  };
}

function replacePixiAppForInit(app: GameApp, initBehavior: () => Promise<void> = async () => undefined) {
  let initialized = false;
  const canvas = { remove: vi.fn() };
  const readCanvas = vi.fn(() => {
    if (!initialized) throw new TypeError("renderer has not been initialized");
    return canvas;
  });
  const pixiApp = {
    init: vi.fn(async () => {
      await initBehavior();
      initialized = true;
    }),
    stage: new Container(),
    ticker: { add: vi.fn(), remove: vi.fn() },
  };
  Object.defineProperty(pixiApp, "canvas", { configurable: true, get: readCanvas });
  (app as any).app = pixiApp;
  return { canvas, readCanvas };
}

function countBudgetedAssets(dir: string): number {
  return readdirSync(dir, { withFileTypes: true }).reduce((count, entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return count + countBudgetedAssets(path);
    return count + (/\.(png|webp|jpg|jpeg|svg|avif|m4a|ogg|mp3|wav|aac)$/i.test(entry.name) ? 1 : 0);
  }, 0);
}

function dispatchPixiPointer(root: Container, target: Container, type: "pointerdown" | "pointertap"): void {
  const boundary = new EventBoundary(root);
  const event = new FederatedPointerEvent(boundary);
  event.type = type;
  event.pointerId = 7;
  event.target = target;
  for (const node of boundary.propagationPath(target)) {
    (node as Container & { isInteractive?: () => boolean }).isInteractive ??= () => node.eventMode !== "none";
  }
  boundary.propagate(event, type);
}

function lifecycleDom() {
  let hidden = false;
  const documentTarget = new EventTarget();
  Object.defineProperty(documentTarget, "hidden", { get: () => hidden });
  const windowTarget = Object.assign(new EventTarget(), {
    devicePixelRatio: 1,
    innerWidth: 360,
    innerHeight: 800,
    location: { search: "" },
    localStorage: { getItem: () => null, setItem: () => undefined },
  });
  return {
    documentTarget,
    setHidden: (next: boolean) => { hidden = next; },
    windowTarget,
  };
}

describe("GameApp progress gate", () => {
  it("claims an eligible weekly reward through the app path and refreshes local progress", async () => {
    const app = new GameApp();
    const progress = await (app as any).progress.load();
    const weekStart = new Date(`${weekKeyFor(new Date())}T00:00:00.000Z`);
    progress.retention.daily.clearDayKeys = Array.from({ length: 5 }, (_, offset) => {
      const day = new Date(weekStart.getTime() + offset * 24 * 60 * 60 * 1000);
      return day.toISOString().slice(0, 10);
    });
    await (app as any).progress.replace(progress);

    await (app as any).claimWeeklyReward();

    await expect((app as any).progress.load()).resolves.toMatchObject({
      collection: { titles: ["weekly_five_day"] },
    });
    expect((app as any).productTelemetry.peek()).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventName: "weekly_reward_claimed", props: expect.objectContaining({ titleId: "weekly_five_day" }) }),
    ]));
  });

  it("routes an unlocked ranked selection to local practice until server verification is available", async () => {
    const app = new GameApp({ backend: new LocalBackendAdapter(42) });
    const progress = await (app as any).progress.load();
    progress.profile.totalBossKills = 1;
    await (app as any).progress.replace(progress);

    await (app as any).startRun("ranked", "play", { difficulty: "rookie" });

    expect((app as any).state.runSource).toBe("practice");
    expect((app as any).state.runConfig.rules.rankingEligible).toBe(false);
  });

  it("records return_next_day only when a previously opened KST day differs", async () => {
    const platform = new WebStubAdapter();
    const previousDay = kstDayKey(new Date(Date.now() - 48 * 60 * 60 * 1000));
    await platform.storageSet("orbitslash.last-open-day.v1", previousDay);
    const app = new GameApp({ platform });
    const track = vi.spyOn(app as any, "trackProductEvent");

    await (app as any).trackReturnVisit();

    expect(track).toHaveBeenCalledWith("return_next_day", { dayKey: kstDayKey(new Date()) });
    await expect(platform.storageGet("orbitslash.last-open-day.v1")).resolves.toBe(kstDayKey(new Date()));
  });

  it("maps DEV boss QA query params into a selected Free Defense boss practice run", () => {
    expect(devQaLaunchOptionsFromSearch("freeDefense", "?qaPreset=boss&qaBoss=lava_titan")).toEqual({
      freeDefensePreset: "bossPractice",
      practiceBossId: "lava_titan",
    });
    expect(devQaLaunchOptionsFromSearch("freeDefense", "?qaPreset=boss&qaBoss=unknown")).toEqual({
      freeDefensePreset: "bossPractice",
      practiceBossId: "ringed_destroyer",
    });
    expect(devQaLaunchOptionsFromSearch("freeDefense", "?qaPreset=blockedBody")).toEqual({
      freeDefensePreset: "bossPractice",
      practiceBossId: "ringed_destroyer",
    });
  });

  it("forwards selected Story stage launch options into the active run config", async () => {
    const app = new GameApp();

    await (app as any).startRun("story", "play", { storyStageId: "story-8" });

    expect((app as any).state.runConfig.seed).toBe(1008);
  });

  it("routes settings through the app state machine", () => {
    const app = new GameApp();

    (app as any).shell.triggerHomeAction("settings");

    expect((app as any).state.screen).toBe("settings");
  });

  it("accepts injected platform and backend adapters instead of forcing the web stub", () => {
    const platform = new WebStubAdapter();
    const backend = new LocalBackendAdapter(42);
    const app = new GameApp({ platform, backend });

    expect((app as any).platform).toBe(platform);
    expect((app as any).rankingBackend).toBe(backend);
  });

  it("routes a verified platform session token through GameApp and the backend factory to ranked Edge authorization", async () => {
    const calls: RequestInit[] = [];
    const platform = Object.assign(new WebStubAdapter(), {
      getVerifiedSessionAccessToken: async () => "verified-session-token",
    });
    const app = new GameApp({
      platform,
      backendEnv: {
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_ANON_KEY: "anon-key",
        VITE_RANKED_EDGE_REMOTE_ENABLED: "true",
        fetch: (async (_input: RequestInfo | URL, init?: RequestInit) => {
          calls.push(init ?? {});
          return new Response(JSON.stringify({
            ok: true,
            start: {
              modeId: "ranked",
              runToken: "server-ranked-token",
              seed: 17,
              difficulty: "rookie",
              configVersion: "server-ranked-v1",
              rankingEligible: true,
              verification: "server_verified",
              identityBound: true,
              issuedAtMs: Date.now(),
              expiresAtMs: Date.now() + 60_000,
            },
          }), { status: 200 });
        }) as typeof fetch,
      },
    } as any);

    const start = await (app as any).rankingBackend.beginRankedRun("rookie");

    expect(calls[0]?.headers).toMatchObject({ apikey: "anon-key", Authorization: "Bearer verified-session-token" });
    expect(validatePublicRankedStart(start)).toEqual({ ok: true });
  });

  it("keeps an anonymous platform session ineligible for a public ranked run", async () => {
    const calls: RequestInit[] = [];
    const app = new GameApp({
      platform: new WebStubAdapter(),
      backendEnv: {
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_ANON_KEY: "anon-key",
        VITE_RANKED_EDGE_REMOTE_ENABLED: "true",
        fetch: (async (_input: RequestInfo | URL, init?: RequestInit) => {
          calls.push(init ?? {});
          return new Response(JSON.stringify({
            ok: true,
            start: {
              modeId: "ranked",
              runToken: "anonymous-server-ranked-token",
              seed: 17,
              difficulty: "rookie",
              configVersion: "server-ranked-v1",
              rankingEligible: false,
              verification: "server_verified",
              identityBound: false,
              issuedAtMs: Date.now(),
              expiresAtMs: Date.now() + 60_000,
            },
          }), { status: 200 });
        }) as typeof fetch,
      },
    } as any);

    const start = await (app as any).rankingBackend.beginRankedRun("rookie");

    expect(calls[0]?.headers).toMatchObject({ apikey: "anon-key", Authorization: "Bearer anon-key" });
    expect(validatePublicRankedStart(start)).toEqual({ ok: false, reason: "not_ranking_eligible" });
  });

  it("persists Settings feedback choices through the active platform adapter", async () => {
    const platform = new WebStubAdapter();
    const app = new GameApp({ platform });

    await (app as any).loadPreferences();
    (app as any).shell.triggerSettingsAction("haptic");
    await Promise.resolve();

    await expect(new PlayerPreferencesStore(platform).load()).resolves.toMatchObject({ hapticEnabled: false });
  });

  it("records ordered tutorial funnel events for start, completed step, and next step", async () => {
    const app = new GameApp();
    const track = vi.spyOn(app as any, "trackProductEvent");

    await (app as any).startHomePrimary();
    await (app as any).persistGuidedTutorialStep("last_save");

    expect(track).toHaveBeenCalledWith("primary_start", { modeId: "story", storyStageId: "story-1" });
    expect(track).toHaveBeenCalledWith("tutorial_step_started", { tutorialStep: "basic_slash" });
    expect(track).toHaveBeenCalledWith("tutorial_step_completed", { tutorialStep: "basic_slash" });
    expect(track).toHaveBeenCalledWith("tutorial_step_started", { tutorialStep: "last_save" });
  });

  it("updates an async ranked result without reopening and resetting the result flow", () => {
    const app = new GameApp();
    const result = {
      modeId: "ranked" as const,
      difficulty: "rookie" as const,
      endReason: "earth_destroyed" as const,
      survivalMs: 20_000,
      score: 900,
      kills: 9,
      maxCombo: 3,
      remainingEnergy: 0,
      rankingEligible: true,
      retryDestination: "modeSelect" as const,
      rankingSubmissionState: "pending" as const,
    };
    (app as any).state = { ...(app as any).state, screen: "result", runSource: "play", lastResult: result };
    const showResult = vi.spyOn((app as any).shell, "showResult");
    const updateResult = vi.spyOn((app as any).shell, "updateResult");

    (app as any).updateRankedSubmissionState("submitted");

    expect(updateResult).toHaveBeenCalledWith({ ...result, rankingSubmissionState: "submitted" });
    expect(showResult).not.toHaveBeenCalled();
  });

  it.each(["home", "modeSelect"] as const)("ignores a late ranked callback after navigating to %s", (screen) => {
    const app = new GameApp();
    const result = {
      modeId: "ranked" as const,
      difficulty: "rookie" as const,
      endReason: "earth_destroyed" as const,
      survivalMs: 20_000,
      score: 900,
      kills: 9,
      maxCombo: 3,
      remainingEnergy: 0,
      rankingEligible: true,
      retryDestination: "modeSelect" as const,
      rankingSubmissionState: "pending" as const,
    };
    const state = { ...(app as any).state, screen, runSource: "play", lastResult: result };
    (app as any).state = state;
    const updateResult = vi.spyOn((app as any).shell, "updateResult");

    (app as any).updateRankedSubmissionState("submitted");

    expect((app as any).state).toBe(state);
    expect((app as any).state.lastResult.rankingSubmissionState).toBe("pending");
    expect(updateResult).not.toHaveBeenCalled();
  });

  it("ignores the previous ranked scene callback after a later ranked scene becomes active", () => {
    const app = new GameApp();
    (app as any).launchRun(buildRunConfig("ranked"));
    const previousCallback = (app as any).scene.onRankedSubmissionUpdate as (state: "submitted") => void;
    (app as any).launchRun(buildRunConfig("ranked"));
    const currentCallback = (app as any).scene.onRankedSubmissionUpdate as (state: "submitted") => void;
    const result = {
      modeId: "ranked" as const,
      difficulty: "rookie" as const,
      endReason: "earth_destroyed" as const,
      survivalMs: 20_000,
      score: 900,
      kills: 9,
      maxCombo: 3,
      remainingEnergy: 0,
      rankingEligible: true,
      retryDestination: "modeSelect" as const,
      rankingSubmissionState: "pending" as const,
    };
    (app as any).state = { ...(app as any).state, screen: "result", runSource: "play", lastResult: result };

    previousCallback("submitted");
    expect((app as any).state.lastResult.rankingSubmissionState).toBe("pending");

    currentCallback("submitted");
    expect((app as any).state.lastResult.rankingSubmissionState).toBe("submitted");
  });

  it("creates a local-first cloud progress sync only after a durable local snapshot exists", async () => {
    const login = vi.fn(async () => ({ userId: "core-user-1", provider: "google_play" }));
    const platform = Object.assign(new WebStubAdapter(), { login });
    const sync = vi.fn(async ({ snapshot, mutations }: any) => ({
      snapshot,
      acknowledgedMutationIds: mutations.map((mutation: { id: string }) => mutation.id),
    }));
    const app = new GameApp({ platform, progressCloud: { sync } } as any);

    await (app as any).identity.signIn();
    await (app as any).loadProgressSnapshot();
    await (app as any).queueProgressSync();

    expect(login).toHaveBeenCalledOnce();
    expect(sync).toHaveBeenCalledOnce();
    expect(sync.mock.calls[0]?.[0]).toMatchObject({
      identity: { status: "linked", internalUserId: "core-user-1" },
      snapshot: { version: 4 },
      mutations: [expect.objectContaining({ type: "snapshot_sync" })],
    });
    expect((app as any).progressOutbox.list()).toEqual([]);
  });

  it("skips anonymous background progress sync without opening an interactive login", async () => {
    const login = vi.fn(async () => ({ userId: "core-user-should-not-be-requested", provider: "google_play" }));
    const platform = Object.assign(new WebStubAdapter(), { login });
    const sync = vi.fn();
    const app = new GameApp({ platform, progressCloud: { sync } } as any);

    await (app as any).loadProgressSnapshot();
    await (app as any).queueProgressSync();

    expect(login).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
    expect((app as any).progressOutbox.list()).toHaveLength(1);
  });

  it("applies platform safe-area insets when fitting the Pixi root", async () => {
    const dom = lifecycleDom();
    vi.stubGlobal("window", dom.windowTarget);
    try {
      const safeArea = { top: 20, right: 10, bottom: 20, left: 10 };
      const platform = Object.assign(new WebStubAdapter(), { safeAreaInsets: async () => safeArea });
      const app = new GameApp({ platform });

      (app as any).resize();
      await Promise.resolve();

      const fit = computeRootFit(dom.windowTarget.innerWidth, dom.windowTarget.innerHeight, safeArea);
      expect((app as any).root.scale.x).toBe(fit.scale);
      expect((app as any).root.x).toBe(fit.x);
      expect((app as any).root.y).toBe(fit.y);
      expect((app as any).shell.viewportMetrics).toEqual({ width: 360, height: 800, safeArea });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps an active run paused after visibility returns until the dedicated resume action", () => {
    const app = new GameApp();
    const cancelActivePointer = vi.fn();
    const unlockFromUserGesture = vi.spyOn((app as any).audio, "unlockFromUserGesture");
    (app as any).scene = { cancelActivePointer };
    (app as any).state = { ...(app as any).state, screen: "gameplay" };

    (app as any).pauseForLifecycle();
    (app as any).shownFromLifecycle();

    expect((app as any).lifecycle.canAdvance()).toBe(false);
    expect((app as any).shell.pauseOverlayVisible()).toBe(true);
    expect(cancelActivePointer).toHaveBeenCalledOnce();

    (app as any).resumePausedRun();

    expect((app as any).lifecycle.canAdvance()).toBe(true);
    expect((app as any).shell.pauseOverlayVisible()).toBe(false);
    expect(unlockFromUserGesture).toHaveBeenCalledOnce();
  });

  it("routes browser lifecycle events through a paused overlay until the real Pixi CTA gesture resumes", async () => {
    const dom = lifecycleDom();
    vi.stubGlobal("window", dom.windowTarget);
    vi.stubGlobal("document", dom.documentTarget);
    try {
      const app = new GameApp();
      const tick = vi.fn();
      let tickCallback: (() => void) | undefined;
      (app as any).app = {
        init: vi.fn(async () => undefined),
        canvas: {},
        stage: new Container(),
        ticker: { add: (callback: () => void) => { tickCallback = callback; tick(); } },
      };
      const sceneStage = new Container();
      const scene = { stage: sceneStage, cancelActivePointer: vi.fn(), update: vi.fn(), onPointerDown: vi.fn() };
      sceneStage.eventMode = "static";
      sceneStage.on("pointerdown", scene.onPointerDown);
      const pauseAudio = vi.spyOn((app as any).audio, "pause");
      const resumeAudio = vi.spyOn((app as any).audio, "unlockFromUserGesture");

      await app.init({ appendChild: vi.fn() } as unknown as HTMLElement);
      (app as any).scene = scene;
      (app as any).root.addChildAt(sceneStage, 0);
      (app as any).state = { ...(app as any).state, screen: "gameplay" };

      dom.setHidden(true);
      dom.documentTarget.dispatchEvent(new Event("visibilitychange"));
      dom.windowTarget.dispatchEvent(new Event("pagehide"));
      expect((app as any).lifecycle.canAdvance()).toBe(false);
      expect(scene.cancelActivePointer).toHaveBeenCalledTimes(2);
      expect(pauseAudio).toHaveBeenCalledTimes(2);

      dom.setHidden(false);
      dom.documentTarget.dispatchEvent(new Event("visibilitychange"));
      dom.windowTarget.dispatchEvent(new Event("pageshow"));
      expect((app as any).shell.pauseOverlayVisible()).toBe(true);
      expect((app as any).lifecycle.canAdvance()).toBe(false);
      tickCallback?.();
      expect(scene.update).not.toHaveBeenCalled();

      const root = (app as any).root as Container;
      const pauseOverlay = (app as any).shell.container;
      const backdrop = pauseOverlay.getChildByLabel("lifecycle-pause-backdrop", true) as Container;
      const card = pauseOverlay.getChildByLabel("lifecycle-pause-card", true) as Container;
      dispatchPixiPointer(root, backdrop, "pointerdown");
      dispatchPixiPointer(root, card, "pointerdown");
      dispatchPixiPointer(root, card, "pointertap");
      expect((app as any).lifecycle.canAdvance()).toBe(false);
      expect(resumeAudio).not.toHaveBeenCalled();
      expect(scene.onPointerDown).not.toHaveBeenCalled();

      const resumeButton = (app as any).shell.container.getChildByLabel("lifecycle-pause-resume", true) as Container;
      dispatchPixiPointer(root, resumeButton, "pointerdown");
      dispatchPixiPointer(root, resumeButton, "pointertap");
      expect(scene.onPointerDown).not.toHaveBeenCalled();
      expect((app as any).lifecycle.canAdvance()).toBe(true);
      expect(resumeAudio).toHaveBeenCalledOnce();

      tickCallback?.();
      expect(scene.update).toHaveBeenCalledOnce();
      dispatchPixiPointer(root, sceneStage, "pointerdown");
      expect(scene.onPointerDown).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("records normal runs but keeps DEV QA and practice runs out of progression", () => {
    expect(shouldRecordProgressForRun("play")).toBe(true);
    expect(shouldRecordProgressForRun("devQa")).toBe(false);
    expect(shouldRecordProgressForRun("practice" as any)).toBe(false);
  });

  it("blocks standard Free Defense starts after the daily free-play limit but still allows practice", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);
    for (let i = 0; i < FREE_DEFENSE_DAILY_PLAY_LIMIT; i += 1) {
      await store.recordResult({
        modeId: "freeDefense",
        difficulty: "rookie",
        endReason: "earth_destroyed",
        survivalMs: 10000,
        score: 100,
        kills: 2,
        maxCombo: 1,
        remainingEnergy: 0,
        rankingEligible: false,
        retryDestination: "sameRun",
      });
    }
    const snapshot = await store.load();

    expect(shouldAllowRunStart("freeDefense", "play", snapshot)).toBe(false);
    expect(shouldAllowRunStart("freeDefense", "practice", snapshot)).toBe(true);
    expect(shouldAllowRunStart("bossRush", "play", snapshot)).toBe(false);

    await store.recordResult({
      modeId: "freeDefense",
      difficulty: "rookie",
      endReason: "earth_destroyed",
      survivalMs: 60000,
      score: 2000,
      kills: 20,
      bossKills: 1,
      maxCombo: 5,
      remainingEnergy: 10,
      rankingEligible: false,
      retryDestination: "sameRun",
    });

    expect(shouldAllowRunStart("bossRush", "play", await store.load())).toBe(true);
  });

  it("keeps ad revive readiness disabled until both platform ads and remote telemetry are ready", async () => {
    const supportedPlatform = {
      rewardedAdCapability: async () => ({ supported: true as const, reason: "ready" as const }),
    };
    const remoteTelemetry = {
      rewardedAdTelemetryStatus: async () => ({
        ready: true,
        reason: "ready" as const,
        endpointConfigured: true,
        remoteEnabled: true,
        remoteVerified: true,
      }),
    };
    const unverifiedRemoteTelemetry = {
      rewardedAdTelemetryStatus: async () => ({
        ready: false,
        reason: "remote_unverified" as const,
        endpointConfigured: true,
        remoteEnabled: true,
        remoteVerified: false,
      }),
    };

    await expect(resolveAdReviveReadiness(new WebStubAdapter(), remoteTelemetry)).resolves.toMatchObject({
      adsAdapterReady: true,
      platformSupportsRewardedAd: false,
      rewardedTelemetryReady: true,
    });
    await expect(resolveAdReviveReadiness(supportedPlatform, new LocalBackendAdapter(1234))).resolves.toMatchObject({
      adsAdapterReady: true,
      platformSupportsRewardedAd: true,
      rewardedTelemetryReady: false,
    });
    await expect(resolveAdReviveReadiness(supportedPlatform, unverifiedRemoteTelemetry)).resolves.toMatchObject({
      adsAdapterReady: true,
      platformSupportsRewardedAd: true,
      rewardedTelemetryReady: false,
    });
    await expect(resolveAdReviveReadiness(supportedPlatform, remoteTelemetry)).resolves.toMatchObject({
      adsAdapterReady: true,
      platformSupportsRewardedAd: true,
      rewardedTelemetryReady: true,
    });
  });
});

describe("GameApp audio, account, and share integration", () => {
  it.each([
    ["pointerdown", "keydown"],
    ["keydown", "pointerdown"],
  ] as const)("attempts BGM on init and consumes the first %s gesture only once", async (firstGesture, counterpart) => {
    const dom = lifecycleDom();
    const audio = createAudioCapability();
    const removeEventListener = vi.spyOn(dom.documentTarget, "removeEventListener");
    vi.stubGlobal("window", dom.windowTarget);
    vi.stubGlobal("document", dom.documentTarget);
    try {
      const app = new GameApp({ audio });
      replacePixiAppForInit(app);

      await app.init({ appendChild: vi.fn() } as unknown as HTMLElement);

      expect(audio.setBgmEnabled).toHaveBeenCalledOnce();
      expect(audio.attemptAutoplay).toHaveBeenCalledOnce();
      expect(audio.setBgmEnabled.mock.invocationCallOrder[0]).toBeLessThan(audio.attemptAutoplay.mock.invocationCallOrder[0]!);

      dom.documentTarget.dispatchEvent(new Event(firstGesture));
      dom.documentTarget.dispatchEvent(new Event(counterpart));
      dom.documentTarget.dispatchEvent(new Event(firstGesture));

      expect(audio.unlockFromUserGesture).toHaveBeenCalledOnce();
      expect(removeEventListener).toHaveBeenCalledWith("pointerdown", expect.any(Function));
      expect(removeEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not block first entry or gesture fallback on a pending autoplay attempt", async () => {
    const dom = lifecycleDom();
    const autoplay = createDeferred<boolean>();
    const audio = { ...createAudioCapability(), attemptAutoplay: vi.fn(() => autoplay.promise) };
    vi.stubGlobal("window", dom.windowTarget);
    vi.stubGlobal("document", dom.documentTarget);
    const app = new GameApp({ audio });
    replacePixiAppForInit(app);
    const init = app.init({ appendChild: vi.fn() } as unknown as HTMLElement);
    try {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const completed = await Promise.race([
        init.then(() => true),
        new Promise<false>((resolve) => {
          timeoutId = setTimeout(() => resolve(false), 250);
        }),
      ]);
      if (timeoutId) clearTimeout(timeoutId);

      expect(completed).toBe(true);
      dom.documentTarget.dispatchEvent(new Event("pointerdown"));
      expect(audio.unlockFromUserGesture).toHaveBeenCalledOnce();
    } finally {
      autoplay.resolve(false);
      await init;
      vi.unstubAllGlobals();
    }
  });

  it("pauses in background and retries BGM on a non-gameplay foreground", () => {
    const audio = createAudioCapability();
    const app = new GameApp({ audio });
    (app as any).state = { ...(app as any).state, screen: "home" };

    (app as any).pauseForLifecycle();
    (app as any).shownFromLifecycle();

    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.attemptAutoplay).toHaveBeenCalledOnce();
    expect((app as any).lifecycle.canAdvance()).toBe(true);
  });

  it("keeps gameplay foreground paused for the Resume CTA without autoplay", () => {
    const audio = createAudioCapability();
    const app = new GameApp({ audio });
    (app as any).state = { ...(app as any).state, screen: "gameplay" };

    (app as any).pauseForLifecycle();
    (app as any).shownFromLifecycle();

    expect(audio.attemptAutoplay).not.toHaveBeenCalled();
    expect((app as any).lifecycle.canAdvance()).toBe(false);
    expect((app as any).shell.pauseOverlayVisible()).toBe(true);

    (app as any).resumePausedRun();

    expect(audio.unlockFromUserGesture).toHaveBeenCalledOnce();
    expect((app as any).lifecycle.canAdvance()).toBe(true);
  });

  it("renders Settings login loading then linked without exposing the internal user id", async () => {
    const login = createDeferred<{ userId: string; provider: string }>();
    const platform = Object.assign(new WebStubAdapter(), { login: vi.fn(() => login.promise) });
    const app = new GameApp({ platform });
    const showSettings = vi.spyOn((app as any).shell, "showSettings");
    await (app as any).openSettings();

    (app as any).shell.onSettingsLogin?.();

    expect((app as any).settingsAccountState).toEqual({ status: "loading" });
    expect(showSettings).toHaveBeenLastCalledWith(
      expect.any(Object),
      { account: { status: "loading" }, share: "idle" },
    );

    login.resolve({ userId: "core-user-secret", provider: "google_play" });
    await vi.waitFor(() => expect((app as any).settingsAccountState).toEqual({ status: "linked", provider: "google_play" }));

    expect(JSON.stringify(showSettings.mock.calls)).not.toContain("core-user-secret");
  });

  it("derives the Settings account presentation from the IdentityService state", async () => {
    const login = vi.fn(async () => ({ userId: "core-user-derived", provider: "apps_in_toss" }));
    const app = new GameApp({ platform: Object.assign(new WebStubAdapter(), { login }) });
    await (app as any).identity.signIn();
    const showSettings = vi.spyOn((app as any).shell, "showSettings");

    await (app as any).openSettings();

    expect((app as any).settingsAccountState).toEqual({ status: "linked", provider: "apps_in_toss" });
    expect(showSettings).toHaveBeenLastCalledWith(
      expect.any(Object),
      { account: { status: "linked", provider: "apps_in_toss" }, share: "idle" },
    );
    expect(JSON.stringify(showSettings.mock.calls)).not.toContain("core-user-derived");
  });

  it("maps an anonymous Settings login result to unavailable", async () => {
    const app = new GameApp({ platform: new WebStubAdapter() });
    await (app as any).openSettings();

    (app as any).shell.onSettingsLogin?.();

    await vi.waitFor(() => expect((app as any).settingsAccountState).toEqual({ status: "error", reason: "unavailable" }));
  });

  it.each([
    ["thrown login", async () => { throw new Error("secret platform failure"); }],
    ["identity error", async () => ({ userId: "", provider: "" })],
  ])("maps %s to the stable failed Settings state", async (_label, login) => {
    const platform = Object.assign(new WebStubAdapter(), { login });
    const app = new GameApp({ platform: platform as any });
    await (app as any).openSettings();

    (app as any).shell.onSettingsLogin?.();

    await vi.waitFor(() => expect((app as any).settingsAccountState).toEqual({ status: "error", reason: "failed" }));
  });

  it("ignores duplicate Settings login while loading and after linking", async () => {
    const loginResult = createDeferred<{ userId: string; provider: string }>();
    const login = vi.fn(() => loginResult.promise);
    const platform = Object.assign(new WebStubAdapter(), { login });
    const app = new GameApp({ platform });
    await (app as any).openSettings();

    (app as any).shell.onSettingsLogin?.();
    (app as any).shell.onSettingsLogin?.();
    expect(login).toHaveBeenCalledOnce();

    loginResult.resolve({ userId: "core-user-1", provider: "apps_in_toss" });
    await vi.waitFor(() => expect((app as any).settingsAccountState.status).toBe("linked"));
    (app as any).shell.onSettingsLogin?.();
    expect(login).toHaveBeenCalledOnce();
  });

  it("keeps a late Settings login result without reopening Settings", async () => {
    const loginResult = createDeferred<{ userId: string; provider: string }>();
    const platform = Object.assign(new WebStubAdapter(), { login: vi.fn(() => loginResult.promise) });
    const app = new GameApp({ platform });
    const showSettings = vi.spyOn((app as any).shell, "showSettings");
    await (app as any).openSettings();
    (app as any).shell.onSettingsLogin?.();
    const callsBeforeLeaving = showSettings.mock.calls.length;

    (app as any).shell.triggerSettingsAction("back");
    expect((app as any).shell.home.visible).toBe(true);
    expect((app as any).shell.settings.visible).toBe(false);
    expect((app as any).state.screen).toBe("home");
    loginResult.resolve({ userId: "core-user-1", provider: "google_play" });
    await vi.waitFor(() => expect((app as any).settingsAccountState.status).toBe("linked"));

    expect((app as any).state.screen).toBe("home");
    expect((app as any).shell.home.visible).toBe(true);
    expect((app as any).shell.settings.visible).toBe(false);
    expect(showSettings).toHaveBeenCalledTimes(callsBeforeLeaving);
  });

  it("shares the localized app title with a sanitized public URL and no invite code", async () => {
    setLocale("ko");
    const share = vi.fn(async (_request: ShareRequest) => ({ status: "shared" as const, method: "native" as const }));
    const shareService = { share };
    vi.stubGlobal("window", { location: { href: "https://play.example.com/orbitslash/run?invite=secret#score" } });
    try {
      const app = new GameApp({ shareService });
      await (app as any).openSettings();

      (app as any).shell.onSettingsShare?.();

      await vi.waitFor(() => expect((app as any).settingsShareState).toBe("success"));
      expect(share).toHaveBeenCalledWith({
        message: t("app.title"),
        title: t("app.title"),
        webUrl: "https://play.example.com/orbitslash/run",
      });
      expect(share.mock.calls[0]?.[0]).not.toHaveProperty("inviteCode");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([
    ["unavailable", vi.fn(async () => ({ status: "unavailable" as const, reason: "share_unavailable" as const }))],
    ["exception", vi.fn(async () => { throw new Error("private share failure"); })],
  ])("maps share %s to the stable error state", async (_label, share) => {
    const app = new GameApp({ shareService: { share } });
    await (app as any).openSettings();

    (app as any).shell.onSettingsShare?.();

    await vi.waitFor(() => expect((app as any).settingsShareState).toBe("error"));
  });

  it("returns to idle when sharing is cancelled", async () => {
    const share = vi.fn(async () => ({ status: "cancelled" as const }));
    const app = new GameApp({ shareService: { share } });
    await (app as any).openSettings();
    (app as any).shell.onSettingsShare?.();
    await vi.waitFor(() => expect((app as any).settingsShareState).toBe("idle"));
  });

  it("ignores duplicate sharing but allows retries after error and success", async () => {
    const first = createDeferred<{ status: "unavailable"; reason: "share_unavailable" }>();
    const share = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue({ status: "shared", method: "clipboard" });
    const app = new GameApp({ shareService: { share } });
    await (app as any).openSettings();

    (app as any).shell.onSettingsShare?.();
    (app as any).shell.onSettingsShare?.();
    expect(share).toHaveBeenCalledOnce();

    first.resolve({ status: "unavailable", reason: "share_unavailable" });
    await vi.waitFor(() => expect((app as any).settingsShareState).toBe("error"));
    (app as any).shell.onSettingsShare?.();
    await vi.waitFor(() => expect((app as any).settingsShareState).toBe("success"));
    (app as any).shell.onSettingsShare?.();
    await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(3));
  });

  it("keeps a late share result without reopening Settings", async () => {
    const shareResult = createDeferred<{ status: "shared"; method: "native" }>();
    const app = new GameApp({ shareService: { share: vi.fn(() => shareResult.promise) } });
    const showSettings = vi.spyOn((app as any).shell, "showSettings");
    await (app as any).openSettings();
    (app as any).shell.onSettingsShare?.();
    const callsBeforeLeaving = showSettings.mock.calls.length;

    (app as any).shell.triggerSettingsAction("back");
    expect((app as any).shell.home.visible).toBe(true);
    expect((app as any).shell.settings.visible).toBe(false);
    expect((app as any).state.screen).toBe("home");
    shareResult.resolve({ status: "shared", method: "native" });
    await vi.waitFor(() => expect((app as any).settingsShareState).toBe("success"));

    expect((app as any).state.screen).toBe("home");
    expect((app as any).shell.home.visible).toBe(true);
    expect((app as any).shell.settings.visible).toBe(false);
    expect(showSettings).toHaveBeenCalledTimes(callsBeforeLeaving);
  });

  it("atomically merges and serializes rapid preference changes", async () => {
    const pendingWrites: Array<{ value: string; resolve: () => void }> = [];
    const storageSet = vi.fn((_key: string, value: string) => new Promise<void>((resolve) => {
      pendingWrites.push({ value, resolve });
    }));
    const platform = Object.assign(new WebStubAdapter(), { storageSet });
    const audio = createAudioCapability();
    const app = new GameApp({ platform, audio });
    await (app as any).loadPreferences();

    const bgmUpdate = (app as any).updatePreferences({ bgmEnabled: false });
    const sfxUpdate = (app as any).updatePreferences({ sfxEnabled: false });

    expect((app as any).preferences).toMatchObject({ bgmEnabled: false, sfxEnabled: false });
    expect(audio.setBgmEnabled).toHaveBeenLastCalledWith(false);
    await vi.waitFor(() => expect(pendingWrites).toHaveLength(1));

    pendingWrites[0]!.resolve();
    await bgmUpdate;
    expect((app as any).preferences).toMatchObject({ bgmEnabled: false, sfxEnabled: false });
    await vi.waitFor(() => expect(pendingWrites).toHaveLength(2));

    pendingWrites[1]!.resolve();
    await sfxUpdate;
    expect(JSON.parse(pendingWrites[1]!.value)).toMatchObject({ bgmEnabled: false, sfxEnabled: false });
  });

  it("initializes only once when duplicate callers race", async () => {
    const dom = lifecycleDom();
    const unsubscribe = vi.fn(async () => undefined);
    const subscribeLifecycle = vi.fn(async () => unsubscribe);
    const platform = Object.assign(new WebStubAdapter(), { subscribeLifecycle });
    const app = new GameApp({ platform, audio: createAudioCapability() });
    replacePixiAppForInit(app);
    const mount = { appendChild: vi.fn() } as unknown as HTMLElement;
    const beforeReady = vi.fn(async () => undefined);
    vi.stubGlobal("window", dom.windowTarget);
    vi.stubGlobal("document", dom.documentTarget);
    try {
      await Promise.all([app.init(mount, beforeReady), app.init(mount, beforeReady)]);

      expect((app as any).app.init).toHaveBeenCalledOnce();
      expect((mount as any).appendChild).toHaveBeenCalledOnce();
      expect(beforeReady).toHaveBeenCalledOnce();
      expect(subscribeLifecycle).toHaveBeenCalledOnce();
      expect((app as any).app.ticker.add).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("disposes DOM, platform, ticker, canvas, and pending gesture bindings", async () => {
    const dom = lifecycleDom();
    const removeWindowListener = vi.spyOn(dom.windowTarget, "removeEventListener");
    const removeDocumentListener = vi.spyOn(dom.documentTarget, "removeEventListener");
    const unsubscribe = vi.fn(async () => undefined);
    const subscribeLifecycle = vi.fn(async () => unsubscribe);
    const audio = createAudioCapability();
    const app = new GameApp({ platform: Object.assign(new WebStubAdapter(), { subscribeLifecycle }), audio });
    replacePixiAppForInit(app);
    vi.stubGlobal("window", dom.windowTarget);
    vi.stubGlobal("document", dom.documentTarget);
    try {
      await app.init({ appendChild: vi.fn() } as unknown as HTMLElement);
      expect((app as any).dispose).toBeTypeOf("function");

      await (app as any).dispose();

      expect(unsubscribe).toHaveBeenCalledOnce();
      expect((app as any).app.ticker.remove).toHaveBeenCalledOnce();
      expect((app as any).app.canvas.remove).toHaveBeenCalledOnce();
      expect(removeWindowListener).toHaveBeenCalledWith("resize", expect.any(Function));
      expect(removeWindowListener).toHaveBeenCalledWith("pagehide", expect.any(Function));
      expect(removeWindowListener).toHaveBeenCalledWith("pageshow", expect.any(Function));
      expect(removeDocumentListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
      expect(removeDocumentListener).toHaveBeenCalledWith("pointerdown", expect.any(Function));
      expect(removeDocumentListener).toHaveBeenCalledWith("keydown", expect.any(Function));

      audio.pause.mockClear();
      audio.unlockFromUserGesture.mockClear();
      dom.windowTarget.dispatchEvent(new Event("pagehide"));
      dom.documentTarget.dispatchEvent(new Event("pointerdown"));
      expect(audio.pause).not.toHaveBeenCalled();
      expect(audio.unlockFromUserGesture).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("finishes cleanup when dispose races an init waiting on beforeReady", async () => {
    const dom = lifecycleDom();
    const beforeReadyGate = createDeferred<void>();
    const beforeReady = vi.fn(() => beforeReadyGate.promise);
    const unsubscribe = vi.fn(async () => undefined);
    const subscribeLifecycle = vi.fn(async () => unsubscribe);
    const audio = createAudioCapability();
    const app = new GameApp({ platform: Object.assign(new WebStubAdapter(), { subscribeLifecycle }), audio });
    replacePixiAppForInit(app);
    const mount = { appendChild: vi.fn() } as unknown as HTMLElement;
    const addWindowListener = vi.spyOn(dom.windowTarget, "addEventListener");
    const removeWindowListener = vi.spyOn(dom.windowTarget, "removeEventListener");
    const addDocumentListener = vi.spyOn(dom.documentTarget, "addEventListener");
    const removeDocumentListener = vi.spyOn(dom.documentTarget, "removeEventListener");
    vi.stubGlobal("window", dom.windowTarget);
    vi.stubGlobal("document", dom.documentTarget);
    try {
      const initialization = app.init(mount, beforeReady);
      await vi.waitFor(() => expect(beforeReady).toHaveBeenCalledOnce());
      const disposal = app.dispose();

      beforeReadyGate.resolve();
      await expect(initialization).resolves.toBeUndefined();
      await expect(disposal).resolves.toBeUndefined();

      for (const eventName of ["resize", "pagehide", "pageshow"]) {
        expect(removeWindowListener.mock.calls.filter(([type]) => type === eventName)).toHaveLength(
          addWindowListener.mock.calls.filter(([type]) => type === eventName).length,
        );
      }
      for (const eventName of ["visibilitychange", "pointerdown", "keydown"]) {
        expect(removeDocumentListener.mock.calls.filter(([type]) => type === eventName)).toHaveLength(
          addDocumentListener.mock.calls.filter(([type]) => type === eventName).length,
        );
      }
      expect(unsubscribe).toHaveBeenCalledTimes(subscribeLifecycle.mock.calls.length);
      expect((app as any).app.ticker.remove).toHaveBeenCalledTimes((app as any).app.ticker.add.mock.calls.length);
      expect((app as any).app.canvas.remove.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
        (mount as any).appendChild.mock.invocationCallOrder.at(-1),
      );
      expect((app as any).browserWindow).toBeNull();
      expect((app as any).browserDocument).toBeNull();

      audio.pause.mockClear();
      audio.unlockFromUserGesture.mockClear();
      dom.windowTarget.dispatchEvent(new Event("pagehide"));
      dom.documentTarget.dispatchEvent(new Event("pointerdown"));
      expect(audio.pause).not.toHaveBeenCalled();
      expect(audio.unlockFromUserGesture).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps disposal terminal when init is requested afterward", async () => {
    const app = new GameApp({ audio: createAudioCapability() });
    const pixi = replacePixiAppForInit(app);
    const mount = { appendChild: vi.fn() } as unknown as HTMLElement;

    await app.dispose();
    await expect(app.init(mount)).resolves.toBeUndefined();

    expect((app as any).app.init).not.toHaveBeenCalled();
    expect((mount as any).appendChild).not.toHaveBeenCalled();
    expect((app as any).app.ticker.add).not.toHaveBeenCalled();
    expect(pixi.readCanvas).not.toHaveBeenCalled();
  });

  it("does not read the Pixi canvas when renderer initialization fails", async () => {
    const dom = lifecycleDom();
    const app = new GameApp({ audio: createAudioCapability() });
    const pixi = replacePixiAppForInit(app, async () => {
      throw new Error("renderer init failed");
    });
    vi.stubGlobal("window", dom.windowTarget);
    vi.stubGlobal("document", dom.documentTarget);
    try {
      await expect(app.init({ appendChild: vi.fn() } as unknown as HTMLElement)).rejects.toThrow("renderer init failed");
      await expect(app.dispose()).resolves.toBeUndefined();

      expect(pixi.readCanvas).not.toHaveBeenCalled();
      expect(pixi.canvas.remove).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("settles disposal and cleans the canvas when an in-flight init fails", async () => {
    const dom = lifecycleDom();
    const beforeReadyGate = createDeferred<void>();
    const beforeReady = vi.fn(() => beforeReadyGate.promise);
    const app = new GameApp({ audio: createAudioCapability() });
    replacePixiAppForInit(app);
    const mount = { appendChild: vi.fn() } as unknown as HTMLElement;
    vi.stubGlobal("window", dom.windowTarget);
    vi.stubGlobal("document", dom.documentTarget);
    try {
      const initialization = app.init(mount, beforeReady);
      await vi.waitFor(() => expect(beforeReady).toHaveBeenCalledOnce());
      const disposal = app.dispose();

      beforeReadyGate.reject(new Error("beforeReady failed"));
      await expect(initialization).rejects.toThrow("beforeReady failed");
      await expect(disposal).resolves.toBeUndefined();

      expect((app as any).app.canvas.remove.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
        (mount as any).appendChild.mock.invocationCallOrder.at(-1),
      );
      expect((app as any).browserWindow).toBeNull();
      expect((app as any).browserDocument).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ignores a late home refresh after disposal", async () => {
    const dom = lifecycleDom();
    const app = new GameApp({ audio: createAudioCapability() });
    replacePixiAppForInit(app);
    const snapshot = await (app as any).progress.load();
    const lateHomeRefresh = createDeferred<typeof snapshot>();
    vi.spyOn(app as any, "loadProgressSnapshot")
      .mockResolvedValueOnce(snapshot)
      .mockImplementationOnce(() => lateHomeRefresh.promise);
    const showHome = vi.spyOn((app as any).shell, "showHome");
    vi.stubGlobal("window", dom.windowTarget);
    vi.stubGlobal("document", dom.documentTarget);
    try {
      await app.init({ appendChild: vi.fn() } as unknown as HTMLElement);
      expect(showHome).not.toHaveBeenCalled();

      await app.dispose();
      lateHomeRefresh.resolve(snapshot);
      await Promise.resolve();

      expect(showHome).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("absorbs rejected autoplay attempts during init without an unhandled rejection", async () => {
    const dom = lifecycleDom();
    const unhandled = vi.fn();
    const rejectedAttempt = Promise.reject<boolean>(new Error("autoplay rejected"));
    const catchRejection = vi.spyOn(rejectedAttempt, "catch");
    const audio = { ...createAudioCapability(), attemptAutoplay: vi.fn(() => rejectedAttempt) };
    const app = new GameApp({ audio });
    replacePixiAppForInit(app);
    vi.stubGlobal("window", dom.windowTarget);
    vi.stubGlobal("document", dom.documentTarget);
    process.on("unhandledRejection", unhandled);
    try {
      await expect(app.init({ appendChild: vi.fn() } as unknown as HTMLElement)).resolves.toBeUndefined();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect((app as any).state.screen).toBe("home");
      expect(catchRejection).toHaveBeenCalledOnce();
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
      vi.unstubAllGlobals();
    }
  });

  it("absorbs synchronous autoplay failures during init and foreground resume", async () => {
    const dom = lifecycleDom();
    const audio = { ...createAudioCapability(), attemptAutoplay: vi.fn(() => { throw new Error("sync autoplay failure"); }) };
    const app = new GameApp({ audio });
    replacePixiAppForInit(app);
    vi.stubGlobal("window", dom.windowTarget);
    vi.stubGlobal("document", dom.documentTarget);
    try {
      await expect(app.init({ appendChild: vi.fn() } as unknown as HTMLElement)).resolves.toBeUndefined();
      (app as any).state = { ...(app as any).state, screen: "home" };
      (app as any).pauseForLifecycle();

      expect(() => (app as any).shownFromLifecycle()).not.toThrow();
      expect((app as any).lifecycle.canAdvance()).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("public share URL", () => {
  it("keeps only the http(s) origin and pathname", () => {
    const sanitize = (gameAppModule as any).publicShareUrlFromHref;
    expect(sanitize).toBeTypeOf("function");
    expect(sanitize("https://play.example.com/path/to/game?invite=secret#score")).toBe("https://play.example.com/path/to/game");
    expect(sanitize("http://localhost:5173/game?q=1#hash")).toBe("http://localhost:5173/game");
  });

  it.each([undefined, "", "not a url", "intoss://orbitslash?invite=secret", "javascript:alert(1)"])(
    "rejects a non-public or malformed href: %s",
    (href) => {
      const sanitize = (gameAppModule as any).publicShareUrlFromHref;
      expect(sanitize).toBeTypeOf("function");
      expect(sanitize(href)).toBe("");
    },
  );
});

describe("asset budget discovery", () => {
  it("counts image and audio assets in the reported budget", () => {
    const expectedFiles = countBudgetedAssets(join(process.cwd(), "public", "assets"));
    const output = execFileSync(process.execPath, ["scripts/check-asset-budget.mjs"], { encoding: "utf8" });

    expect(output).toContain(`files=${expectedFiles}`);
  });

  it("counts SVG, AVIF, and AAC assets and reports the eager-audio budget", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "orbitslash-assets-"));
    const script = join(process.cwd(), "scripts", "check-asset-budget.mjs");
    try {
      writeFixtureAsset(fixtureRoot, "earth/earth-core.png", 1);
      writeFixtureAsset(fixtureRoot, "earth/earth-shield.png", 1);
      writeFixtureAsset(fixtureRoot, "ui/icon.svg", 1);
      writeFixtureAsset(fixtureRoot, "ui/splash.avif", 1);
      writeFixtureAsset(fixtureRoot, "audio/theme.aac", 1);

      const output = execFileSync(process.execPath, [script], { cwd: fixtureRoot, encoding: "utf8" });

      expect(output).toContain("files=5");
      expect(output).toContain("eagerAudio=1B/2097152B");
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });

  it("rejects combined eager audio above 2 MiB even when each file is below the single-asset limit", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "orbitslash-assets-"));
    const script = join(process.cwd(), "scripts", "check-asset-budget.mjs");
    try {
      writeFixtureAsset(fixtureRoot, "earth/earth-core.png", 1);
      writeFixtureAsset(fixtureRoot, "earth/earth-shield.png", 1);
      writeFixtureAsset(fixtureRoot, "audio/part-1.aac", 1_100_000);
      writeFixtureAsset(fixtureRoot, "audio/part-2.aac", 1_100_000);

      const result = spawnSync(process.execPath, [script], { cwd: fixtureRoot, encoding: "utf8" });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('"eagerAudioBytes": 2200000');
      expect(result.stderr).toContain('"maxEagerAudioBytes": 2097152');
      expect(result.stderr).toContain('"oversized": []');
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });
});

function writeFixtureAsset(root: string, relativePath: string, bytes: number): void {
  const path = join(root, "public", "assets", relativePath);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, Buffer.alloc(bytes));
}
