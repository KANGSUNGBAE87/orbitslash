# Result, Home Start, and Nova Pulse UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an overlap-safe result screen, truthful Home primary CTA, and exact Nova Pulse coaching without changing combat balance.

**Architecture:** Keep `AppShell` as screen orchestration, but move result geometry and presentation into pure modules. Keep onboarding behavior in `HomeFlowPolicy`, expose presentation through `HomeViewModel`, and add a pure Nova evaluator that the existing activation method delegates to. Extract the existing Pixi gesture icon renderer for HUD/result reuse.

**Tech Stack:** TypeScript, PixiJS 8, Vitest, Vite, project i18n, existing onboarding/progression models.

**Dirty-worktree rule:** Preserve all pre-existing changes. Do not commit or stage task changes; use focused diffs and tests as checkpoints because unrelated user work is present on `main`.

---

### Task 1: Structured result presentation and overlap-safe layout

**Files:**
- Create: `src/render/layout/ResultLayout.ts`
- Create: `src/render/layout/ResultLayout.test.ts`
- Modify: `src/render/view-models/ResultViewModel.ts`
- Modify: `src/render/view-models/ResultViewModel.test.ts`

- [ ] **Step 1: Write failing layout tests**

Add tests for summary-only, dense Boss Rush, and unlock-reveal layouts, including an actual first-boss progression fixture that yields at least seven unlock cards. Each active rectangle must be within the panel and pairwise non-overlapping. Verify 360/390/430 CSS-pixel widths and a root-scaled action height of at least 48 CSS px without double-applying the safe-area origin.

```ts
const layout = resultLayout({ detailRows: 3, unlockCards: 4, safeBottom: 24 });
expect(rectsOverlap(layout.detailCard, layout.unlockCard)).toBe(false);
expect(rectsOverlap(layout.unlockAction, layout.actions)).toBe(false);
expect(layout.actions.y + layout.actions.h).toBeLessThanOrEqual(layout.panel.y + layout.panel.h);
```

- [ ] **Step 2: Run RED tests**

Run: `npm test -- --run src/render/layout/ResultLayout.test.ts src/render/view-models/ResultViewModel.test.ts`

Expected: FAIL because the structured layout/presentation API does not exist.

- [ ] **Step 3: Implement the pure layout and view model**

Use explicit types:

```ts
export interface ResultStatCard { id: "score" | "time" | "combo" | "energy"; labelKey: string; value: string }
export interface ResultDetailRow { id: string; labelKey: string; value: string }
export interface ResultPresentation { tone: "failure" | "success" | "survived"; stats: ResultStatCard[]; details: ResultDetailRow[]; unlockCards: ResultUnlockCard[] }
```

Keep raw mode/boss/skill IDs out of user-facing `value` fields. Derive the primary action from `retryDestination`: `sameRun` -> Retry, `modeSelect` -> Modes, `home` -> Home.

- [ ] **Step 4: Run GREEN tests and inspect diff**

Run the focused command from Step 2. Expected: PASS.

Checkpoint: `git diff -- src/render/layout/ResultLayout.ts src/render/layout/ResultLayout.test.ts src/render/view-models/ResultViewModel.ts src/render/view-models/ResultViewModel.test.ts`

### Task 2: Render the redesigned result screen

**Files:**
- Modify: `src/render/AppShell.ts`
- Modify: `src/render/AppShell.test.ts`
- Modify: `src/game/GameApp.ts`
- Modify: `src/game/GameApp.test.ts`
- Modify: `src/i18n/ko.json`
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/i18nParity.test.ts`

- [ ] **Step 1: Write failing semantic-render tests**

Require labels for all stat cards, detail card, seven-or-more unlock cards, unlock action, and action row. Assert that unlock labels are not inside `result-body`, failure/success tones differ, and primary emphasis follows all three `retryDestination` values.

```ts
expect(nodeByLabel(shell.container, "result-stat-score")).toBeTruthy();
expect(nodeByLabel(shell.container, "result-detail-card")).toBeTruthy();
expect(nodeByLabel(shell.container, "result-unlock-card-0")).toBeTruthy();
expect(textByLabel(shell.container, "result-body")).not.toContain("노바 펄스");
```

- [ ] **Step 2: Run RED test**

Run: `npm test -- --run src/render/AppShell.test.ts src/i18n/i18nParity.test.ts`

Expected: FAIL on missing semantic result nodes.

- [ ] **Step 3: Replace the newline paragraph renderer**

Render title, 2x2 stat cards, detail rows, dedicated unlock cards, unlock/Collection action, and bottom actions using `resultLayout()`. Keep `summary -> unlock_reveal -> collection_choice` behavior. Emphasize the destination-selected primary action, use violet unlocks, and retain outcome-specific panel accents. Add `AppShell.updateResult(next)` and route ranked async updates through it so the current outcome and flow step are preserved.

- [ ] **Step 4: Verify result rendering**

Run the Step 2 command. Expected: PASS with no missing i18n keys or raw IDs.

### Task 3: Make the Home primary action truthful

**Files:**
- Modify: `src/render/view-models/HomeViewModel.ts`
- Modify: `src/render/view-models/HomeViewModel.test.ts`
- Modify: `src/render/AppShell.ts`
- Modify: `src/render/AppShell.test.ts`
- Modify: `src/i18n/ko.json`
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/i18nParity.test.ts`

- [ ] **Step 1: Write failing state-mapping tests**

```ts
expect(buildHomeViewModel(newPlayer).primaryAction.kind).toBe("start_guided_story");
expect(buildHomeViewModel(resumingPlayer).primaryAction.kind).toBe("resume_guided_story");
expect(buildHomeViewModel(completedPlayer).primaryAction.kind).toBe("open_recommended_mode");
```

AppShell tests must assert the visible label and hint for all three states while keeping the existing callback wiring.

- [ ] **Step 2: Run RED tests**

Run: `npm test -- --run src/render/view-models/HomeViewModel.test.ts src/render/AppShell.test.ts src/game/onboarding/HomeFlowPolicy.test.ts`

Expected: FAIL because `primaryAction` and home hint nodes are absent.

- [ ] **Step 3: Implement presentation mapping and rendering**

Reuse `resolveHomePrimaryAction()` so behavior and copy cannot disagree. Add `home-primary-hint` below the primary CTA. Do not change guided Story routing or random wave generation.

- [ ] **Step 4: Run GREEN tests**

Run the Step 2 command. Expected: PASS.

### Task 4: Exact Nova Pulse evaluator and coaching

**Files:**
- Create: `src/render/SkillGestureIcon.ts`
- Create: `src/render/SkillGestureIcon.test.ts`
- Modify: `src/render/Hud.ts`
- Modify: `src/game/SkillSystem.ts`
- Modify: `src/game/SkillSystemNova.test.ts`
- Modify: `src/game/TutorialHudState.ts`
- Modify: `src/game/TutorialHudState.test.ts`
- Modify: `src/game/GameScene.ts`
- Modify: `src/game/GameSceneSkillRelease.test.ts`
- Modify: `src/render/view-models/ResultViewModel.ts`
- Modify: `src/render/AppShell.ts`
- Modify: `src/i18n/ko.json`
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/i18nParity.test.ts`

- [ ] **Step 1: Write failing Nova evaluation tests**

Cover valid activation and each rejection reason with a fixed priority. Add repeated stateless evaluation, non-candidate ordinary slash, Solar/circle/spiral/triangle silence, Nova-disabled silence, another-skill-success suppression, one-warning-per-stroke, no slash/combo/kill consumption, successful-Nova run suppression, and restart reset cases.

```ts
expect(system.evaluateNovaPulse(validNova, ctx)).toMatchObject({ ok: true });
expect(system.evaluateNovaPulse(tooSlowNova, ctx)).toEqual({ ok: false, reason: "too_slow", candidate: true });
expect(system.evaluateNovaPulse(ordinarySlash, ctx)).toEqual({ ok: false, reason: "not_candidate", candidate: false });
```

- [ ] **Step 2: Run RED Nova tests**

Run: `npm test -- --run src/game/SkillSystemNova.test.ts src/game/TutorialHudState.test.ts src/game/GameSceneSkillRelease.test.ts`

Expected: FAIL because evaluator/reason feedback does not exist.

- [ ] **Step 3: Implement evaluator without balance changes**

`tryNovaPulse()` delegates to a stateless `evaluateNovaPulse()`. Only successful activation starts cooldown or spends gauge. Preserve the active configured gauge cost/cooldown and the existing radius, damage, push, and target cap. Candidate detection must require a near-Earth outward radial movement so other gestures remain silent; UI copy reads cost/cooldown from active RemoteConfig.

- [ ] **Step 4: Extract and reuse the gesture icon**

Move the current `drawSkillGestureIcon` implementation from `Hud.ts` to `SkillGestureIcon.ts`. Render it in HUD and Nova unlock cards.

- [ ] **Step 5: Connect tutorial and non-blocking near-miss feedback**

When Nova is enabled, show the exact Nova instruction during the opening hint window unless active boss-weakpoint or guided-Story guidance has priority. After all skill checks, a strong Nova near-miss may flash one localized reason but must continue normal slash resolution. Stop near-miss coaching after the first successful Nova in the run and reset on a new run.

- [ ] **Step 6: Run GREEN tests**

Run the Step 2 command plus `npm test -- --run src/render/Hud.test.ts src/render/AppShell.test.ts src/i18n/i18nParity.test.ts`.

Expected: PASS, unchanged Nova success values, no warnings for unrelated gestures.

### Task 5: Integration verification and visual QA

**Files:**
- Modify: `ai/session-logs/2026-07-18-result-home-nova-ux-codex.md`
- Update generated graph outputs through the standard Graphify refresh.

- [ ] **Step 1: Run complete automated verification**

Run separately:

- `npm test -- --run`
- `npm run typecheck`
- `npm run build`
- `git diff --check`

Expected: zero failures.

- [ ] **Step 2: Run local visual QA**

Verify failure, cleared, survived, dense Boss Rush, and Nova-unlock result states at 360/390/430 CSS-pixel widths. Verify new/resume/completed Home CTAs, Nova opening guide, near-miss reasons, reduced motion, and safe-area bottom spacing.

- [ ] **Step 3: Independent review**

Run spec-compliance review first, then code-quality review. Fix every Critical or Important finding and re-run focused tests.

- [ ] **Step 4: Persist evidence**

Write the session log with files changed, red/green evidence, full verification, visual QA channel, remaining risks, and no-deploy statement. Refresh Graphify with `graphify update . --no-cluster`.
