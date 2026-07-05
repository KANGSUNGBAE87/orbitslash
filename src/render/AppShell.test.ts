import { beforeEach, describe, expect, it, vi } from "vitest";
import { APP_SHELL_SAFE_AREA, AppShell, appShellLayoutMetrics } from "./AppShell";
import { MODE_IDS } from "../game/ModeConfig";
import { ProgressStore } from "../game/ProgressStore";
import { WebStubAdapter } from "../platform/WebStubAdapter";
import { getLocale, setLocale } from "../i18n";
import { BASE_HEIGHT, BASE_WIDTH } from "../game/coords";

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

describe("AppShell", () => {
  beforeEach(() => {
    setLocale("ko");
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
    expect(textsOf(shell.container).some((text) => text.includes("Eclipse Core") && text.includes("Ringed Destroyer"))).toBe(true);
    expect(textsOf(shell.container).some((text) => text.includes("보스 러시") && text.includes("2/5"))).toBe(true);
    expect(textsOf(shell.container).some((text) => text.includes("점수: 5,000"))).toBe(true);
    expect(textsOf(shell.container).some((text) => text.includes("시간: 90초"))).toBe(true);
    expect(textsOf(shell.container).some((text) => text.includes("에너지: 20"))).toBe(true);
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
    const progress = await store.recordResult({
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

    shell.showCollection(progress);
    const text = textsOf(shell.container).join("\n");

    expect(text).toContain("해금 Ringed Destroyer");
    expect(text).toContain("해금 구조 신호");
    expect(text).toContain("해금 데일리 클리어");
    expect(text).toContain("해금 콤보 파일럿");
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
