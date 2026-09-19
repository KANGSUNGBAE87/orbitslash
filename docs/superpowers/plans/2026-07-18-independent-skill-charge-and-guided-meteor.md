# Independent Skill Charge And Guided Meteor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스킬 5종의 충전과 쿨타임을 모두 슬롯별로 분리하고, Guided Story 첫 유성이 즉시 충돌해 튜토리얼이 멈추는 문제를 제거한다.

**Architecture:** `SkillChargeBank`가 `SkillId -> charge` 상태와 전체 보상 분배를 소유한다. `SkillSystem`의 쿨타임 맵은 유지하고, `GameScene`은 발동하려는 스킬의 충전값만 전달하며 성공 시 해당 슬롯만 0으로 소비한다. HUD는 바깥 청록 링으로 충전율, 안쪽 주황 링으로 활성 쿨타임 진행률을 동시에 표시한다. Guided Story 목표 유성은 충분한 관찰 시간을 가진 반경에 생성하고 실패 시 재생성하며, 튜토리얼 목표 충돌은 지구 에너지를 깎지 않는다.

**Tech Stack:** TypeScript, PixiJS, Vitest

---

### Task 1: Per-skill charge state

**Files:**
- Create: `src/game/SkillChargeBank.ts`
- Create: `src/game/SkillChargeBank.test.ts`
- Modify: `src/game/SkillCooldownSlots.ts`
- Modify: `src/game/SkillCooldownSlots.test.ts`
- Modify: `src/game/GameScene.ts`
- Modify: relevant `src/game/GameScene*.test.ts`

- [x] **Step 1: Write failing unit tests**

```ts
it("resets only the activated skill charge", () => {
  const bank = new SkillChargeBank(["solar_lance", "nova_pulse"], 100);
  bank.consume("solar_lance");
  expect(bank.get("solar_lance")).toBe(0);
  expect(bank.get("nova_pulse")).toBe(100);
});

it("adds combat gauge to every enabled skill independently", () => {
  const bank = new SkillChargeBank(["solar_lance", "nova_pulse"], 10);
  bank.gainAll(8);
  expect(bank.snapshot()).toMatchObject({ solar_lance: 18, nova_pulse: 18 });
});
```

- [x] **Step 2: Verify RED**

Run: `npx vitest run src/game/SkillChargeBank.test.ts src/game/SkillCooldownSlots.test.ts`

Expected: FAIL because `SkillChargeBank` and per-slot charge resolver do not exist.

- [x] **Step 3: Implement minimal charge bank and GameScene wiring**

```ts
class SkillChargeBank {
  get(skillId: SkillId): number;
  set(skillId: SkillId, value: number): void;
  fillAll(value: number): void;
  gainAll(amount: number): void;
  consume(skillId: SkillId): void;
  snapshot(): Partial<Record<SkillId, number>>;
}
```

Rules:
- combat/special-object/boss gauge rewards call `gainAll`;
- successful activation calls `consume(activatedSkillId)` only;
- `SkillSystem.try*` receives `skillCharges.get(skillId)`;
- existing per-skill cooldown storage remains unchanged;
- legacy test/debug `scene.gauge = value` compatibility may fill all enabled skills, but runtime reward/spend paths must not use the shared alias.

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run src/game/SkillChargeBank.test.ts src/game/SkillCooldownSlots.test.ts src/game/GameSceneSkillRelease.test.ts src/game/GameSceneNovaGuidance.test.ts src/game/GameSceneBossIntegration.test.ts src/game/GameScenePhase3.test.ts`

Expected: PASS and assertions prove A skill use leaves B/C charge unchanged.

### Task 1.5: Ranked client and Edge charge parity

**Files:**
- Modify: `shared/ranked-core/score.ts`
- Modify: `src/game/RankedReplayValidator.test.ts`
- Regenerate: `supabase/functions/_shared/ranked-core/score.ts`
- Regenerate: `supabase/functions/_shared/orbitslash-ranked-core.generated.ts`
- Verify: `src/game/RankedCoreParity.test.ts`
- Verify: `src/platform/RankedEdgeReplaySequence.test.ts`

- [x] **Step 1: Write a failing cross-skill timeline test**

```ts
it("accepts two different ready skills without sharing their spent charge", () => {
  // Earn enough charge for every slot, then cast Solar Lance and Nova Pulse.
  // Solar consumption must not remove Nova charge.
  expect(validateRankedReplaySubmission(summary, trace, tables)).toMatchObject({ ok: true });
});
```

- [x] **Step 2: Verify RED**

Run: `npx vitest run src/game/RankedReplayValidator.test.ts`

Expected: FAIL with `replay_skill_timeline_invalid` because ranked-core still spends one shared gauge.

- [x] **Step 3: Mirror the runtime contract in shared ranked-core**

Rules:
- maintain a charge balance per `RankedSkillId`;
- every earned gauge reward is added to every skill balance with the 100 cap;
- a valid cast checks only its own balance and resets that balance to 0;
- other skill balances and existing per-skill cooldown timestamps remain unchanged;
- return a per-skill remaining-charge snapshot for diagnostics;
- update only `shared/ranked-core`, then run the canonical generator for Edge copies.

- [x] **Step 4: Regenerate and verify parity**

Run:

```bash
node scripts/generate-ranked-edge-core.mjs
npx vitest run src/game/RankedReplayValidator.test.ts src/game/RankedCoreParity.test.ts src/platform/RankedEdgeReplaySequence.test.ts
node scripts/generate-ranked-edge-core.mjs --check
```

Expected: client replay and generated Edge replay accept/reject the same independent-charge timelines.

### Task 2: Visible charge and cooldown rings

**Files:**
- Modify: `src/render/Hud.ts`
- Modify: `src/render/Hud.test.ts`
- Modify: `src/i18n/ko.json`
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/i18nParity.test.ts`

- [x] **Step 1: Write failing HUD tests**

```ts
it("shows the active slot charge percentage while charging", () => {
  // slot.ratio = 0.42, cooldownMs = 0
  expect(status.text).toBe("42%");
});

it("keeps another ready slot ready after one slot enters cooldown", () => {
  // solar: ratio 0/cooldown, nova: ratio 1/no cooldown
  expect(solarStatus.text).toContain("초");
  expect(novaStatus.text).toBe("준비");
});
```

- [x] **Step 2: Verify RED**

Run: `npx vitest run src/render/Hud.test.ts`

Expected: FAIL because charging text is `게이지 부족` and the ring ignores `slot.ratio`.

- [x] **Step 3: Implement dual-ring rendering**

Rules:
- outer cyan arc = `slot.ratio` for charge progress;
- inner orange arc = `slot.cooldownProgressRatio` only while `cooldownMs > 0`;
- charging status = localized percentage;
- cooldown status = localized remaining seconds;
- ready slot keeps gold ready pulse;
- locked state remains dim;
- reduced-motion behavior remains unchanged.

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run src/render/Hud.test.ts src/i18n/i18nParity.test.ts`

Expected: PASS with charge, cooldown, ready, and locked states covered.

### Task 3: Guided Story last-save meteor recovery

**Files:**
- Modify: `src/game/GameScene.ts`
- Modify: `src/game/GameSceneTutorialHud.test.ts` or create a focused guided-scenario runtime test

- [x] **Step 1: Write failing runtime tests**

```ts
it("keeps the first Last Save target observable before impact", () => {
  expect(observableTravelMs).toBeGreaterThanOrEqual(2500);
});

it("respawns the Last Save target after an uncut impact without damaging tutorial energy", () => {
  expect(scene.energy.current).toBe(scene.energy.max);
  expect(aliveTargets).toHaveLength(1);
});
```

- [x] **Step 2: Verify RED**

Run: `npx vitest run <focused-guided-story-runtime-test>`

Expected: FAIL because the current target reaches the impact zone in about 305ms, damages energy by 5, and is not replaced.

- [x] **Step 3: Implement minimal recovery behavior**

Rules:
- spawn the guided target far enough out for at least 2.5s of visible travel;
- if the target reaches Earth before success, suppress tutorial damage and schedule one replacement after a short deterministic delay;
- never spawn duplicates;
- normal wave suppression remains active during the scripted step;
- successful Last Save still advances the tutorial once.

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run src/game/GameSceneTutorialHud.test.ts <focused-guided-story-runtime-test>`

Expected: PASS for travel time, no damage, single respawn, and successful advance.

### Task 4: Integration and evidence

**Files:**
- Modify: `ai/plans/implementation-plan.md`
- Modify: `ai/plans/design-plan.md` only if the canonical visual contract needs clarification
- Create or append: `ai/session-logs/2026-07-18-skill-charge-guided-meteor-codex.md`

- [x] **Step 1: Run focused and full verification**

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

- [x] **Step 2: Run local viewport QA**

Verify at 360px, 390px, and 430px widths:
- charge arcs visibly grow;
- using A does not reset B/C;
- cooldown time appears only on A;
- tutorial target is visible and recoverable;
- no HUD overlap or clipped Korean/English text.

- [x] **Step 3: Record evidence and refresh project Graphify**

Run: `graphify update . --no-cluster`

Expected: plan/session evidence and changed source relationships are discoverable.

## Completion Evidence — 2026-07-18

- Runtime: 5개 스킬 충전·쿨타임 완전 독립, 사용 슬롯만 소비.
- HUD: 바깥 청록 충전 링·퍼센트, 안쪽 주황 활성 쿨타임 링.
- Ranked: client/Edge 동일 독립 충전 계약과 전역 event sequence 검증.
- Guided Story: 관찰 가능한 1HP 목표, 에너지 100 시작, 무피해 재시도, 대상 cohort 격리,
  빗나간 Solar 환불, wave/boss/special backlog 지연.
- Verification: 135 test files / 941 tests, typecheck, production build, generated Edge sync.
- Browser QA: 360×800, 390×844, 430×932에서 HUD 무겹침; 390×844 Guided Story에서
  첫 유성 노출·에너지 100·wave HUD 숨김 확인.
