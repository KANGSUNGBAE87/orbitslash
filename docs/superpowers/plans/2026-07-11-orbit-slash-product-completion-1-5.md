# Orbit Slash Product Completion 1–5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현재 플레이어블 코어를 첫 세션, 감각 품질, 재방문, 안전한 클라우드/랭킹, 양 플랫폼 출시 경계까지 연결된 상용 제품으로 완성한다.

**Architecture:** 기존 PixiJS + 순수 TypeScript + 플랫폼 어댑터 구조를 유지한다. `GameScene`과 `AppShell`은 오케스트레이션만 남기고, 진행·튜토리얼·피드백·에셋·보상·화면을 작은 순수 모듈로 추출한다. 로컬 진행이 항상 먼저 성공하며 identity, cloud, ranked, entitlement는 별도 서버 경계에서 단계적으로 활성화한다.

**Tech Stack:** Vite 6, TypeScript 5.7, PixiJS 8, Vitest 2, Supabase Postgres/Edge Functions, Google Play-first WebView shell, Apps in Toss-compatible shell.

---

## 0. 실행 전제와 확정 결정

### 현재 기준선

- `main` HEAD: `e168118`.
- 작업 트리: tracked 23개 수정, untracked 7개. 첫 구현 전에 현재 아트/VFX 배치를 독립 커밋으로 보존한다.
- 현재 검증: 78 test files / 499 tests, typecheck, build, local release preflight 통과. Deno 검사는 PATH 부재로 건너뛴 상태다.
- `GameScene.ts` 1,902줄, `AppShell.ts` 1,405줄. 신규 기능을 두 파일에 직접 누적하지 않는다.
- 이 계획의 1~5는 과거의 boss/special object/5th skill 계획이 아니라 2026-07-10 제품 감사의 다섯 실행 축이다.

### 모델 취합 결정

| 쟁점 | 채택안 | 제외안과 이유 |
|---|---|---|
| 진행 변경 | 순수 `ProgressReducer`가 `{ snapshot, delta }` 반환 | stateful `ProgressDelta` 클래스는 책임 중복 |
| Ranked 진행 해금 | `story-8` 클리어 또는 첫 보스 격파 | `story-4`는 Last Save 학습 전, first-boss-only는 Story 경로에서 너무 늦을 수 있음 |
| 공개 Ranked | 진행 해금과 `identity/backend ready`를 별도 상태로 표시 | 두 조건을 하나로 묶으면 다시 영구 잠금처럼 보임 |
| 튜토리얼 | 순수 `TutorialFlow` reducer + signal 입력 | XState/imperative Director는 신규 의존성과 ticker 결합 증가 |
| 오디오 | Web Audio API 기반 자체 adapter | Howler 신규 의존성 불필요 |
| UI | PixiJS 화면 컴포넌트 분리 | React/CSS 파티클은 현재 렌더 구조와 충돌 |
| Cloud | local write → optimistic UI → background mutation sync | network-first는 게임 진행을 차단 |
| Identity 시점 | Stage 4 cloud 직전, Stage 5 Ranked 전에 완료 | Stage 1보다 먼저 강제하면 로컬 버그 수정이 auth에 종속됨 |
| Ranked SSOT | Stage 5에서 pure core + generated Edge artifact + hash parity | 영구적인 client/Edge 수동 복사는 현재 드리프트를 반복 |
| 수익화 | cosmetic/supporter 우선, rewarded는 선택형·비랭크 | P2W, 강제 광고, 랭크 시도권 판매 금지 |

### 실행 DAG

```text
Batch 0 baseline capture
  -> Stage 1 truth restoration
  -> Stage 2 first-session flow
  -> Stage 3 sensory + visual + lifecycle
  -> Stage 4 retention + product telemetry
  -> Stage 4A identity + cloud progress
  -> Evidence gate
  -> Stage 5 secure ranked + cosmetics + live ops
  -> Google Play shell
  -> Apps in Toss shell
```

Stage 3의 아트 제작은 AssetManifest 계약이 고정된 뒤 Stage 2와 병렬 가능하다. Remote DB apply, Edge deploy, store upload는 각각 별도 Owner 실행 명령이 있어야 한다.

## Stage 1 — 진실성 복구

### Task 1: 현재 dirty baseline 보존

**Files:**
- Inspect: current dirty files from `git status --short`
- Update: `ai/session-logs/2026-07-11-product-completion-plan-codex.md`

- [ ] **Step 1: 현재 diff 소유권 확인**

Run: `git status --short && git diff --check`

Expected: 기존 23 modified + 7 untracked 범위가 설명 가능하고 whitespace error가 없다.

- [ ] **Step 2: 현재 아트/VFX 배치 검증**

Run: `npm test -- --run && npm run typecheck && npm run build`

Expected: 모든 명령 PASS.

- [ ] **Step 3: 구현용 기준점 기록**

권장 브랜치: `codex/orbitslash-product-completion`.

Commit intent: `chore: capture current premium art and HUD baseline`

### Task 2: ProgressReducer와 unlock delta 도입

**Files:**
- Create: `src/game/progression/ProgressReducer.ts`
- Create: `src/game/progression/ProgressDelta.ts`
- Create: `src/game/progression/ProgressReducer.test.ts`
- Modify: `src/game/ProgressStore.ts`
- Modify: `src/game/UnlockSystem.ts`
- Test: `src/game/ProgressStore.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
it("returns only newly unlocked rewards", () => {
  const result = reduceProgressAfterRun(baseProgress(), firstBossClear());
  expect(result.delta.newModes).toEqual(["bossRush"]);
  expect(result.delta.newSkills).toEqual(["nova_pulse"]);
  expect(result.delta.newBosses).toEqual(["ringed_destroyer"]);
});

it("does not reveal the same unlock twice", () => {
  const once = reduceProgressAfterRun(baseProgress(), firstBossClear());
  const twice = reduceProgressAfterRun(once.snapshot, firstBossClear());
  expect(twice.delta).toEqual(emptyProgressDelta());
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/game/progression/ProgressReducer.test.ts`

Expected: module not found 또는 함수 미정의로 FAIL.

- [ ] **Step 3: 순수 계약 구현**

```ts
export interface ProgressDelta {
  newModes: ModeId[];
  newSkills: SkillId[];
  newBosses: BossId[];
  newStoryStages: number[];
  newCollectionEntries: CollectionEntry[];
}

export interface ProgressRecordOutcome {
  snapshot: ProgressSnapshot;
  delta: ProgressDelta;
}

export function reduceProgressAfterRun(
  current: ProgressSnapshot,
  result: ModeResult,
  now: Date = new Date(),
): ProgressRecordOutcome;
```

`ProgressStore.recordResult()`는 load/write만 담당하고 reducer 결과를 저장해 반환한다. reducer는 platform/Pixi/Date 전역을 import하지 않는다.

- [ ] **Step 4: focused tests 통과**

Run: `npm test -- --run src/game/progression/ProgressReducer.test.ts src/game/ProgressStore.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋**

Commit intent: `refactor: return explicit progression deltas`

### Task 3: Ranked·Nova 플레이어 접근 규칙 통일

**Files:**
- Create: `src/game/progression/UnlockPolicy.ts`
- Create: `src/game/progression/PlayerSkillAccess.ts`
- Create: `src/game/progression/UnlockPolicy.test.ts`
- Create: `src/game/progression/PlayerSkillAccess.test.ts`
- Modify: `src/game/UnlockSystem.ts`
- Modify: `src/game/GameApp.ts`
- Modify: `src/game/ModeConfig.ts`
- Test: `src/game/GameApp.test.ts`
- Test: `src/game/ModeConfig.test.ts`

- [ ] **Step 1: 진행/서비스 상태 분리 테스트 작성**

```ts
it("unlocks ranked and nova after story-8", () => {
  const access = evaluatePlayerUnlocks(progressWithClearedStory("story-8"));
  expect(access.modes).toContain("ranked");
  expect(access.skills).toContain("nova_pulse");
});

it("keeps public ranked service locked without identity readiness", () => {
  expect(resolveModeAvailability("ranked", rankedPlayerProgress(), false)).toEqual({
    playerUnlocked: true,
    serviceReady: false,
    startKind: "local_practice",
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/game/progression/UnlockPolicy.test.ts src/game/progression/PlayerSkillAccess.test.ts`

Expected: FAIL.

- [ ] **Step 3: 정책 구현**

```ts
export interface ModeAvailability {
  playerUnlocked: boolean;
  serviceReady: boolean;
  startKind: "blocked" | "local_practice" | "server_verified";
}

export function effectiveSkills(
  contentSkills: readonly SkillId[],
  unlockedSkills: readonly SkillId[],
  source: AppRunSource,
): SkillId[];
```

정책:

- 일반 run: `contentSkills ∩ unlockedSkills`.
- DEV QA 및 명시적 skill practice: content skill 전체.
- `story-8` 클리어 또는 첫 보스 격파: Ranked player unlock + Nova unlock.
- public Ranked readiness는 backend/identity flag로 별도 계산.

- [ ] **Step 4: 통합 테스트**

Run: `npm test -- --run src/game/ModeConfig.test.ts src/game/GameApp.test.ts src/game/progression/UnlockPolicy.test.ts src/game/progression/PlayerSkillAccess.test.ts`

Expected: 신규 유저 4스킬, 해금 후 5스킬, DEV QA 5스킬 PASS.

- [ ] **Step 5: 커밋**

Commit intent: `fix: align ranked and nova access with progression`

### Task 4: Home/Result에 최신 progress와 unlock reveal 전달

**Files:**
- Create: `src/render/view-models/HomeViewModel.ts`
- Create: `src/render/view-models/ResultViewModel.ts`
- Create: `src/render/screens/ResultScreen.ts`
- Create: `src/render/screens/ResultScreen.test.ts`
- Modify: `src/game/GameApp.ts`
- Modify: `src/render/AppShell.ts`
- Test: `src/render/AppShell.test.ts`

- [ ] **Step 1: stale home/result 테스트 작성**

```ts
it("renders the loaded progress on the first home frame", async () => {
  await app.init(mount);
  expect(shell.showHome).toHaveBeenCalledWith(savedProgress);
});

it("shows only the current run unlock delta", () => {
  const model = buildResultViewModel(result, progressOutcome);
  expect(model.unlockCards.map((item) => item.id)).toEqual(["nova_pulse", "bossRush"]);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/game/GameApp.test.ts src/render/screens/ResultScreen.test.ts`

Expected: `showHome()` 무인자/ResultScreen 부재로 FAIL.

- [ ] **Step 3: 화면 계약 변경**

```ts
showHome(progress: ProgressSnapshot): void;
showResult(result: ModeResult, outcome: ProgressRecordOutcome, options?: ResultOptions): void;
```

`AppShell`은 screen 인스턴스와 callback만 소유한다. 보상 카드 정렬은 `mode → skill → boss → collection → story`로 고정한다.

- [ ] **Step 4: 회귀 테스트**

Run: `npm test -- --run src/game/GameApp.test.ts src/render/AppShell.test.ts src/render/screens/ResultScreen.test.ts`

Expected: 첫 홈, 결과 직후 홈, 중복 reveal 모두 PASS.

- [ ] **Step 5: 커밋**

Commit intent: `fix: render progress and unlock rewards from one snapshot`

### Task 5: Free Defense 모바일 상세 레이아웃 수정

**Files:**
- Create: `src/render/layout/ModeDetailLayout.ts`
- Create: `src/render/layout/ModeDetailLayout.test.ts`
- Create: `src/render/screens/ModeDetailScreen.ts`
- Modify: `src/render/AppShell.ts`
- Modify: `src/i18n/ko.json`
- Modify: `src/i18n/en.json`
- Test: `src/i18n/i18nParity.test.ts`

- [ ] **Step 1: viewport matrix 테스트 작성**

```ts
for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
]) {
  it(`keeps controls readable at ${viewport.width}x${viewport.height}`, () => {
    const layout = modeDetailLayout(viewport, "ko", "freeDefense");
    expect(rectsOverlap(layout.body, layout.controls)).toBe(false);
    expect(layout.minimumCssTouchHeight).toBeGreaterThanOrEqual(48);
  });
}
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/render/layout/ModeDetailLayout.test.ts`

Expected: FAIL.

- [ ] **Step 3: 레이아웃 구현**

`BASE_WIDTH=1080`에서 390px 화면 최소 버튼 높이는 `ceil(48 / (390 / 1080)) = 133` base px로 잡는다. 긴 설명은 4줄 요약과 도움말 영역으로 분리하고 시작 CTA는 safe-area 위에 고정한다.

- [ ] **Step 4: ko/en 레이아웃 테스트**

Run: `npm test -- --run src/render/layout/ModeDetailLayout.test.ts src/render/AppShell.test.ts src/i18n/i18nParity.test.ts`

Expected: overlap 0, 48 CSS px 이상, ko/en PASS.

- [ ] **Step 5: 커밋**

Commit intent: `fix: make mode details readable on phone viewports`

### Task 6: Solar Lance 구조 대상 중단 판정

**Files:**
- Create: `src/game/SolarLanceResolver.ts`
- Create: `src/game/SolarLanceResolver.test.ts`
- Modify: `src/game/GameScene.ts`
- Test: `src/game/GameSceneSkillRelease.test.ts`
- Test: `src/game/RankedReplayValidator.test.ts`

- [ ] **Step 1: occlusion 테스트 작성**

```ts
it("damages only enemies before the first rescue shuttle", () => {
  const resolved = resolveSolarLanceSnapshot(line, [enemyAt(100), enemyAt(300)], [rescueAt(200)]);
  expect(resolved.enemyIds).toEqual([enemyAt(100).id]);
  expect(resolved.stop?.type).toBe("friendlyRescue");
  expect(resolved.vfxLine.b.x).toBeCloseTo(200);
});

it("uses release-time positions and a stable tie break", () => {
  const resolved = resolveSolarLanceSnapshot(line, [enemyAt(200)], [rescueAt(200)]);
  expect(resolved.enemyIds).toEqual([]);
});
```

- [ ] **Step 2: 기존 오작동 확인**

Run: `npm test -- --run src/game/SolarLanceResolver.test.ts`

Expected: module not found로 FAIL.

- [ ] **Step 3: 순수 resolver 구현**

```ts
export interface SolarLanceResolution {
  vfxLine: Segment;
  enemyIds: number[];
  specialObjectIds: number[];
  stop?: { objectId: number; type: SpecialObjectType; lineT: number };
}
```

모든 교차점을 선분 시작점 기준 `lineT`로 정렬한다. protect object와 같은 거리의 enemy보다 protect object를 먼저 처리한다. GameScene은 resolver 결과만 `applyHits`, `applySpecialHit`, `laser.fire`에 전달한다.

- [ ] **Step 4: local/Ranked 판정 회귀**

Run: `npm test -- --run src/game/SolarLanceResolver.test.ts src/game/GameSceneSkillRelease.test.ts src/game/RankedReplayValidator.test.ts`

Expected: 구조 대상 뒤 피해 0, VFX 절단, replay PASS.

- [ ] **Step 5: 커밋**

Commit intent: `fix: stop solar lance at protected objects`

## Stage 2 — 첫 세션 재설계

### Task 7: FirstSession 순수 상태기계와 저장

**Files:**
- Create: `src/game/onboarding/FirstSessionState.ts`
- Create: `src/game/onboarding/FirstSessionState.test.ts`
- Create: `src/game/onboarding/HomeFlowPolicy.ts`
- Create: `src/game/onboarding/HomeFlowPolicy.test.ts`
- Create: `src/game/progression/ProgressSchema.ts`
- Create: `src/game/progression/ProgressMigration.ts`
- Create: `src/game/progression/ProgressMigration.test.ts`
- Modify: `src/game/ProgressStore.ts`
- Modify: `src/game/GameApp.ts`

- [ ] **Step 1: 상태 전이 테스트 작성**

```ts
type FirstSessionStep = "not_started" | "basic_slash" | "last_save" | "solar_lance" | "reward" | "complete";

it("does not advance on an unrelated signal", () => {
  expect(reduceFirstSession(state("last_save"), { type: "enemy_killed" }).step).toBe("last_save");
});

it("resumes an unfinished guided session", () => {
  expect(resolveHomePrimaryAction(progressAt("solar_lance"))).toEqual({
    kind: "resume_guided_story",
    storyStageId: "story-1",
    step: "solar_lance",
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/game/onboarding/FirstSessionState.test.ts src/game/onboarding/HomeFlowPolicy.test.ts`

Expected: FAIL.

- [ ] **Step 3: reducer 계약 구현**

```ts
export interface FirstSessionState {
  version: 1;
  step: FirstSessionStep;
  startedAt: string | null;
  completedAt: string | null;
  lastUpdatedAt: string | null;
}
```

`ProgressSnapshot.version`을 3으로 올리고 v2→v3 migration에서 onboarding과 preferences 기본값을 넣는다. 신규 사용자 START는 `story-1`; 미완료 사용자는 같은 stage/step을 안전하게 재시작; 완료 사용자는 마지막 플레이 모드로 간다. 전투 중간 HP/적/RNG 상태는 저장하지 않는다.

- [ ] **Step 4: persistence 회귀**

Run: `npm test -- --run src/game/onboarding/FirstSessionState.test.ts src/game/onboarding/HomeFlowPolicy.test.ts src/game/progression/ProgressMigration.test.ts src/game/ProgressStore.test.ts src/game/GameApp.test.ts`

Expected: reload resume, complete 후 checkpoint 삭제 PASS.

- [ ] **Step 5: 커밋**

Commit intent: `feat: add resumable first-session progression`

### Task 8: 단계형 TutorialFlow와 Guided Story 1

**Files:**
- Create: `src/game/onboarding/TutorialFlow.ts`
- Create: `src/game/onboarding/TutorialFlow.test.ts`
- Create: `src/game/onboarding/GuidedStoryScenario.ts`
- Create: `src/game/onboarding/GuidedStoryScenario.test.ts`
- Modify: `src/game/TutorialHudState.ts`
- Modify: `src/game/GameScene.ts`
- Modify: `src/game/ModeConfig.ts`
- Modify: `src/i18n/ko.json`
- Modify: `src/i18n/en.json`

- [ ] **Step 1: signal 기반 테스트 작성**

```ts
export type TutorialSignal =
  | { type: "slash_committed" }
  | { type: "enemy_killed"; band: DistanceBand }
  | { type: "skill_fired"; skillId: SkillId };

it("teaches slash, last save, and solar lance in order", () => {
  let flow = createGuidedFlow();
  flow = reduceTutorialFlow(flow, { type: "slash_committed" });
  expect(flow.step).toBe("last_save");
  flow = reduceTutorialFlow(flow, { type: "enemy_killed", band: "lastSave" });
  expect(flow.step).toBe("solar_lance");
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/game/onboarding/TutorialFlow.test.ts src/game/onboarding/GuidedStoryScenario.test.ts`

Expected: FAIL.

- [ ] **Step 3: guided scenario 구현**

Story 1 guided override는 세 단계만 사용한다.

1. 느린 basic meteor 1개로 기본 slash.
2. Last Save band까지 예측 가능한 meteor 1개.
3. 충전된 Solar Lance로 직선 적 2개.

다섯 스킬 동시 설명, 첫 세션 보스, modal 강제 차단은 넣지 않는다. `TutorialHudState`는 flow state를 i18n copy로 매핑만 한다.

- [ ] **Step 4: GameScene 통합 회귀**

Run: `npm test -- --run src/game/onboarding/TutorialFlow.test.ts src/game/onboarding/GuidedStoryScenario.test.ts src/game/GameSceneTutorialHud.test.ts src/game/TutorialHudState.test.ts`

Expected: 정확한 signal에서만 전진, HUD/플레이필드 비중첩 PASS.

- [ ] **Step 5: 커밋**

Commit intent: `feat: replace timed tutorial with guided gameplay steps`

### Task 9: Result→Reward→Collection 흐름과 로컬 제품 퍼널

**Files:**
- Create: `src/render/view-models/ResultFlowState.ts`
- Create: `src/render/view-models/ResultFlowState.test.ts`
- Create: `src/platform/ProductTelemetry.ts`
- Create: `src/platform/ProductTelemetry.test.ts`
- Modify: `src/render/screens/ResultScreen.ts`
- Modify: `src/game/GameApp.ts`
- Modify: `src/game/Telemetry.ts`

- [ ] **Step 1: 결과 흐름/이벤트 테스트 작성**

```ts
it("orders summary, unlock reveal, then collection choice", () => {
  expect(resultFlowFor(progressOutcomeWithNova()).steps).toEqual([
    "summary",
    "unlock_reveal",
    "collection_choice",
  ]);
});

it("stores only allowlisted product payloads", () => {
  queue.track("tutorial_complete", { locale: "ko", freeText: "secret" });
  expect(queue.peek()[0]?.props).toEqual({ locale: "ko" });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/render/view-models/ResultFlowState.test.ts src/platform/ProductTelemetry.test.ts`

Expected: FAIL.

- [ ] **Step 3: event contract 구현**

```ts
export type ProductEventName =
  | "app_open"
  | "home_view"
  | "primary_start"
  | "tutorial_step_started"
  | "tutorial_step_completed"
  | "tutorial_complete"
  | "run_end"
  | "retry_selected"
  | "unlock_reveal"
  | "collection_open"
  | "return_next_day";
```

로컬 queue는 최대 240개, structured payload만 허용하고 raw provider id, free text, 전체 URL을 저장하지 않는다.

- [ ] **Step 4: 전체 첫 세션 테스트**

Run: `npm test -- --run src/game/GameApp.test.ts src/render/screens/ResultScreen.test.ts src/platform/ProductTelemetry.test.ts`

Expected: 첫 실행부터 collection open까지 event 순서와 cardinality PASS.

- [ ] **Step 5: 커밋**

Commit intent: `feat: connect first-run rewards to collection and funnel events`

## Stage 3 — 감각·이미지·모바일 기반

### Task 10: FeedbackController, WebAudio, 설정 저장

**Files:**
- Create: `src/feedback/AudioPort.ts`
- Create: `src/feedback/WebAudioEngine.ts`
- Create: `src/feedback/AudioManifest.ts`
- Create: `src/feedback/FeedbackController.ts`
- Create: `src/feedback/FeedbackController.test.ts`
- Create: `src/game/PlayerPreferencesStore.ts`
- Create: `src/game/PlayerPreferencesStore.test.ts`
- Create: `src/render/screens/SettingsScreen.ts`
- Modify: `src/platform/PlatformAdapter.ts`
- Modify: `src/render/AppShell.ts`

- [ ] **Step 1: cue/haptic 정책 테스트 작성**

```ts
it("throttles frequent hit haptics but keeps last-save feedback", () => {
  controller.handle({ type: "normal_hit", atMs: 100 });
  controller.handle({ type: "normal_hit", atMs: 120 });
  controller.handle({ type: "last_save", atMs: 140 });
  expect(haptics.calls).toEqual(["light", "heavy"]);
});

it("does not start WebAudio before a user gesture", () => {
  engine.play("slash_hit");
  expect(fakeContext.startedSources).toHaveLength(0);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/feedback/FeedbackController.test.ts src/game/PlayerPreferencesStore.test.ts`

Expected: FAIL.

- [ ] **Step 3: cue taxonomy 구현**

```ts
export type FeedbackCue =
  | "ui_tap"
  | "slash_hit"
  | "enemy_destroyed"
  | "last_save"
  | "friendly_hit"
  | "skill_fire"
  | "boss_enter"
  | "boss_phase"
  | "boss_defeat"
  | "reward_reveal";
```

Preferences: `bgmEnabled`, `sfxEnabled`, `hapticEnabled`, `reducedMotion`, `locale`. 일반 hit haptic은 80ms throttle, Last Save/오발/보스는 즉시 허용한다.

- [ ] **Step 4: settings/adapter 회귀**

Run: `npm test -- --run src/feedback/FeedbackController.test.ts src/game/PlayerPreferencesStore.test.ts src/platform/PlatformAdapter.test.ts src/render/AppShell.test.ts`

Expected: 재실행 후 설정 유지, platform haptic 호출 PASS.

- [ ] **Step 5: 커밋**

Commit intent: `feat: add persistent audio and haptic feedback controls`

### Task 11: 그룹형 AssetManifest와 예산 가드

**Files:**
- Create: `src/render/assets/AssetManifest.ts`
- Create: `src/render/assets/AssetManifest.test.ts`
- Create: `src/render/assets/AssetPreloader.ts`
- Create: `src/render/assets/AssetPreloader.test.ts`
- Create: `scripts/check-asset-budget.mjs`
- Modify: `src/render/AppVisualAssets.ts`
- Modify: `src/render/TextureAssets.ts`
- Modify: `src/main.ts`
- Modify: `package.json`

- [ ] **Step 1: boot group 테스트 작성**

```ts
it("does not put every boss in the boot group", () => {
  expect(assetGroup("boot")).toEqual(expect.arrayContaining([earthCoreUrl, earthShieldUrl]));
  expect(assetGroup("boot").some((url) => url.includes("boss"))).toBe(false);
});

it("preloads the next boss before its wave", async () => {
  await preloader.prepare({ kind: "boss", bossId: "lava_titan" });
  expect(loader.loaded).toContain(bossAssetUrl("lava_titan"));
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/render/assets/AssetManifest.test.ts src/render/assets/AssetPreloader.test.ts`

Expected: FAIL.

- [ ] **Step 3: asset group 구현**

```ts
export type AssetGroupKey =
  | "boot"
  | "home"
  | "story-1"
  | `mode:${ModeId}`
  | `boss:${BossId}`
  | "collection";
```

boot은 Earth, 홈 hero, Story 1 최소 적만 기다린다. 보스는 등장 wave 직전 또는 detail 진입 때 prefetch한다. load concurrency는 4로 제한하고 실패 시 기존 vector/procedural fallback을 유지한다.

- [ ] **Step 4: asset budget 실행**

Run: `npm run test -- --run src/render/assets/AssetManifest.test.ts src/render/assets/AssetPreloader.test.ts && node scripts/check-asset-budget.mjs`

Expected targets:

- boot transfer ≤ 1.5 MiB.
- 첫 Story run 누적 transfer ≤ 4 MiB.
- 개별 runtime boss WebP ≤ 700 KiB.
- boot group에 사용하지 않는 보스 0개.

- [ ] **Step 5: 커밋**

Commit intent: `perf: load visual assets by screen and encounter`

### Task 12: 보스·특수 대상·스킬 비주얼 고유화

**Files:**
- Create: `src/render/BossVisualManifest.ts`
- Create: `src/render/SpecialObjectVisual.ts`
- Create: `src/render/SkillIconVisual.ts`
- Create: `src/render/BossVisualManifest.test.ts`
- Create: `public/assets/special/{friendly-rescue,defense-satellite,energy-capsule,emp-mine}.webp`
- Create: `public/assets/skills/{solar-lance,orbital-cut,gravity-slow,delta-shield,nova-pulse}.webp`
- Replace: `public/assets/enemies/{ringed-destroyer,lava-titan,ice-colossus,dark-planet,eclipse-core}.webp`
- Modify: `src/render/EnemyVisual.ts`
- Modify: `src/game/GameScene.ts`

- [ ] **Step 1: manifest completeness 테스트 작성**

```ts
it("maps every release boss, special object, and skill to a unique runtime asset", () => {
  expect(uniqueBossAssets()).toHaveLength(5);
  expect(allSpecialObjectAssets()).toHaveLength(4);
  expect(allSkillIconAssets()).toHaveLength(5);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/render/BossVisualManifest.test.ts src/render/EnemyVisual.test.ts`

Expected: 신규 manifest/asset 부재로 FAIL.

- [ ] **Step 3: 아트 계약 적용**

각 보스는 색만이 아니라 silhouette를 구분한다.

- Ringed: 비대칭 고리.
- Lava: 갈라진 왕관/용암 심장.
- Ice: 각진 외피/빙결 뿔.
- Dark: 중심 구멍/찢긴 암흑 외곽.
- Eclipse: 다중 코어/후광.

특수 대상 4종과 스킬 5종은 텍스트 없이 구분 가능해야 한다. 실행 시 이미지 생성/편집은 `imagegen`을 사용하고 최종 채택 전 모바일 screenshot 비교를 거친다.

- [ ] **Step 4: visual QA gate**

Run: focused asset tests + 390×844 screenshot matrix.

Expected: 보스 silhouette 중복 없음, special/skill 오인 0, 방향 cut overlay 가독성 유지.

- [ ] **Step 5: 커밋**

Commit intent: `feat: give bosses and judgment objects distinct silhouettes`

### Task 13: safe area, lifecycle, pause, reduced motion

**Files:**
- Create: `src/platform/SafeAreaProvider.ts`
- Create: `src/platform/SafeAreaProvider.test.ts`
- Create: `src/platform/AppLifecycle.ts`
- Create: `src/platform/AppLifecycle.test.ts`
- Create: `src/render/screens/PauseOverlay.ts`
- Create: `src/render/MotionPreferences.ts`
- Modify: `src/game/GameApp.ts`
- Modify: `src/game/GameScene.ts`
- Modify: `src/game/coords.ts`
- Modify: `src/render/{SlashTrail,HitBurst,DestructionBurst,LaserVfx}.ts`

- [ ] **Step 1: inset/lifecycle 테스트 작성**

```ts
it("passes real safe insets into root fit", () => {
  const fit = computeRootFit(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });
  expect(fit.y).toBeGreaterThanOrEqual(47);
});

it("does not advance simulation while hidden", () => {
  lifecycle.hidden();
  clock.tick(30_000);
  expect(clock.elapsedMs()).toBe(0);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/platform/SafeAreaProvider.test.ts src/platform/AppLifecycle.test.ts src/game/coords.test.ts`

Expected: FAIL.

- [ ] **Step 3: lifecycle 계약 구현**

`visibilitychange/pagehide`에서 simulation과 audio를 pause하고 active pointer를 cancel한다. `pageshow`에서 자동 재개하지 않고 PauseOverlay의 명시적 resume를 요구한다. reduced motion은 particle count, screen shake, trail duration을 줄이되 판정과 hit feedback은 유지한다.

- [ ] **Step 4: 회귀 테스트**

Run: `npm test -- --run src/platform/SafeAreaProvider.test.ts src/platform/AppLifecycle.test.ts src/game/GameScenePointerInput.test.ts src/render/HitBurst.test.ts src/render/DestructionBurst.test.ts`

Expected: background dt 폭주 0, stale pointer 0, safe-area 침범 0.

- [ ] **Step 5: 커밋**

Commit intent: `feat: handle mobile safe areas and app lifecycle`

## Stage 4 — 최소 재방문과 Cloud

### Task 14: Medal·Collection·Daily/Weekly 순수 규칙

**Files:**
- Create: `src/game/retention/StageMedalRules.ts`
- Create: `src/game/retention/StageMedalRules.test.ts`
- Create: `src/game/retention/DailyRetentionRules.ts`
- Create: `src/game/retention/DailyRetentionRules.test.ts`
- Create: `src/game/retention/WeeklyGoalRules.ts`
- Create: `src/game/retention/WeeklyGoalRules.test.ts`
- Create: `src/data/retention.json`
- Create: `src/render/view-models/CollectionViewModel.ts`
- Create: `src/render/screens/CollectionScreen.ts`
- Create: `src/render/screens/CollectionScreen.test.ts`
- Modify: `src/game/ProgressStore.ts`
- Modify: `src/game/progression/ProgressSchema.ts`
- Modify: `src/game/progression/ProgressMigration.ts`
- Modify: `src/game/progression/ProgressMigration.test.ts`
- Modify: `src/game/RemoteConfig.ts`
- Modify: `src/render/AppShell.ts`

- [ ] **Step 1: 비하락/중복 보상 테스트 작성**

```ts
it("never downgrades a stage medal", () => {
  expect(bestMedal("gold", evaluateMedal(worseReplay))).toBe("gold");
});

it("grants one daily first-clear and one weekly claim", () => {
  const twice = applyDailyClear(applyDailyClear(base, dayKey), dayKey);
  expect(twice.firstClearAwards).toHaveLength(1);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/game/retention/*.test.ts`

Expected: FAIL.

- [ ] **Step 3: 규칙 구현**

`ProgressSnapshot.version`을 4로 올리고 v3→v4 migration에서 medals, 7-day clear board, weekly claim state를 추가한다. Medal은 stats 강화가 아닌 mastery 표시다. Bronze=clear, Silver/Gold는 `retention.json`의 stage별 score/energy/constraint 조건을 모두 만족할 때 부여한다. Weekly key는 기존 KST Monday 06:00 정책을 재사용한다. 첫 버전 weekly 목표는 7일 중 5일 clear, 보상은 title/visual trail 하나이며 soft currency를 만들지 않는다.

- [ ] **Step 4: Collection 화면 회귀**

Run: `npm test -- --run src/game/retention/*.test.ts src/render/AppShell.test.ts src/render/screens/CollectionScreen.test.ts`

Expected: locked silhouette, unlocked art, 최고 기록, 획득 조건, medal grid PASS.

- [ ] **Step 5: 커밋**

Commit intent: `feat: add mastery medals and weekly return goals`

### Task 15: 원격 제품 퍼널 텔레메트리

**Files:**
- Create: `supabase/migrations/20260711_orbitslash_product_telemetry.sql`
- Create: `supabase/functions/orbitslash-product-telemetry/index.ts`
- Create: `src/platform/ProductTelemetryBackend.ts`
- Create: `src/platform/ProductTelemetryBoundary.test.ts`
- Modify: `src/platform/BackendAdapter.ts`
- Modify: `src/platform/SupabaseEdgeBackendAdapter.ts`
- Modify: `.env.example`

- [ ] **Step 1: boundary 테스트 작성**

```ts
it("rejects raw identity and free text", () => {
  expect(validateProductEvent({
    eventName: "tutorial_complete",
    userKey: "raw",
    freeText: "secret",
  })).toEqual({ ok: false, reason: "sensitive_payload" });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/platform/ProductTelemetryBoundary.test.ts`

Expected: FAIL.

- [ ] **Step 3: Edge/table 계약 작성**

필드: `client_event_id`, `session_trace_id`, `event_name`, `event_sequence`, `mode_id`, `story_stage_id`, `tutorial_step`, `locale`, `runtime`, `runtime_channel`, `app_version`, `client_at`, `created_at`. raw provider ID, advertising/device ID, free text는 금지한다. 클라이언트는 Edge만 호출하고 table 직접 권한은 revoke한다.

- [ ] **Step 4: local boundary 검증**

Run: `npm test -- --run src/platform/ProductTelemetryBoundary.test.ts src/platform/SupabaseEdgeBackendAdapter.test.ts && npm run preflight:release`

Expected: local contract PASS. Remote migration apply/Edge deploy는 별도 Owner 명령 전 실행하지 않는다.

- [ ] **Step 5: 커밋**

Commit intent: `feat: add privacy-safe product funnel telemetry`

### Task 16: Identity와 mutation 기반 Cloud Progress

**Files:**
- Create: `src/platform/identity/IdentityService.ts`
- Create: `src/platform/identity/IdentityService.test.ts`
- Create: `src/platform/progress/ProgressRepository.ts`
- Create: `src/platform/progress/LocalProgressRepository.ts`
- Create: `src/platform/progress/CloudProgressRepository.ts`
- Create: `src/platform/progress/ProgressMerge.ts`
- Create: `src/platform/progress/ProgressMerge.test.ts`
- Create: `src/platform/progress/ProgressMutationQueue.ts`
- Create: `supabase/migrations/20260711_orbitslash_progress_sync.sql`
- Create: `supabase/functions/orbitslash-progress/index.ts`
- Modify: `src/platform/AppsInTossAdapter.ts`
- Modify: `src/platform/GooglePlayAdapter.ts`

- [ ] **Step 1: merge/idempotency 테스트 작성**

```ts
it("unions unlocks and keeps maximum records across devices", () => {
  const merged = mergeProgress(localProgress, remoteProgress);
  expect(merged.unlocks.modes).toEqual(expect.arrayContaining(localProgress.unlocks.modes));
  expect(merged.records.freeDefense.bestScore).toBe(Math.max(
    localProgress.records.freeDefense.bestScore,
    remoteProgress.records.freeDefense.bestScore,
  ));
});

it("applies the same mutation id once", () => {
  expect(applyMutations(base, [mutation, mutation]).profile.totalRuns).toBe(1);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/platform/identity/IdentityService.test.ts src/platform/progress/*.test.ts`

Expected: FAIL.

- [ ] **Step 3: local-first sync 계약 구현**

```ts
export interface ProgressRepository {
  load(): Promise<ProgressSnapshot>;
  saveLocal(outcome: ProgressRecordOutcome): Promise<void>;
  enqueueMutation(mutation: ProgressMutation): Promise<void>;
  syncInBackground(): Promise<ProgressSyncResult>;
}
```

순서: local save 성공 → UI 반영 → mutation queue append → background Edge sync. Edge는 platform credential을 검증하고 `authmap_user_identities`로 `core_user_id`를 해석한다. provider는 자동 병합하지 않는다.

DB:

- `orbitslash_progress_snapshots(core_user_id PK, revision, snapshot_json, updated_at)`.
- `orbitslash_progress_mutations(id UUID PK, core_user_id, mutation_type, payload_json, created_at)`.
- `orbitslash_reward_claims(id UUID PK, core_user_id, reward_key, claim_key UNIQUE, created_at)`.

- [ ] **Step 4: offline/retry 테스트**

Run: `npm test -- --run src/platform/identity/IdentityService.test.ts src/platform/progress/*.test.ts src/game/ProgressStore.test.ts`

Expected: network 실패가 run result를 잃게 하지 않고, 동일 mutation 재전송이 중복 보상을 만들지 않는다.

- [ ] **Step 5: 커밋**

Commit intent: `feat: add local-first identity-bound progress sync`

## Stage 5 — 데이터 확인 후 확장

### Evidence gate

다음 조건이 모두 충족되기 전 Stage 5의 시즌/수익화 확장을 시작하지 않는다.

- product telemetry remote write 검증 완료.
- 첫 세션→첫 run→retry→collection 퍼널 누락률 5% 미만.
- 최소 두 개의 주간 cohort 또는 Owner가 승인한 동등한 테스트 표본.
- onboarding/asset/lifecycle P0 결함 0.
- public Ranked는 identity-bound accepted remote run 존재.

튜토리얼 완료율/D1/D7 목표치는 첫 cohort baseline으로 정하고, 사전 임의 숫자를 출시 승인 기준으로 사용하지 않는다.

### Task 17: Ranked rules SSOT와 Edge 검증 강화

**Files:**
- Create: `shared/ranked-core/{types,spawn,score,replay,index}.ts`
- Create: `scripts/generate-ranked-edge-core.mjs`
- Create: `supabase/functions/_shared/orbitslash-ranked-core.generated.ts`
- Create: `src/game/RankedCoreParity.test.ts`
- Modify: `src/game/RankedReplayValidator.ts`
- Modify: `supabase/functions/orbitslash-ranked-run/index.ts`
- Modify: `src/platform/SupabaseEdgeBackendAdapter.ts`
- Modify: `package.json`

- [ ] **Step 1: 위변조/parity 테스트 작성**

```ts
it("rejects missing or injected client spawn events", () => {
  expect(validateAgainstExpectedSpawns(serverRun, tamperedTrace)).toEqual({
    ok: false,
    reason: "spawn_sequence_mismatch",
  });
});

it("rejects skill use before gauge and cooldown allow it", () => {
  expect(validateSkillTimeline(serverRun, impossibleSkillTrace)).toEqual({
    ok: false,
    reason: "skill_timeline_invalid",
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/game/RankedCoreParity.test.ts src/game/RankedReplayValidator.test.ts`

Expected: 현재 Edge 신뢰 경계로 인해 FAIL.

- [ ] **Step 3: SSOT/codegen 구현**

hand-authored SSOT는 `shared/ranked-core`. Edge generated artifact는 source hash와 `rulesHash`를 포함한다. CI의 `generate-ranked-edge-core --check`가 drift 시 실패한다. 서버는 seed/config로 expected spawn을 재생성하고 client spawnEvents는 증거가 아니라 비교 대상이다.

Leaderboard signature:

```ts
leaderboard(difficulty: DifficultyId, weekKey: string, limit: number): Promise<Rows>;
```

정렬: `survival_ms DESC, score DESC, created_at ASC`. 난이도와 week key를 필수 필터로 사용한다.

- [ ] **Step 4: local/Edge bundle 검증**

Run: `node scripts/generate-ranked-edge-core.mjs --check && npm test -- --run src/game/RankedCoreParity.test.ts src/game/RankedReplayValidator.test.ts src/platform/RankedEdgeBoundary.test.ts && npm run preflight:release`

Expected: rules hash 일치, tamper reject, leaderboard order/difficulty PASS.

- [ ] **Step 5: 커밋**

Commit intent: `fix: verify ranked runs against server-generated truth`

### Task 18: Cosmetics·Supporter·광고/IAP entitlement

**Files:**
- Create: `src/game/cosmetics/CosmeticCatalog.ts`
- Create: `src/game/cosmetics/CosmeticLoadout.ts`
- Create: `src/game/cosmetics/CosmeticLoadout.test.ts`
- Create: `src/data/cosmetics.json`
- Create: `src/platform/entitlements/EntitlementRepository.ts`
- Create: `supabase/migrations/20260711_orbitslash_entitlements.sql`
- Create: `supabase/functions/orbitslash-entitlements/index.ts`
- Modify: `src/platform/PlatformAdapter.ts`
- Modify: `src/platform/BackendAdapter.ts`
- Modify: `src/game/RevivePolicy.ts`

- [ ] **Step 1: 공정성 테스트 작성**

```ts
it("never changes gameplay stats from a cosmetic loadout", () => {
  expect(applyCosmetic(baseRunConfig, loadout)).toEqual(baseRunConfig);
});

it("never offers ranked in-run revive", () => {
  expect(revivePolicy({ modeId: "ranked", entitlement: supporter })).toBe("none");
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/game/cosmetics/CosmeticLoadout.test.ts src/game/RevivePolicy.test.ts`

Expected: FAIL.

- [ ] **Step 3: entitlement 계약 구현**

상품 순서:

1. Supporter pack: cosmetic bundle + supporter title.
2. 지구/슬래시/보스 팔레트 cosmetic.
3. 비보상형 광고를 실제 도입한 경우에만 ad-removal SKU.

Receipt는 Google/Toss별 Edge 검증 후 `orbitslash_entitlements`에 저장한다. rewarded 광고는 Free Defense extra play/retry 같은 선택형 위치만 허용하며 `userEarnedReward`에서만 지급하고 dismiss/grace 후 flow를 완료한다.

- [ ] **Step 4: platform boundary 테스트**

Run: `npm test -- --run src/game/cosmetics/CosmeticLoadout.test.ts src/game/RevivePolicy.test.ts src/platform/AdTelemetryBoundary.test.ts src/platform/ReleaseBoundary.test.ts`

Expected: gameplay stat import 0, ranked revive 0, receipt client trust 0.

- [ ] **Step 5: 커밋**

Commit intent: `feat: add cosmetic-only entitlements and supporter products`

### Task 19: Season·신규 boss·친구 비동기 도전

**Files:**
- Create: `src/game/liveops/SeasonCatalog.ts`
- Create: `src/game/liveops/SeasonCatalog.test.ts`
- Create: `src/game/liveops/FriendChallenge.ts`
- Create: `src/game/liveops/FriendChallenge.test.ts`
- Create: `supabase/migrations/20260711_orbitslash_friend_challenges.sql`
- Create: `supabase/functions/orbitslash-friend-challenge/index.ts`
- Modify: `src/game/RemoteConfig.ts`
- Modify: `src/game/BossDefinitions.ts`

- [ ] **Step 1: config pin/share token 테스트 작성**

```ts
it("pins a challenge to seed, difficulty, rules hash, and expiry", () => {
  expect(createChallenge(input)).toMatchObject({
    seed: input.seed,
    difficulty: input.difficulty,
    rulesHash: input.rulesHash,
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/game/liveops/*.test.ts`

Expected: FAIL.

- [ ] **Step 3: 최소 live-ops 구현**

Season은 start/end, supported client version, config version, cosmetic reward IDs만 가진다. 친구 도전은 실시간 멀티가 아니라 opaque token으로 고정 seed 기록을 비교한다. raw provider ID/친구 목록은 저장하지 않는다.

- [ ] **Step 4: expiry/compatibility 회귀**

Run: `npm test -- --run src/game/liveops/*.test.ts src/game/RemoteConfig.test.ts src/game/BossDefinitions.test.ts`

Expected: expired/unsupported config reject, 기존 5보스 회귀 PASS.

- [ ] **Step 5: 커밋**

Commit intent: `feat: add versioned seasons and asynchronous friend challenges`

### Task 20: Google Play-first shell

**Files:**
- Create: `src/platform/google-play/GooglePlayBridge.ts`
- Create: `src/platform/google-play/GooglePlayContract.test.ts`
- Create: `capacitor.config.ts`
- Create: `android/settings.gradle`
- Create: `android/build.gradle`
- Create: `android/app/build.gradle`
- Create: `android/app/src/main/AndroidManifest.xml`
- Create: `android/app/src/main/java/com/kangsungbae/orbitslash/MainActivity.kt`
- Modify: `package.json`
- Modify: active lockfile
- Modify: `src/platform/GooglePlayAdapter.ts`
- Modify: `src/platform/PlatformAdapterFactory.ts`
- Modify: `scripts/check-release-prep.mjs`

- [ ] **Step 1: bridge contract 테스트 작성**

Credential, Billing, AdMob, storage, haptic, lifecycle가 동일 adapter contract를 충족하는지 검증한다. Domain/render에서 Google SDK 문자열 import가 발견되면 실패한다.

- [ ] **Step 2: shell 선택 고정**

기존 WebView bridge를 보존하는 얇은 Capacitor/native container를 사용한다. gameplay core fork는 금지한다.

- [ ] **Step 3: sandbox integration**

Credential Manager 로그인, Billing test purchase/restore, AdMob test ad, safe area, background/resume를 sandbox에서 검증한다.

- [ ] **Step 4: release gate**

Run: `npm test && npm run typecheck && npm run build && npm run preflight:release`

Expected: local PASS. AAB build/실기기/store upload는 별도 Owner 명령에서 수행한다.

- [ ] **Step 5: 커밋**

Commit intent: `feat: add google play runtime bridge`

### Task 21: Apps in Toss-compatible shell

**Files:**
- Create: `granite.config.ts`
- Create: `src/platform/apps-in-toss/AppsInTossBridge.ts`
- Create: `src/platform/apps-in-toss/AppsInTossContract.test.ts`
- Modify: `src/platform/AppsInTossAdapter.ts`
- Modify: `src/platform/PlatformAdapterFactory.ts`
- Modify: `package.json`
- Modify: active lockfile

- [ ] **Step 1: SDK/version/load-order guard 작성**

`@apps-in-toss/web-framework >= 2.10.5`를 package/lock/installed에서 모두 검증한다. banner attach/load와 fullscreen/rewarded load를 직렬화하는 계약 테스트를 추가한다.

- [ ] **Step 2: runtime channel contract**

모든 login/ad/IAP/telemetry 요청이 `sandbox | toss_private_test | toss_live`와 safe metadata를 전달하도록 한다.

- [ ] **Step 3: private-test integration**

Toss login, storage, haptic, rewarded lifecycle, safe area, background/resume를 `toss_private_test` 실기기에서 검증한다. reward는 `userEarnedReward`, flow 완료는 `dismissed`/grace로 분리한다.

- [ ] **Step 4: release gate**

Run: `npm test && npm run typecheck && npm run build && npm run preflight:release`

Expected: local PASS. `ait deploy -m <actual-change-memo>`는 별도 Owner 배포 명령에서만 수행한다.

- [ ] **Step 5: 커밋**

Commit intent: `feat: add apps in toss runtime bridge`

## 최종 검증 매트릭스

| Gate | 필수 증거 |
|---|---|
| Stage 1 | focused tests, full tests, typecheck, 390×844 layout, no stale progress |
| Stage 2 | fresh storage guided run, reload resume, ko/en, event cardinality |
| Stage 3 | real speaker/haptic, cold-start transfer, 360/390/412 viewports, lifecycle |
| Stage 4 | local retention rules, remote telemetry write, offline cloud conflict |
| Stage 5 | tamper fixtures, identity-bound remote runs, sandbox receipts, private device |
| Release | preflight, real-device QA, store/platform checklist, explicit Owner deploy command |

## Self-review 결과

- Spec coverage: 직전 감사의 1~5를 모두 task에 연결했다.
- Placeholder scan: 실행을 막는 미정 구현은 없다. product 수치는 `retention.json`과 첫 cohort로 조정 가능하게 분리했다.
- Type consistency: 진행 결과는 모든 단계에서 `ProgressRecordOutcome { snapshot, delta }`; identity는 cloud/ranked/entitlement에서만 요구한다.
- Scope guard: 실시간 multiplayer, 능력치 강화, battle pass, 강제 광고, AI UX는 포함하지 않는다.
