import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_SHELL_SAFE_AREA, AppShell, appShellLayoutMetrics, pauseOverlayLayout, safePauseOverlayLayout, settingsControlLayout } from "./AppShell";
import { computeRootFit } from "../game/coords";
import { MODE_IDS } from "../game/ModeConfig";
import { ProgressStore } from "../game/ProgressStore";
import { WebStubAdapter } from "../platform/WebStubAdapter";
import { getLocale, setLocale } from "../i18n";
import { BASE_HEIGHT, BASE_WIDTH } from "../game/coords";
import { defaultPlayerPreferences } from "../game/PlayerPreferencesStore";
import { RemoteConfig } from "../game/RemoteConfig";
import { weekKeyFor } from "../game/retention/WeeklyGoalRules";
import { Container, EventBoundary, FederatedPointerEvent, Graphics, Rectangle } from "pixi.js";

function labelsOf(node: { children?: unknown[]; label?: string }): string[] {
  const out: string[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const candidate = value as { label?: string; children?: unknown[] };
    if (candidate.label) out.push(candidate.label);
    candidate.children?.forEach(visit);
  };
  visit(node);
  return out;
}

function textsOf(node: { children?: unknown[]; text?: string }): string[] {
  const out: string[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const candidate = value as { text?: string; children?: unknown[] };
    if (typeof candidate.text === "string") out.push(candidate.text);
    candidate.children?.forEach(visit);
  };
  visit(node);
  return out;
}

function textByLabel(node: { children?: unknown[]; label?: string; text?: string }, label: string): string | undefined {
  let found: string | undefined;
  const visit = (value: unknown) => {
    if (found || !value || typeof value !== "object") return;
    const candidate = value as { label?: string; text?: string; children?: unknown[] };
    if (candidate.label === label && typeof candidate.text === "string") {
      found = candidate.text;
      return;
    }
    candidate.children?.forEach(visit);
  };
  visit(node);
  return found;
}

function nodeByLabel<T = any>(node: { children?: unknown[]; label?: string }, label: string): T | undefined {
  let found: T | undefined;
  const visit = (value: unknown) => {
    if (found || !value || typeof value !== "object") return;
    const candidate = value as { label?: string; children?: unknown[] };
    if (candidate.label === label) {
      found = candidate as T;
      return;
    }
    candidate.children?.forEach(visit);
  };
  visit(node);
  return found;
}

function visibleTextsOf(node: { children?: unknown[]; text?: string; visible?: boolean }): string[] {
  const out: string[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const candidate = value as { text?: string; children?: unknown[]; visible?: boolean };
    if (candidate.visible === false) return;
    if (typeof candidate.text === "string") out.push(candidate.text);
    candidate.children?.forEach(visit);
  };
  visit(node);
  return out;
}

function dispatchPixiPointer(root: Container, target: Container, type: "pointerdown" | "pointertap"): void {
  const boundary = new EventBoundary(root);
  const event = new FederatedPointerEvent(boundary);
  event.type = type;
  event.pointerId = 42;
  event.target = target;
  for (const node of boundary.propagationPath(target)) {
    (node as Container & { isInteractive?: () => boolean }).isInteractive ??= () => node.eventMode !== "none";
  }
  boundary.propagate(event, type);
}

describe("AppShell", () => {
  beforeEach(() => {
    setLocale("ko");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts on boot, can show loading, then returns to home", () => {
    const shell = new AppShell();

    expect(shell.screenVisibilitySnapshot()).toMatchObject({ boot: true, loading: false, home: false });
    expect(textsOf(shell.container)).toContain("궤도 준비 중");

    shell.showLoading();
    expect(shell.screenVisibilitySnapshot()).toMatchObject({ boot: false, loading: true, home: false });
    expect(textsOf(shell.container)).toContain("로딩");

    shell.showHome();
    expect(shell.screenVisibilitySnapshot()).toMatchObject({ boot: false, loading: false, home: true });
  });

  it("keeps app shell controls inside the logical mobile safe area", () => {
    const layout = appShellLayoutMetrics();
    const rects = [
      ...Object.values(layout.homeButtons),
      layout.homeSettingsTrigger,
      ...layout.modeCards.map((card) => card.rect),
      layout.bottomNav,
    ];

    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(APP_SHELL_SAFE_AREA.left);
      expect(rect.y).toBeGreaterThanOrEqual(APP_SHELL_SAFE_AREA.top);
      expect(rect.x + rect.w).toBeLessThanOrEqual(BASE_WIDTH - APP_SHELL_SAFE_AREA.right);
      expect(rect.y + rect.h).toBeLessThanOrEqual(BASE_HEIGHT - APP_SHELL_SAFE_AREA.bottom);
    }
  });

  it("uses an icon-only top-right settings trigger instead of the old bottom text control", () => {
    const shell = new AppShell();
    const openSettings = vi.fn();
    shell.onOpenSettings = openSettings;
    shell.showHome();

    const layout = appShellLayoutMetrics();
    const trigger = nodeByLabel<Container>(shell.container, "home-settings-trigger");
    const hitArea = trigger?.hitArea as Rectangle | null;
    const compactScale = computeRootFit(360, 800).scale;

    expect((layout.homeButtons as Record<string, unknown>).settings).toBeUndefined();
    expect(layout.homeSettingsTrigger.w).toBeGreaterThanOrEqual(96);
    expect(layout.homeSettingsTrigger.h).toBeGreaterThanOrEqual(96);
    expect(layout.homeSettingsTrigger.w * compactScale).toBeGreaterThanOrEqual(48);
    expect(layout.homeSettingsTrigger.h * compactScale).toBeGreaterThanOrEqual(48);
    expect(layout.homeSettingsTrigger.x).toBeGreaterThan(BASE_WIDTH / 2);
    expect(layout.homeSettingsTrigger.y).toBe(APP_SHELL_SAFE_AREA.top);
    expect(trigger).toBeTruthy();
    expect(trigger?.x).toBe(layout.homeSettingsTrigger.x);
    expect(trigger?.y).toBe(layout.homeSettingsTrigger.y);
    expect(hitArea?.width).toBe(layout.homeSettingsTrigger.w);
    expect(hitArea?.height).toBe(layout.homeSettingsTrigger.h);
    expect(trigger?.children.some((child) => child instanceof Graphics)).toBe(true);
    expect(textsOf(trigger ?? {})).toEqual([]);
    expect(visibleTextsOf(shell.container)).not.toContain("설정");

    dispatchPixiPointer(shell.container, trigger!, "pointertap");

    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(shell.modeCardCount()).toBe(6);
    expect(visibleTextsOf(shell.container)).toContain("컬렉션");
  });

  it("keeps the Home settings trigger at 48 CSS pixels across compact safe-area root fits", async () => {
    const safeArea = { top: 24, right: 24, bottom: 24, left: 24 };
    const base = await new ProgressStore(new WebStubAdapter()).load();
    const shell = new AppShell();
    shell.showHome({ ...base, onboarding: { ...base.onboarding, step: "solar_lance" } });

    for (const [width, height] of [[360, 640], [390, 640], [430, 640]] as const) {
      shell.setViewportMetrics({ width, height, safeArea });
      const fit = computeRootFit(width, height, safeArea);
      const layout = appShellLayoutMetrics({ width, height, safeArea });
      const trigger = nodeByLabel<Container>(shell.container, "home-settings-trigger")!;
      const hitArea = trigger.hitArea as Rectangle;

      expect(hitArea.width * fit.scale).toBeGreaterThanOrEqual(48);
      expect(hitArea.height * fit.scale).toBeGreaterThanOrEqual(48);
      expect(trigger.x).toBe(layout.homeSettingsTrigger.x);
      expect(trigger.y).toBe(APP_SHELL_SAFE_AREA.top);
      expect(trigger.x).toBeGreaterThanOrEqual(APP_SHELL_SAFE_AREA.left);
      expect(trigger.x + hitArea.width).toBeLessThanOrEqual(BASE_WIDTH - APP_SHELL_SAFE_AREA.right);
      expect(trigger.y + hitArea.height).toBeLessThanOrEqual(BASE_HEIGHT - APP_SHELL_SAFE_AREA.bottom);
      expect(labelsOf(shell.container).filter((label) => label === "home-settings-trigger")).toHaveLength(1);
      expect(textByLabel(shell.container, "home-primary-label")).toBe("훈련 계속하기");
    }
  });

  it("keeps the legacy Settings layout call at a 48 CSS-pixel touch target", () => {
    expect(settingsControlLayout(360).minimumCssTouchHeight).toBeGreaterThanOrEqual(48);
  });

  it("derives Settings touch height from root fit on compact safe-area viewports", () => {
    const safeArea = { top: 24, right: 24, bottom: 24, left: 24 };
    for (const [width, height] of [[360, 640], [390, 640], [430, 640]] as const) {
      const fit = computeRootFit(width, height, safeArea);
      const layout = settingsControlLayout(width, height, safeArea);
      expect(layout.rootFitScale).toBe(fit.scale);
      expect(layout.touchHeight * fit.scale).toBeGreaterThanOrEqual(48);
      expect(layout.minimumCssTouchHeight).toBeGreaterThanOrEqual(48);
    }
  });

  it("derives lifecycle resume touch height from root fit and keeps a safe layout on compact viewports", () => {
    const safe = safePauseOverlayLayout();
    for (const [width, height] of [[320, 568], [360, 800], [390, 844], [390, 640]] as const) {
      const layout = pauseOverlayLayout(width, height);
      const fit = computeRootFit(width, height);
      expect(layout.rootFitScale).toBe(fit.scale);
      expect(layout.minimumCssTouchHeight).toBeGreaterThanOrEqual(48);
      expect(safe.touchHeight * fit.scale).toBeGreaterThanOrEqual(48);
    }
    const constrained = pauseOverlayLayout(320, 568, { top: 24, right: 24, bottom: 24, left: 24 });
    expect(safe.touchHeight * constrained.rootFitScale).toBeGreaterThanOrEqual(48);
  });

  it("shows a localized lifecycle pause overlay that resumes only from its dedicated control", () => {
    const shell = new AppShell();
    const resume = vi.fn();
    shell.onResumeGame = resume;

    shell.showPauseOverlay();

    expect(shell.pauseOverlayVisible()).toBe(true);
    expect(visibleTextsOf(shell.container)).toEqual(expect.arrayContaining(["게임 일시 정지", "계속하기"]));

    shell.triggerPauseOverlayResume();

    expect(resume).toHaveBeenCalledOnce();
    expect(shell.pauseOverlayVisible()).toBe(false);
  });

  it("clears a lifecycle pause overlay when Home or Result replaces gameplay", () => {
    const shell = new AppShell();

    shell.showPauseOverlay();
    shell.showHome();
    expect(shell.pauseOverlayVisible()).toBe(false);

    shell.showPauseOverlay();
    shell.showResult({
      modeId: "story",
      difficulty: "rookie",
      endReason: "stage_objective_complete",
      survivalMs: 10_000,
      score: 100,
      kills: 1,
      maxCombo: 1,
      remainingEnergy: 100,
      rankingEligible: false,
      retryDestination: "modeSelect",
    });
    expect(shell.pauseOverlayVisible()).toBe(false);
  });

  it("consumes the actual Pixi resume pointer route before it can reach gameplay", () => {
    const shell = new AppShell();
    const root = new Container();
    const gameplay = new Container();
    const onPointerDown = vi.fn();
    const resume = vi.fn();
    gameplay.eventMode = "static";
    gameplay.on("pointerdown", onPointerDown);
    root.addChild(gameplay, shell.container);
    shell.onResumeGame = resume;
    shell.showPauseOverlay();

    const resumeButton = shell.container.getChildByLabel("lifecycle-pause-resume", true) as Container;
    dispatchPixiPointer(root, resumeButton, "pointerdown");
    dispatchPixiPointer(root, resumeButton, "pointertap");

    expect(resume).toHaveBeenCalledOnce();
    expect(onPointerDown).not.toHaveBeenCalled();

    dispatchPixiPointer(root, gameplay, "pointerdown");
    expect(onPointerDown).toHaveBeenCalledOnce();
  });

  it("consumes lifecycle backdrop and card pointer routes without resuming gameplay", () => {
    const shell = new AppShell();
    const root = new Container();
    const gameplay = new Container();
    const onPointerDown = vi.fn();
    const resume = vi.fn();
    gameplay.eventMode = "static";
    gameplay.on("pointerdown", onPointerDown);
    root.addChild(gameplay, shell.container);
    shell.onResumeGame = resume;
    shell.showPauseOverlay();

    const backdrop = shell.container.getChildByLabel("lifecycle-pause-backdrop", true) as Container;
    const card = shell.container.getChildByLabel("lifecycle-pause-card", true) as Container;
    dispatchPixiPointer(root, backdrop, "pointerdown");
    dispatchPixiPointer(root, card, "pointerdown");
    dispatchPixiPointer(root, card, "pointertap");

    expect(resume).not.toHaveBeenCalled();
    expect(onPointerDown).not.toHaveBeenCalled();
  });

  it("keeps the pause overlay static when reduced motion is enabled", () => {
    const shell = new AppShell();
    shell.triggerSettingsAction("reducedMotion");
    shell.showPauseOverlay();
    const overlay = shell.container.getChildByLabel("lifecycle-pause-overlay", true) as Container;
    const before = { alpha: overlay.alpha, scaleX: overlay.scale.x, scaleY: overlay.scale.y };

    shell.update(1_000);

    expect({ alpha: overlay.alpha, scaleX: overlay.scale.x, scaleY: overlay.scale.y }).toEqual(before);
  });

  it("reuses pause overlay display objects across lifecycle show and hide cycles", () => {
    const shell = new AppShell();
    const overlay = shell.container.getChildByLabel("lifecycle-pause-overlay", true) as Container;
    const initialChildren = [...overlay.children];
    const initialResume = shell.container.getChildByLabel("lifecycle-pause-resume", true);

    for (let i = 0; i < 5; i += 1) {
      shell.showPauseOverlay();
      shell.hidePauseOverlay();
    }

    expect(overlay.children).toHaveLength(initialChildren.length);
    initialChildren.forEach((child, index) => expect(overlay.children[index]).toBe(child));
    expect(shell.container.getChildByLabel("lifecycle-pause-resume", true)).toBe(initialResume);
  });

  it("builds visual image layers for home, mode select, and result screens", () => {
    const shell = new AppShell();

    expect(shell.visualLayerCount()).toMatchObject({
      home: expect.any(Number),
      modeSelect: expect.any(Number),
      result: expect.any(Number),
    });
    expect(shell.visualLayerCount().home).toBeGreaterThanOrEqual(5);
    expect(shell.visualLayerCount().modeSelect).toBe(MODE_IDS.length);
    expect(shell.visualLayerCount().result).toBeGreaterThanOrEqual(3);
  });

  it("renders one mode card for every planned mode", () => {
    const shell = new AppShell();

    shell.showModeSelect();

    expect(shell.modeCardCount()).toBe(MODE_IDS.length);
  });

  it("renders the six planned mode cards directly on the home screen", () => {
    const shell = new AppShell();

    shell.showHome();

    expect(shell.modeCardCount()).toBe(MODE_IDS.length);
    expect(visibleTextsOf(shell.container)).toEqual(expect.arrayContaining([
      "스토리",
      "자유 방어",
      "랭크",
      "보스 러시",
      "60초 블리츠",
      "데일리",
    ]));
  });

  it("renders truthful localized Home primary labels and exact onboarding hints", async () => {
    const base = await new ProgressStore(new WebStubAdapter()).load();
    const shell = new AppShell();
    const cases = [
      ["not_started", "첫 훈련 시작", "Story 1에서 유성 베기부터 배웁니다"],
      ["basic_slash", "훈련 계속하기", "유성 하나를 베어 보세요."],
      ["last_save", "훈련 계속하기", "지구 가까이 온 유성을 베어 Last Save를 만드세요."],
      ["solar_lance", "훈련 계속하기", "게이지가 차면 직선 제스처로 Solar Lance를 발사하세요."],
      ["reward", "훈련 계속하기", "첫 훈련 완료! 결과에서 새 보상을 확인하세요."],
      ["complete", "모드 선택", "해금된 모드에서 다음 전투를 고릅니다"],
    ] as const;

    for (const [step, label, hint] of cases) {
      shell.showHome({ ...base, onboarding: { ...base.onboarding, step } });
      expect(textByLabel(shell.container, "home-primary-label")).toBe(label);
      expect(textByLabel(shell.container, "home-primary-hint")).toBe(hint);
    }

    setLocale("en");
    for (const [step, label, hint] of [
      ["not_started", "Start First Training", "Learn Meteor Slash first in Story 1."],
      ["solar_lance", "Continue Training", "When charged, draw a line to fire Solar Lance."],
      ["complete", "Choose Mode", "Choose your next battle from unlocked modes."],
    ] as const) {
      shell.showHome({ ...base, onboarding: { ...base.onboarding, step } });
      expect(textByLabel(shell.container, "home-primary-label")).toBe(label);
      expect(textByLabel(shell.container, "home-primary-hint")).toBe(hint);
    }
  });

  it("keeps the Home primary button wired to the existing callback", () => {
    const shell = new AppShell();
    const root = new Container();
    const start = vi.fn();
    const fallbackStart = vi.fn();
    const fallbackModes = vi.fn();
    shell.onHomePrimaryStart = start;
    shell.onStartRun = fallbackStart;
    shell.onOpenModeSelect = fallbackModes;
    root.addChild(shell.container);
    shell.showHome();

    const primary = shell.container.getChildByLabel("home-primary", true) as Container;
    dispatchPixiPointer(root, primary, "pointertap");

    expect(start).toHaveBeenCalledOnce();
    expect(fallbackStart).not.toHaveBeenCalled();
    expect(fallbackModes).not.toHaveBeenCalled();
  });

  it("preserves onboarding progress when Settings returns Home without a new snapshot", async () => {
    const base = await new ProgressStore(new WebStubAdapter()).load();
    const shell = new AppShell();
    shell.showHome({ ...base, onboarding: { ...base.onboarding, step: "solar_lance" } });

    shell.showSettings();
    shell.triggerSettingsAction("back");

    expect(textByLabel(shell.container, "home-primary-label")).toBe("훈련 계속하기");
    expect(textByLabel(shell.container, "home-primary-hint")).toBe("게이지가 차면 직선 제스처로 Solar Lance를 발사하세요.");
  });

  it("uses truthful safe fallbacks for each Home presentation kind", async () => {
    const base = await new ProgressStore(new WebStubAdapter()).load();
    const root = new Container();
    const shell = new AppShell();
    const start = vi.fn();
    const openModes = vi.fn();
    shell.onStartRun = start;
    shell.onOpenModeSelect = openModes;
    root.addChild(shell.container);

    for (const step of ["not_started", "last_save"] as const) {
      shell.showHome({ ...base, onboarding: { ...base.onboarding, step } });
      const primary = shell.container.getChildByLabel("home-primary", true) as Container;
      dispatchPixiPointer(root, primary, "pointertap");
    }
    expect(start).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenNthCalledWith(1, "story", { storyStageId: "story-1" });
    expect(start).toHaveBeenNthCalledWith(2, "story", { storyStageId: "story-1" });

    shell.showHome({ ...base, onboarding: { ...base.onboarding, step: "complete" } });
    const completedPrimary = shell.container.getChildByLabel("home-primary", true) as Container;
    dispatchPixiPointer(root, completedPrimary, "pointertap");

    expect(openModes).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledTimes(2);
  });

  it("destroys replaced Home display subtrees without destroying shared texture sources", () => {
    const shell = new AppShell();
    shell.showHome();
    const oldPrimary = shell.container.getChildByLabel("home-primary", true) as Container;
    const oldEarth = shell.container.getChildByLabel("home-earth-sprite", true) as Container;

    shell.showHome();

    const newPrimary = shell.container.getChildByLabel("home-primary", true) as Container;
    const newEarth = shell.container.getChildByLabel("home-earth-sprite", true) as Container;
    expect(oldPrimary.destroyed).toBe(true);
    expect(oldEarth.destroyed).toBe(true);
    expect(newPrimary).not.toBe(oldPrimary);
    expect(newEarth).not.toBe(oldEarth);
    expect(newPrimary.destroyed).toBe(false);
    expect(newEarth.destroyed).toBe(false);
  });

  it("lays the six mode cards out as a 3x2 grid", () => {
    const shell = new AppShell();

    shell.showModeSelect();
    const layout = (shell as unknown as { modeCardLayoutSnapshot(): Array<{ modeId: string; x: number; y: number }> }).modeCardLayoutSnapshot();

    expect(layout.map((item) => item.modeId)).toEqual(MODE_IDS);
    expect(new Set(layout.slice(0, 3).map((item) => item.y)).size).toBe(1);
    expect(new Set(layout.slice(3, 6).map((item) => item.y)).size).toBe(1);
    expect(layout[3]!.y).toBeGreaterThan(layout[0]!.y);
    expect(layout.slice(0, 3).map((item) => item.x)).toEqual([...layout.slice(0, 3).map((item) => item.x)].sort((a, b) => a - b));
  });

  it("opens mode detail from mode cards instead of starting immediately", () => {
    const shell = new AppShell();
    const detail = vi.fn();
    const start = vi.fn();
    shell.onOpenModeDetail = detail;
    shell.onStartRun = start;

    shell.showModeSelect();
    shell.triggerModeCard("bossRush");

    expect(detail).toHaveBeenCalledWith("bossRush");
    expect(start).not.toHaveBeenCalled();
  });

  it("moves an unlock result from summary to localized reveal, then Collection", () => {
    const shell = new AppShell();
    const collection = vi.fn();
    shell.onOpenCollection = collection;
    shell.showResult({
      modeId: "story",
      difficulty: "rookie",
      endReason: "stage_objective_complete",
      survivalMs: 10_000,
      score: 100,
      kills: 1,
      maxCombo: 1,
      remainingEnergy: 100,
      rankingEligible: false,
      retryDestination: "modeSelect",
    }, {
      outcome: {
        snapshot: {} as never,
        delta: { newModes: [], newSkills: ["nova_pulse"], newBosses: [], newStoryStages: [], newCollectionEntries: [] },
      },
    });

    expect(nodeByLabel(shell.container, "result-unlock-reveal-action")?.visible).toBe(true);
    expect(nodeByLabel(shell.container, "result-collection-action")?.visible).toBe(false);
    expect(textByLabel(shell.container, "result-body")).toBe("");
    expect(nodeByLabel(shell.container, "result-unlock-card-0")?.visible).toBe(false);
    for (const label of [
      "result-unlock-nova-card",
      "result-unlock-nova-gesture",
      "result-unlock-nova-instruction",
      "result-unlock-nova-meta",
      "result-unlock-nova-contrast",
    ]) {
      expect(nodeByLabel(shell.container, label)?.visible).toBe(false);
    }
    shell.triggerResultAction("unlockReveal");
    expect(nodeByLabel(shell.container, "result-collection-action")?.visible).toBe(true);
    expect(nodeByLabel(shell.container, "result-unlock-card-0")?.visible).toBe(true);
    expect(textsOf(nodeByLabel(shell.container, "result-unlock-card-0")!)).toContain("노바 펄스");
    expect(textByLabel(shell.container, "result-unlock-nova-instruction")?.replace(/\s+/g, " ")).toBe("지구 표면 가까이에서 시작해 바깥쪽으로 빠르고 곧게 플릭");
    expect(textByLabel(shell.container, "result-unlock-nova-meta")).toBe("게이지 64 · 쿨타임 18초");
    expect(textByLabel(shell.container, "result-unlock-nova-contrast")).toBe("솔라 랜스는 지구를 가로지르는 긴 직선");
    expect(nodeByLabel(shell.container, "result-unlock-nova-gesture")).toBeTruthy();
    expect(textByLabel(shell.container, "result-body")).not.toContain("nova_pulse");
    shell.triggerResultAction("collection");
    expect(collection).toHaveBeenCalledOnce();
  });

  it("reads the featured Nova guide cost and cooldown from active RemoteConfig", () => {
    const skills = RemoteConfig.getSkills();
    const configSpy = vi.spyOn(RemoteConfig, "getSkills").mockReturnValue({
      ...skills,
      nova_pulse: { ...skills.nova_pulse, gaugeCost: 73, cooldownSec: 21 },
    });
    const shell = new AppShell();
    shell.showResult({
      modeId: "story",
      difficulty: "rookie",
      endReason: "stage_objective_complete",
      survivalMs: 10_000,
      score: 100,
      kills: 1,
      maxCombo: 1,
      remainingEnergy: 100,
      rankingEligible: false,
      retryDestination: "modeSelect",
    }, {
      outcome: {
        snapshot: {} as never,
        delta: { newModes: [], newSkills: ["nova_pulse"], newBosses: [], newStoryStages: [], newCollectionEntries: [] },
      },
    });
    shell.triggerResultAction("unlockReveal");

    expect(textByLabel(shell.container, "result-unlock-nova-meta")).toBe("게이지 73 · 쿨타임 21초");
    configSpy.mockRestore();
  });

  it("uses the shipped-safe Nova fallback when active RemoteConfig is invalid", () => {
    const skills = RemoteConfig.getSkills();
    const configSpy = vi.spyOn(RemoteConfig, "getSkills").mockReturnValue({
      ...skills,
      nova_pulse: null,
    } as never);
    const shell = new AppShell();
    shell.showResult({
      modeId: "story",
      difficulty: "rookie",
      endReason: "stage_objective_complete",
      survivalMs: 10_000,
      score: 100,
      kills: 1,
      maxCombo: 1,
      remainingEnergy: 100,
      rankingEligible: false,
      retryDestination: "modeSelect",
    }, {
      outcome: {
        snapshot: {} as never,
        delta: { newModes: [], newSkills: ["nova_pulse"], newBosses: [], newStoryStages: [], newCollectionEntries: [] },
      },
    });
    shell.triggerResultAction("unlockReveal");

    expect(textByLabel(shell.container, "result-unlock-nova-meta")).toBe("게이지 64 · 쿨타임 18초");
    configSpy.mockRestore();
  });

  it.each(["ko", "en"] as const)("keeps every featured Nova guide element inside non-overlapping %s bounds", (locale) => {
    setLocale(locale);
    const shell = new AppShell();
    shell.showResult({
      modeId: "story",
      difficulty: "rookie",
      endReason: "stage_objective_complete",
      survivalMs: 10_000,
      score: 100,
      kills: 1,
      maxCombo: 1,
      remainingEnergy: 100,
      rankingEligible: false,
      retryDestination: "modeSelect",
    }, {
      outcome: {
        snapshot: {} as never,
        delta: { newModes: [], newSkills: ["nova_pulse"], newBosses: [], newStoryStages: [], newCollectionEntries: [] },
      },
    });
    shell.triggerResultAction("unlockReveal");

    const card = nodeByLabel<any>(shell.container, "result-unlock-nova-card");
    const gesture = nodeByLabel<any>(shell.container, "result-unlock-nova-gesture");
    const title = nodeByLabel<any>(shell.container, "result-unlock-nova-title");
    const instruction = nodeByLabel<any>(shell.container, "result-unlock-nova-instruction");
    const meta = nodeByLabel<any>(shell.container, "result-unlock-nova-meta");
    const contrast = nodeByLabel<any>(shell.container, "result-unlock-nova-contrast");
    const gestureBounds = gesture.getLocalBounds();
    const expectedPhrase = locale === "ko"
      ? "지구 표면 가까이에서 시작해 바깥쪽으로 빠르고 곧게 플릭"
      : "Start close to Earth's surface, then flick outward fast and straight";

    expect(instruction.text.split("\n")).toHaveLength(2);
    expect(instruction.style.wordWrap).toBe(false);
    expect(instruction.hitArea.height).toBe(instruction.style.lineHeight * 2);
    expect(instruction.text.replace(/\s+/g, " ")).toBe(expectedPhrase);
    expect(gestureBounds.x + gestureBounds.width).toBeLessThanOrEqual(title.x);
    expect(gestureBounds.x + gestureBounds.width).toBeLessThanOrEqual(instruction.x);
    expect(title.y + title.hitArea.height).toBeLessThanOrEqual(instruction.y);
    expect(instruction.y + instruction.hitArea.height).toBeLessThanOrEqual(meta.y);
    expect(meta.y + meta.hitArea.height).toBeLessThanOrEqual(contrast.y);
    expect(contrast.y + contrast.hitArea.height).toBeLessThanOrEqual(card.hitArea.height);
  });

  it("renders dense results as semantic stat, detail, unlock, and action nodes", () => {
    const shell = new AppShell();
    shell.setViewportMetrics({ width: 360, height: 800 });
    shell.showResult({
      modeId: "bossRush",
      difficulty: "master",
      endReason: "boss_sequence_complete",
      survivalMs: 125_000,
      score: 19_345,
      kills: 80,
      bossKills: 5,
      defeatedBossIds: ["eclipse_core", "ringed_destroyer", "lava_titan", "ice_colossus", "dark_planet"],
      maxCombo: 9,
      remainingEnergy: 0,
      rankingEligible: false,
      rankingSubmissionState: "notEligible",
      retryDestination: "modeSelect",
      objectiveOutcome: "cleared",
    }, {
      outcome: {
        snapshot: {} as never,
        delta: {
          newModes: ["bossRush", "ranked"],
          newSkills: ["nova_pulse"],
          newBosses: ["ringed_destroyer"],
          newStoryStages: [2],
          newCollectionEntries: [
            { kind: "boss", id: "ringed_destroyer" },
            { kind: "title", id: "bossBreaker" },
          ],
        },
      },
    });

    for (const id of ["score", "time", "combo", "energy"]) {
      expect(nodeByLabel(shell.container, `result-stat-${id}`)).toBeTruthy();
    }
    expect(nodeByLabel(shell.container, "result-detail-card")).toBeTruthy();
    for (const id of ["mode", "boss-progress", "objective", "ranking"]) {
      expect(nodeByLabel(shell.container, `result-detail-${id}`)).toBeTruthy();
    }
    expect(textByLabel(shell.container, "result-body")).toBe("");
    expect(nodeByLabel(shell.container, "result-panel-success")).toBeTruthy();
    expect(nodeByLabel(shell.container, "result-primary-action-modeSelect")).toBeTruthy();
    for (const action of ["retry", "modeSelect", "home"]) {
      expect(nodeByLabel(shell.container, `result-action-${action}`)).toBeTruthy();
    }

    shell.triggerResultAction("unlockReveal");
    for (let index = 0; index < 7; index += 1) {
      expect(nodeByLabel(shell.container, `result-unlock-card-${index}`)?.visible).toBe(true);
    }
    const bossUnlock = textsOf(nodeByLabel(shell.container, "result-unlock-card-3")!).join(" ");
    const bossCodex = textsOf(nodeByLabel(shell.container, "result-unlock-card-4")!).join(" ");
    expect(bossUnlock).toContain("보스 해금");
    expect(bossCodex).toContain("도감 등록");
    expect(bossUnlock).not.toBe(bossCodex);
    expect(textsOf(shell.container).join("\n")).not.toMatch(/nova_pulse|ringed_destroyer|bossRush/);
  });

  it.each([
    ["sameRun", "retry"],
    ["modeSelect", "modeSelect"],
    ["home", "home"],
  ] as const)("emphasizes the %s retry destination", (retryDestination, action) => {
    const shell = new AppShell();
    shell.showResult({
      modeId: "freeDefense",
      difficulty: "rookie",
      endReason: "earth_destroyed",
      survivalMs: 1_000,
      score: 10,
      kills: 1,
      maxCombo: 1,
      remainingEnergy: 0,
      rankingEligible: false,
      retryDestination,
    });

    expect(nodeByLabel(shell.container, `result-primary-action-${action}`)).toBeTruthy();
  });

  it("preserves the unlock outcome and reveal step while ranked data updates", () => {
    const shell = new AppShell();
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
    shell.showResult(result, {
      runSource: "play",
      outcome: {
        snapshot: {} as never,
        delta: { newModes: [], newSkills: ["nova_pulse"], newBosses: [], newStoryStages: [], newCollectionEntries: [] },
      },
    });
    shell.triggerResultAction("unlockReveal");
    const oldScoreCard = nodeByLabel<any>(shell.container, "result-stat-score");
    const oldScoreDestroy = vi.spyOn(oldScoreCard, "destroy");

    shell.updateResult({ ...result, rankingSubmissionState: "submitted" });

    const nextScoreCard = nodeByLabel<any>(shell.container, "result-stat-score");
    expect(oldScoreDestroy).toHaveBeenCalled();
    expect(nextScoreCard).not.toBe(oldScoreCard);
    expect(nextScoreCard.destroyed).toBe(false);
    expect(nodeByLabel(shell.container, "result-collection-action")?.visible).toBe(true);
    expect(nodeByLabel(shell.container, "result-unlock-card-0")?.visible).toBe(true);
    expect(textsOf(nodeByLabel(shell.container, "result-detail-ranking")!)).toContain("랭킹: 제출 완료");
  });

  it.each([
    [360, 800],
    [390, 844],
    [430, 932],
  ])("keeps result actions at least 48 CSS px at %sx%s", (width, height) => {
    const shell = new AppShell();
    shell.setViewportMetrics({ width, height, safeArea: { top: 20, right: 0, bottom: 24, left: 0 } });
    shell.showResult({
      modeId: "freeDefense",
      difficulty: "rookie",
      endReason: "earth_destroyed",
      survivalMs: 1_000,
      score: 10,
      kills: 1,
      maxCombo: 1,
      remainingEnergy: 0,
      rankingEligible: false,
      retryDestination: "sameRun",
    });
    const fit = computeRootFit(width, height, { top: 20, right: 0, bottom: 24, left: 0 });

    for (const action of ["retry", "modeSelect", "home"]) {
      const node = nodeByLabel<any>(shell.container, `result-action-${action}`);
      expect(node.hitArea.height * fit.scale).toBeGreaterThanOrEqual(48);
    }
  });

  it("keeps all six mode detail start actions wired to the expected launch payloads", () => {
    const expectedCalls = [
      ["story", { storyStageId: "story-1" }],
      ["freeDefense", { difficulty: "rookie", freeDefensePreset: "standard", practiceBossId: undefined }],
      ["ranked", { difficulty: "rookie" }],
      ["bossRush"],
      ["blitz60"],
      ["daily"],
    ] as const;

    for (const [modeId] of expectedCalls) {
      const shell = new AppShell();
      const start = vi.fn();
      shell.onStartRun = start;

      shell.showModeDetail(modeId);
      shell.triggerModeDetailAction("start");

      expect(start.mock.calls[0]).toEqual(expectedCalls.find(([id]) => id === modeId));
    }
  });

  it("renders locked mode detail and blocks start until progress unlocks it", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);
    const shell = new AppShell();
    const start = vi.fn();
    shell.onStartRun = start;

    shell.showModeDetail("bossRush", await store.load());
    shell.triggerModeDetailAction("start");
    expect(textsOf(shell.container)).toContain("잠김");
    expect(start).not.toHaveBeenCalled();

    await store.recordResult({
      modeId: "freeDefense",
      difficulty: "rookie",
      endReason: "earth_destroyed",
      survivalMs: 60000,
      score: 2500,
      kills: 20,
      bossKills: 1,
      defeatedBossIds: ["eclipse_core"],
      maxCombo: 5,
      remainingEnergy: 20,
      rankingEligible: false,
      rankingSubmissionState: "notEligible",
      retryDestination: "sameRun",
    });
    shell.showModeDetail("bossRush", await store.load());
    shell.triggerModeDetailAction("start");

    expect(textsOf(shell.container)).toContain("보스 러시 준비");
    expect(start).toHaveBeenCalledWith("bossRush");
  });

  it("renders Story chapter count and tutorial messaging in mode detail", () => {
    const shell = new AppShell();

    shell.showModeDetail("story");
    const text = textsOf(shell.container).join("\n");

    expect(text).toContain("8챕터");
    expect(text).toContain("32스테이지");
    expect(text).toContain("튜토리얼");
    expect(text).toContain("현재 스테이지: 첫 베기");
    expect(text).toContain("첫 베기");
    expect(text).toContain("해금 1/32");
  });

  it("updates Story detail preview, tutorial copy, and unlock summary for a selected unlocked stage", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);
    await store.recordResult({
      modeId: "story",
      difficulty: "rookie",
      endReason: "stage_objective_complete",
      survivalMs: 30000,
      score: 900,
      kills: 6,
      maxCombo: 3,
      remainingEnergy: 80,
      rankingEligible: false,
      retryDestination: "modeSelect",
      activeStoryStageId: "story-1",
      objectiveOutcome: "cleared",
    });
    const shell = new AppShell();

    shell.showModeDetail("story", await store.load());
    (shell as unknown as { triggerModeDetailChoice(choice: string): void }).triggerModeDetailChoice("storyStage:story-2");
    const text = textsOf(shell.container).join("\n");

    expect(text).toContain("8챕터");
    expect(text).toContain("32스테이지");
    expect(text).toContain("현재 스테이지: 라스트 세이브");
    expect(text).toContain("튜토리얼: 지구 가까이 들어온 적을 마지막 순간에 막아 라스트 세이브를 만듭니다");
    expect(text).toContain("해금 2/32");
    expect(text).not.toContain("story-2");
  });

  it("starts Story with a selected unlocked stage", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);
    await store.recordResult({
      modeId: "story",
      difficulty: "rookie",
      endReason: "stage_objective_complete",
      survivalMs: 30000,
      score: 900,
      kills: 6,
      maxCombo: 3,
      remainingEnergy: 80,
      rankingEligible: false,
      retryDestination: "modeSelect",
      activeStoryStageId: "story-1",
      objectiveOutcome: "cleared",
    });
    const shell = new AppShell();
    const start = vi.fn();
    shell.onStartRun = start;

    shell.showModeDetail("story", await store.load());
    (shell as unknown as { triggerModeDetailChoice(choice: string): void }).triggerModeDetailChoice("storyStage:story-2");
    shell.triggerModeDetailAction("start");

    expect(start).toHaveBeenCalledWith("story", { storyStageId: "story-2" });
  });

  it("blocks locked Story stage selection and keeps raw story ids out of shell copy", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);
    const shell = new AppShell();
    const start = vi.fn();
    shell.onStartRun = start;

    shell.showModeDetail("story", await store.load());
    (shell as unknown as { triggerModeDetailChoice(choice: string): void }).triggerModeDetailChoice("storyStage:story-2");
    shell.triggerModeDetailAction("start");

    const text = textsOf(shell.container).join("\n");
    expect(start).toHaveBeenCalledWith("story", { storyStageId: "story-1" });
    expect(text).toContain("현재 스테이지: 첫 베기");
    expect(text).not.toContain("story-1");
    expect(text).not.toContain("story-2");
  });

  it("lets Free Defense choose difficulty, practice preset, and practice boss before start", () => {
    const shell = new AppShell();
    const start = vi.fn();
    shell.onStartRun = start;

    shell.showModeDetail("freeDefense");
    const before = textsOf(shell.container).join("\n");
    expect(before).toContain("난이도");
    expect(before).toContain("루키");
    expect(before).toContain("마스터");
    expect(before).toContain("스킬 연습");
    expect(before).toContain("보스 연습");
    expect(before).toContain("Lava Titan");

    (shell as unknown as { triggerModeDetailChoice(choice: string): void }).triggerModeDetailChoice("difficulty:elite");
    (shell as unknown as { triggerModeDetailChoice(choice: string): void }).triggerModeDetailChoice("freeDefensePreset:bossPractice");
    (shell as unknown as { triggerModeDetailChoice(choice: string): void }).triggerModeDetailChoice("practiceBoss:lava_titan");
    shell.triggerModeDetailAction("start");

    expect(start).toHaveBeenCalledWith("freeDefense", {
      difficulty: "elite",
      freeDefensePreset: "bossPractice",
      practiceBossId: "lava_titan",
    });
  });

  it("shows the Free Defense daily standard-play limit in mode detail", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);
    for (let i = 0; i < 5; i += 1) {
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

    const shell = new AppShell();
    shell.showModeDetail("freeDefense", await store.load());

    expect(textsOf(shell.container).join("\n")).toContain("오늘 5/5");
  });

  it("locks Free Defense standard start at the daily limit while keeping practice presets startable", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);
    for (let i = 0; i < 5; i += 1) {
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
    const shell = new AppShell();
    const start = vi.fn();
    shell.onStartRun = start;

    shell.showModeDetail("freeDefense", await store.load());
    expect(textsOf(shell.container).join("\n")).toContain("표준 플레이 잠김");
    shell.triggerModeDetailAction("start");
    expect(start).not.toHaveBeenCalled();

    (shell as unknown as { triggerModeDetailChoice(choice: string): void }).triggerModeDetailChoice("freeDefensePreset:skillPractice");
    shell.triggerModeDetailAction("start");
    expect(start).toHaveBeenCalledWith("freeDefense", {
      difficulty: "rookie",
      freeDefensePreset: "skillPractice",
      practiceBossId: undefined,
    });
  });

  it("shows Free Defense ad revive as locked until rewarded-ad telemetry and adapters are ready", () => {
    const shell = new AppShell();

    shell.showModeDetail("freeDefense");
    const text = textsOf(shell.container).join("\n");

    expect(text).toContain("광고 부활");
    expect(text).toContain("준비 중");
    expect(text).not.toContain("광고 보고 부활");
  });

  it("renders Boss Rush intro sequence, weak-point hint, and local ranking state", () => {
    const shell = new AppShell();

    shell.showModeDetail("bossRush");
    const text = textsOf(shell.container).join("\n");

    expect(text).toContain("Ringed Destroyer");
    expect(text).toContain("Dark Planet");
    expect(text).toContain("Ringed Destroyer -> Eclipse Core -> Lava Titan -> Ice Colossus -> Dark Planet");
    expect(text).toContain("약점");
    expect(text).toContain("로컬 기록");
    expect(text).not.toContain("ringed_destroyer");
    expect(text).not.toContain("dark_planet");
  });

  it("lets Ranked choose difficulty before start", () => {
    const shell = new AppShell();
    const start = vi.fn();
    shell.onStartRun = start;

    shell.showModeDetail("ranked");
    const before = textsOf(shell.container).join("\n");
    expect(before).toContain("난이도");
    expect(before).toContain("마스터");

    (shell as unknown as { triggerModeDetailChoice(choice: string): void }).triggerModeDetailChoice("difficulty:master");
    shell.triggerModeDetailAction("start");

    expect(start).toHaveBeenCalledWith("ranked", { difficulty: "master" });
  });

  it("renders a records skeleton with local records and ranked status", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);
    await store.recordResult({
      modeId: "freeDefense",
      difficulty: "rookie",
      endReason: "earth_destroyed",
      survivalMs: 42000,
      score: 1200,
      kills: 12,
      maxCombo: 4,
      remainingEnergy: 0,
      rankingEligible: false,
      retryDestination: "sameRun",
    });

    const shell = new AppShell();
    shell.showRecords(await store.load());
    const texts = textsOf(shell.container);

    expect(texts).toContain("기록");
    expect(texts.some((text) => text.includes("자유 방어") && text.includes("1,200"))).toBe(true);
    expect(texts).toContain("검증 랭킹 잠김");
    expect(texts).toContain("서버 검증과 계정 연결 기록 확인 후 공개");
  });

  it("can render verified leaderboard live state when the backend boundary opens", () => {
    const shell = new AppShell();

    shell.showRecords(undefined, { publicAvailable: true, reason: "ready" }, [
      {
        rank: 1,
        score: 9800,
        survivalMs: 120000,
        kills: 88,
        maxCombo: 14,
        difficulty: "elite",
        createdAt: "2026-07-05T00:00:00.000Z",
      },
    ]);

    const texts = textsOf(shell.container);
    expect(texts).toContain("검증 랭킹 공개");
    expect(texts).toContain("검증된 순위표가 표시됩니다");
    expect(texts).not.toContain("서버 검증 랭킹 연결 대기");
    expect(texts.join("\n")).toContain("#1 · 9,800 · 120s · 88K · x14");
  });

  it("renders story and daily progression details in local records", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);
    await store.recordResult({
      modeId: "story",
      difficulty: "rookie",
      endReason: "stage_objective_complete",
      survivalMs: 30000,
      score: 900,
      kills: 6,
      maxCombo: 3,
      remainingEnergy: 80,
      rankingEligible: false,
      retryDestination: "modeSelect",
      activeStoryStageId: "story-2",
      objectiveOutcome: "cleared",
    });
    await store.recordResult({
      modeId: "daily",
      difficulty: "defender",
      endReason: "stage_objective_complete",
      survivalMs: 60000,
      score: 1200,
      kills: 8,
      maxCombo: 4,
      remainingEnergy: 70,
      rankingEligible: false,
      retryDestination: "modeSelect",
      activeDailyModifierId: "lastSaveDay",
      objectiveOutcome: "cleared",
    });

    const shell = new AppShell();
    shell.showRecords(await store.load());
    const text = textsOf(shell.container).join("\n");

    expect(text).toContain("스토리 클리어: 1/32");
    expect(text).toContain("라스트 세이브");
    expect(text).toContain("데일리 클리어: 1");
    expect(text).toContain("라스트 세이브 데이");
    expect(text).not.toContain("lastSaveDay");
  });

  it("shows Boss Rush progress by best defeated boss count", async () => {
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);
    await store.recordResult({
      modeId: "bossRush",
      difficulty: "defender",
      endReason: "earth_destroyed",
      survivalMs: 90000,
      score: 5000,
      kills: 30,
      bossKills: 3,
      defeatedBossIds: ["ringed_destroyer", "eclipse_core", "lava_titan"],
      maxCombo: 8,
      remainingEnergy: 20,
      rankingEligible: false,
      retryDestination: "sameRun",
      objectiveOutcome: "failed",
    });

    const shell = new AppShell();
    shell.showRecords(await store.load());
    const text = textsOf(shell.container).join("\n");

    expect(text).toContain("최고 보스 3체");
  });

  it("exposes retry, mode select, and home actions from result", () => {
    const shell = new AppShell();
    const retry = vi.fn();
    const modeSelect = vi.fn();
    const home = vi.fn();
    shell.onRetry = retry;
    shell.onOpenModeSelect = modeSelect;
    shell.onHome = home;

    shell.showResult({
      modeId: "freeDefense",
      difficulty: "rookie",
      endReason: "earth_destroyed",
      survivalMs: 1000,
      score: 10,
      kills: 1,
      maxCombo: 1,
      remainingEnergy: 0,
      rankingEligible: false,
      retryDestination: "sameRun",
    });
    shell.triggerResultAction("retry");
    shell.triggerResultAction("modeSelect");
    shell.triggerResultAction("home");

    expect(retry).toHaveBeenCalledTimes(1);
    expect(modeSelect).toHaveBeenCalledTimes(1);
    expect(home).toHaveBeenCalledTimes(1);
  });

  it("marks DEV QA results as non-progress on the result screen", () => {
    const shell = new AppShell();

    shell.showResult(
      {
        modeId: "bossRush",
        difficulty: "rookie",
        endReason: "earth_destroyed",
        survivalMs: 1000,
        score: 10,
        kills: 1,
        maxCombo: 1,
        remainingEnergy: 0,
        rankingEligible: false,
        retryDestination: "sameRun",
      },
      { runSource: "devQa" },
    );

    expect(textsOf(shell.container).some((text) => text.includes("DEV QA") && text.includes("진행도 저장 안 함"))).toBe(true);
  });

  it("keeps dense result sections separated from the action row", () => {
    const shell = new AppShell();

    shell.showResult(
      {
        modeId: "bossRush",
        difficulty: "master",
        endReason: "boss_sequence_complete",
        survivalMs: 125000,
        score: 19345,
        kills: 80,
        bossKills: 5,
        defeatedBossIds: ["eclipse_core", "ringed_destroyer", "lava_titan", "ice_colossus", "dark_planet"],
        maxCombo: 9,
        remainingEnergy: 0,
        rankingEligible: false,
        rankingSubmissionState: "notEligible",
        retryDestination: "sameRun",
        objectiveOutcome: "cleared",
      },
      { runSource: "devQa" },
    );

    const detail = nodeByLabel<any>(shell.container, "result-detail-card");
    const actions = nodeByLabel<any>(shell.container, "result-action-row");
    expect(textByLabel(shell.container, "result-stat-score-value")).toBe("19,345");
    expect(detail.y + detail.hitArea.height).toBeLessThan(actions.y);
    expect(textByLabel(shell.container, "result-body")).toBe("");
  });

  it("renders mode-specific result stats for story, boss rush, blitz, daily, and ranked", () => {
    const shell = new AppShell();

    shell.showResult({
      modeId: "story",
      difficulty: "rookie",
      endReason: "stage_objective_complete",
      survivalMs: 30000,
      score: 900,
      kills: 6,
      maxCombo: 3,
      remainingEnergy: 80,
      rankingEligible: false,
      retryDestination: "modeSelect",
      activeStoryStageId: "story-2",
      objectiveOutcome: "cleared",
    });
    expect(textByLabel(shell.container, "result-title")).toBe("클리어");
    expect(textsOf(shell.container).some((text) => text.includes("스토리: 라스트 세이브"))).toBe(true);
    expect(textsOf(shell.container).some((text) => text.includes("story-2"))).toBe(false);

    shell.showResult({
      modeId: "bossRush",
      difficulty: "defender",
      endReason: "boss_sequence_complete",
      survivalMs: 90000,
      score: 5000,
      kills: 30,
      bossKills: 2,
      defeatedBossIds: ["eclipse_core", "ringed_destroyer"],
      maxCombo: 8,
      remainingEnergy: 20,
      rankingEligible: false,
      rankingSubmissionState: "notEligible",
      retryDestination: "sameRun",
    });
    expect(textByLabel(shell.container, "result-title")).toBe("클리어");
    expect(textsOf(shell.container).some((text) => text.includes("보스 처치: 2"))).toBe(true);
    expect(textsOf(nodeByLabel(shell.container, "result-detail-boss-progress")!).join(" ")).toContain("2/5");
    expect(textByLabel(shell.container, "result-stat-score-value")).toBe("5,000");
    expect(textByLabel(shell.container, "result-stat-time-value")).toBe("90초");
    expect(textByLabel(shell.container, "result-stat-energy-value")).toBe("20");
    expect(textsOf(shell.container).some((text) => text.includes("랭킹: 랭킹 제외"))).toBe(true);
    expect(textsOf(shell.container).some((text) => text.includes("eclipse_core"))).toBe(false);

    shell.showResult({
      modeId: "blitz60",
      difficulty: "rookie",
      endReason: "timer_expired",
      survivalMs: 60000,
      score: 4100,
      kills: 36,
      maxCombo: 9,
      remainingEnergy: 35,
      rankingEligible: false,
      retryDestination: "modeSelect",
      objectiveOutcome: "survived",
    });
    expect(textByLabel(shell.container, "result-title")).toBe("생존");
    expect(textsOf(shell.container).some((text) => text.includes("목표: 생존"))).toBe(true);
    expect(textsOf(shell.container).some((text) => text.includes("timer_expired"))).toBe(false);

    shell.showResult({
      modeId: "daily",
      difficulty: "defender",
      endReason: "daily_challenge_failed",
      survivalMs: 30000,
      score: 100,
      kills: 2,
      maxCombo: 1,
      remainingEnergy: 0,
      rankingEligible: false,
      retryDestination: "sameRun",
      activeDailyModifierId: "lastSaveDay",
      objectiveOutcome: "failed",
    });
    expect(textByLabel(shell.container, "result-title")).toBe("게임 오버");
    expect(textsOf(shell.container).some((text) => text.includes("목표: 실패"))).toBe(true);
    expect(textsOf(shell.container).some((text) => text.includes("데일리: 라스트 세이브 데이"))).toBe(true);
    expect(textsOf(shell.container).some((text) => text.includes("lastSaveDay"))).toBe(false);

    shell.showResult({
      modeId: "ranked",
      difficulty: "rookie",
      endReason: "earth_destroyed",
      survivalMs: 20000,
      score: 900,
      kills: 9,
      maxCombo: 3,
      remainingEnergy: 0,
      rankingEligible: true,
      retryDestination: "modeSelect",
      rankingSubmissionState: "localOnly",
    });
    expect(textByLabel(shell.container, "result-title")).toBe("게임 오버");
    expect(textsOf(shell.container).some((text) => text.includes("랭킹: 로컬 전용"))).toBe(true);
    expect(textsOf(shell.container).some((text) => text.includes("localOnly"))).toBe(false);
  });

  it("opens settings and switches the shell locale to English", () => {
    const shell = new AppShell();

    shell.triggerHomeAction("settings");
    expect(textsOf(shell.container)).toContain("언어");

    shell.triggerSettingsAction("locale:en");
    expect(getLocale()).toBe("en");
    expect(textsOf(shell.container)).toContain("Language");

    shell.showModeSelect();
    const text = textsOf(shell.container).join("\n");
    expect(text).toContain("Free Defense");
    expect(text).not.toContain("자유 방어");
  });

  it("exposes persistent feedback preference toggles from Settings", () => {
    const shell = new AppShell();
    const changed = vi.fn();
    shell.onPreferencesChange = changed;
    shell.showSettings(defaultPlayerPreferences());

    shell.triggerSettingsAction("haptic");

    expect(changed).toHaveBeenCalledWith({ hapticEnabled: false });
  });

  it("renders truthful localized account and share presentation states", () => {
    const shell = new AppShell();

    shell.showSettings(undefined, { account: { status: "anonymous" }, share: "idle" });
    expect(textByLabel(shell.container, "settings-account-status")).toBe("로그인되지 않았습니다");
    expect(textByLabel(shell.container, "settings-share-status")).toBe("공유할 수 있습니다");
    expect(textByLabel(shell.container, "settings-invite-coming-soon")).toBe("초대 코드 공유는 준비 중입니다");
    expect(nodeByLabel(shell.container, "settings-login")).toBeTruthy();
    expect(nodeByLabel(shell.container, "settings-share")).toBeTruthy();

    shell.showSettings(undefined, { account: { status: "loading" }, share: "sharing" });
    expect(textByLabel(shell.container, "settings-account-status")).toBe("계정 연결 확인 중");
    expect(textByLabel(shell.container, "settings-share-status")).toBe("공유 중");
    expect(nodeByLabel(shell.container, "settings-login")).toBeUndefined();

    shell.showSettings(undefined, { account: { status: "linked", provider: "apps_in_toss" }, share: "success" });
    expect(textByLabel(shell.container, "settings-account-status")).toBe("토스 계정 연결됨");
    expect(textByLabel(shell.container, "settings-share-status")).toBe("공유 완료");
    expect(textsOf(shell.container).join("\n")).not.toMatch(/user[_ -]?id/i);
    expect(nodeByLabel(shell.container, "settings-login")).toBeUndefined();

    shell.showSettings(undefined, { account: { status: "error", reason: "unavailable" }, share: "error" });
    expect(textByLabel(shell.container, "settings-account-status")).toBe("계정 연결을 사용할 수 없습니다");
    expect(textByLabel(shell.container, "settings-share-status")).toBe("공유하지 못했습니다");
    expect(nodeByLabel(shell.container, "settings-login")).toBeTruthy();

    shell.triggerSettingsAction("locale:en");
    expect(textByLabel(shell.container, "settings-account-status")).toBe("Account connection is unavailable");
    expect(textByLabel(shell.container, "settings-share-status")).toBe("Could not share");
    expect(textByLabel(shell.container, "settings-invite-coming-soon")).toBe("Invite-code sharing coming soon");
  });

  it("maps linked providers to safe localized labels and never renders unknown raw provider values", () => {
    const shell = new AppShell();

    shell.showSettings(undefined, { account: { status: "linked", provider: "google_play" } });
    expect(textByLabel(shell.container, "settings-account-status")).toBe("Google Play 계정 연결됨");

    shell.showSettings(undefined, { account: { status: "linked", provider: "core-user-secret" } });
    expect(textByLabel(shell.container, "settings-account-status")).toBe("계정 연결됨");
    expect(textsOf(shell.container).join("\n")).not.toContain("core-user-secret");

    shell.triggerSettingsAction("locale:en");
    expect(textByLabel(shell.container, "settings-account-status")).toBe("Account linked");
  });

  it("fires login and share callbacks only from their enabled settings actions", () => {
    const shell = new AppShell();
    const login = vi.fn();
    const share = vi.fn();
    const changed = vi.fn();
    shell.onSettingsLogin = login;
    shell.onSettingsShare = share;
    shell.onPreferencesChange = changed;
    shell.showSettings(undefined, { account: { status: "anonymous" }, share: "idle" });

    shell.triggerSettingsAction("bgm");
    expect(changed).toHaveBeenCalledWith({ bgmEnabled: false });
    expect(login).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();

    shell.triggerSettingsAction("login");
    expect(login).toHaveBeenCalledTimes(1);
    expect(share).not.toHaveBeenCalled();

    const loginCallsBeforeShare = login.mock.calls.length;
    shell.triggerSettingsAction("share");
    expect(share).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledTimes(loginCallsBeforeShare);

    shell.showSettings(undefined, { account: { status: "linked", provider: "apps_in_toss" }, share: "sharing" });
    expect(nodeByLabel(shell.container, "settings-login")).toBeUndefined();
    shell.triggerSettingsAction("login");
    shell.triggerSettingsAction("share");
    expect(login).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("does not trigger login while account presentation is loading", () => {
    const shell = new AppShell();
    const login = vi.fn();
    shell.onSettingsLogin = login;
    shell.showSettings(undefined, { account: { status: "loading" } });

    shell.triggerSettingsAction("login");

    expect(login).not.toHaveBeenCalled();
  });

  it("keeps settings presentation state across preference and locale rerenders, then returns home", () => {
    const shell = new AppShell();
    shell.showSettings(defaultPlayerPreferences(), {
      account: { status: "linked", provider: "google_play" },
      share: "success",
    });

    shell.triggerSettingsAction("sfx");
    expect(textByLabel(shell.container, "settings-account-status")).toBe("Google Play 계정 연결됨");
    expect(textByLabel(shell.container, "settings-share-status")).toBe("공유 완료");

    shell.triggerSettingsAction("locale:en");
    expect(textByLabel(shell.container, "settings-account-status")).toBe("Connected with Google Play");
    expect(textByLabel(shell.container, "settings-share-status")).toBe("Shared");

    shell.triggerSettingsAction("back");
    expect(shell.screenVisibilitySnapshot()).toMatchObject({ home: true, settings: false });
  });

  it("delegates Settings back to the app state owner without changing screens locally", () => {
    const shell = new AppShell();
    const home = vi.fn();
    shell.onHome = home;
    shell.showSettings();

    shell.triggerSettingsAction("back");

    expect(home).toHaveBeenCalledTimes(1);
    expect(shell.screenVisibilitySnapshot()).toMatchObject({ home: false, settings: true });
  });

  it("keeps every settings action inside the safe area with a 48 CSS-pixel touch target", () => {
    const shell = new AppShell();
    shell.showSettings(undefined, { account: { status: "anonymous" }, share: "idle" });
    const compactScale = computeRootFit(360, 800).scale;
    const labels = [
      "settings-back",
      "settings-login",
      "settings-bgm",
      "settings-sfx",
      "settings-haptic",
      "settings-reduced-motion",
      "settings-locale-ko",
      "settings-locale-en",
      "settings-share",
    ];

    for (const label of labels) {
      const control = nodeByLabel<Container>(shell.container, label);
      const rect = control?.hitArea as Rectangle | null;
      expect(control, label).toBeTruthy();
      expect(rect?.width ?? 0, label).toBeGreaterThanOrEqual(48 / compactScale);
      expect(rect?.height ?? 0, label).toBeGreaterThanOrEqual(48 / compactScale);
      expect(control!.x, label).toBeGreaterThanOrEqual(APP_SHELL_SAFE_AREA.left);
      expect(control!.y, label).toBeGreaterThanOrEqual(APP_SHELL_SAFE_AREA.top);
      expect(control!.x + (rect?.width ?? 0), label).toBeLessThanOrEqual(BASE_WIDTH - APP_SHELL_SAFE_AREA.right);
      expect(control!.y + (rect?.height ?? 0), label).toBeLessThanOrEqual(BASE_HEIGHT - APP_SHELL_SAFE_AREA.bottom);
    }
  });

  it("rebuilds visible Settings from actual compact viewport metrics without overlapping sensory controls", () => {
    const shell = new AppShell();
    const safeArea = { top: 24, right: 24, bottom: 24, left: 24 };
    shell.showSettings(undefined, { account: { status: "linked", provider: "google_play" }, share: "success" });
    const initialBgm = nodeByLabel<Container>(shell.container, "settings-bgm");

    shell.setViewportMetrics({ width: 360, height: 640, safeArea });

    const compactLayout = settingsControlLayout(360, 640, safeArea);
    const bgm = nodeByLabel<Container>(shell.container, "settings-bgm")!;
    const sfx = nodeByLabel<Container>(shell.container, "settings-sfx")!;
    const haptic = nodeByLabel<Container>(shell.container, "settings-haptic")!;
    const motion = nodeByLabel<Container>(shell.container, "settings-reduced-motion")!;
    const shareCard = nodeByLabel<Container>(shell.container, "settings-share-card")!;
    const bgmRect = bgm.hitArea as Rectangle;
    const sfxRect = sfx.hitArea as Rectangle;
    const shareCardRect = shareCard.hitArea as Rectangle;

    expect(bgm).not.toBe(initialBgm);
    expect(bgmRect.height).toBe(compactLayout.touchHeight);
    expect(bgmRect.height * compactLayout.rootFitScale).toBeGreaterThanOrEqual(48);
    expect(bgm.y + bgmRect.height).toBeLessThanOrEqual(haptic.y);
    expect(sfx.y + sfxRect.height).toBeLessThanOrEqual(motion.y);
    expect(shareCard.y + shareCardRect.height).toBeLessThanOrEqual(BASE_HEIGHT - APP_SHELL_SAFE_AREA.bottom);
    expect(textByLabel(shell.container, "settings-account-status")).toBe("Google Play 계정 연결됨");
    expect(textByLabel(shell.container, "settings-share-status")).toBe("공유 완료");
  });

  it("renders collection labels from canonical mode and boss definitions", () => {
    const shell = new AppShell();

    shell.showCollection();
    const text = textsOf(shell.container).join("\n");

    expect(text).toContain("보스 러시");
    expect(text).toContain("Ringed Destroyer");
    expect(text).toContain("Dark Planet");
    expect(text).toContain("스토리");
    expect(text).toContain("60초 블리츠");
    expect(text).toContain("잠김 Ringed Destroyer");
    expect(text).toContain("특수 대상");
    expect(text).toContain("칭호");
    expect(text).not.toContain("Blitz · Daily");
  });

  it("renders collection progress from stored boss, special-object, and title unlocks", async () => {
    const shell = new AppShell();
    const adapter = new WebStubAdapter();
    const store = new ProgressStore(adapter);
    const outcome = await store.recordResult({
      modeId: "daily",
      difficulty: "defender",
      endReason: "stage_objective_complete",
      survivalMs: 60000,
      score: 4200,
      kills: 16,
      bossKills: 1,
      defeatedBossIds: ["ringed_destroyer"],
      maxCombo: 12,
      protectedCount: 1,
      remainingEnergy: 60,
      rankingEligible: false,
      retryDestination: "modeSelect",
      activeDailyModifierId: "rescueDay",
      objectiveOutcome: "cleared",
    });

    shell.showCollection(outcome.snapshot);
    const text = textsOf(shell.container).join("\n");

    expect(text).toContain("해금 Ringed Destroyer");
    expect(text).toContain("해금 구조 신호");
    expect(text).toContain("해금 데일리 클리어");
    expect(text).toContain("해금 콤보 파일럿");
  });

  it("renders stage-medal and return-progress summaries in Collection", async () => {
    const adapter = new WebStubAdapter();
    const progress = await new ProgressStore(adapter).load();
    progress.retention.stageMedals["story-1"] = "gold";
    progress.retention.daily.clearDayKeys = ["2026-07-11"];
    const shell = new AppShell();

    shell.showCollection(progress);

    const text = textsOf(shell.container).join("\n");
    expect(text).toContain("스테이지 메달");
    expect(text).toContain("골드 1");
    expect(text).toContain("데일리 클리어 일수 1");
  });

  it("shows the current KST weekly goal, its title reward, and claimable state in Collection", async () => {
    const adapter = new WebStubAdapter();
    const progress = await new ProgressStore(adapter).load();
    const weekStart = new Date(`${weekKeyFor(new Date())}T00:00:00.000Z`);
    progress.retention.daily.clearDayKeys = Array.from({ length: 5 }, (_, offset) => {
      const day = new Date(weekStart.getTime() + offset * 24 * 60 * 60 * 1000);
      return day.toISOString().slice(0, 10);
    });
    const shell = new AppShell();

    shell.showCollection(progress);

    expect(textByLabel(shell.container, "collection-weekly-goal")).toContain("5/5");
    expect(textByLabel(shell.container, "collection-weekly-goal")).toContain("주간 항해자");
    expect(textByLabel(shell.container, "collection-weekly-goal")).toContain("수령 가능");
  });

  it("exposes a claim action only for a claimable current-week reward", async () => {
    const adapter = new WebStubAdapter();
    const progress = await new ProgressStore(adapter).load();
    const weekStart = new Date(`${weekKeyFor(new Date())}T00:00:00.000Z`);
    progress.retention.daily.clearDayKeys = Array.from({ length: 5 }, (_, offset) => {
      const day = new Date(weekStart.getTime() + offset * 24 * 60 * 60 * 1000);
      return day.toISOString().slice(0, 10);
    });
    const shell = new AppShell();
    const claim = vi.fn();
    shell.onClaimWeeklyReward = claim;

    shell.showCollection(progress);
    shell.triggerCollectionAction("claimWeekly");

    expect(labelsOf(shell.container)).toContain("collection-weekly-claim");
    expect(claim).toHaveBeenCalledTimes(1);
  });

  it("rebuilds the Free Defense detail with the actual viewport safe area", () => {
    const shell = new AppShell();
    shell.showModeDetail("freeDefense");
    const full = shell.container.getChildByLabel("mode-detail-start-enabled", true) as Container;

    shell.setViewportMetrics({ width: 272, height: 520, safeArea: { top: 24, right: 0, bottom: 20, left: 0 } });

    const constrained = shell.container.getChildByLabel("mode-detail-start-enabled", true) as Container;
    expect(constrained).not.toBe(full);
  });

  it("exposes the collection action from the home screen", () => {
    const shell = new AppShell();
    const collection = vi.fn();
    shell.onOpenCollection = collection;

    shell.triggerHomeAction("collection");

    expect(collection).toHaveBeenCalledTimes(1);
  });

  it("exposes the settings action from the home screen", () => {
    const shell = new AppShell();
    const settings = vi.fn();
    shell.onOpenSettings = settings;

    shell.triggerHomeAction("settings");

    expect(settings).toHaveBeenCalledTimes(1);
  });

  it("exposes DEV QA launch actions for the remaining real-device smoke scenarios", () => {
    const shell = new AppShell();
    const startQa = vi.fn();
    shell.onStartQaRun = startQa;

    shell.triggerHomeAction("qa");
    shell.triggerQaAction("touchHud");
    shell.triggerQaAction("blitz");
    shell.triggerQaAction("boss");
    shell.triggerQaAction("special");

    expect(startQa).toHaveBeenCalledWith("freeDefense", "dense");
    expect(startQa).toHaveBeenCalledWith("blitz60", "dense");
    expect(startQa).toHaveBeenCalledWith("bossRush", "blockedBody");
    expect(startQa).toHaveBeenCalledWith("freeDefense", "special");
  });

  it("lets DEV QA scenarios be marked as pass or pending", () => {
    const shell = new AppShell();
    const toggle = vi.fn();
    shell.onToggleQaResult = toggle;

    shell.showQa();
    shell.updateQaResults({ touchHud: true, boss: false, special: true, blitz: false });
    shell.triggerQaResultToggle("boss");

    expect(toggle).toHaveBeenCalledWith("boss");
    expect(textsOf(shell.container)).toContain("터치/HUD");
    expect(textsOf(shell.container).filter((text) => text === "통과")).toHaveLength(2);
    expect(textsOf(shell.container).filter((text) => text === "대기")).toHaveLength(2);
  });

  it("renders sprite-driven visual layers across home, mode select, and result screens", () => {
    const shell = new AppShell();

    const labels = labelsOf(shell.container);

    expect(labels).toContain("home-visual-layer");
    expect(labels).toContain("home-earth-sprite");
    expect(labels).toContain("home-boss-sprite");
    expect(labels).toContain("home-meteor-sprite");
    expect(labels).toContain("mode-visual-story");
    expect(labels).toContain("mode-visual-freeDefense");
    expect(labels).toContain("mode-visual-ranked");
    expect(labels).toContain("mode-visual-bossRush");
    expect(labels).toContain("mode-visual-blitz60");
    expect(labels).toContain("mode-visual-daily");
    expect(labels).toContain("result-visual-layer");
    expect(labels).toContain("result-backdrop-sprite");
    expect(labels).toContain("result-debris-sprite");
  });

  it("animates visual layers so shell images do not stay completely static", () => {
    const shell = new AppShell();
    const homeLayer = shell.container.getChildByLabel("home-visual-layer", true);
    const earthSprite = shell.container.getChildByLabel("home-earth-sprite", true);

    const startY = homeLayer?.y;
    const startRotation = earthSprite?.rotation;
    shell.update(1000);

    expect(homeLayer?.y).not.toBe(startY);
    expect(earthSprite?.rotation).not.toBe(startRotation);
  });
});
