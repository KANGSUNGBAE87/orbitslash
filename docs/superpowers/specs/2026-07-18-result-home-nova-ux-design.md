# Orbit Slash Result, Home Start, and Nova Pulse UX Design

Status: approved
Date: 2026-07-18
Owner approval: "서브에이전트 활용해서 모두 구현해줘"

## Goal

Close the remaining UX gaps discussed in the current session without changing the existing combat economy:

1. Replace the crowded result paragraph with a structured, overlap-safe result hierarchy.
2. Make the Home primary action say what it will actually do.
3. Teach Nova Pulse at unlock time and during play, including useful near-miss feedback.

## Current-State Findings

- Skill cooldowns are already independent and the HUD ring fix is complete. The shared skill gauge remains canonical and is out of scope.
- Home already routes new or unfinished players into guided Story 1 and spawns a scripted target immediately. The remaining defect is that the CTA still says only `시작`, hiding that behavior.
- Result flow state already supports `summary -> unlock_reveal -> collection_choice`, but `AppShell` appends every value and unlock label into one `Text` object. Dense results therefore lose hierarchy and can collide with the unlock/action area.
- Nova Pulse activation is implemented, but the opening tutorial only says `바깥 플릭`. There is no exact unlock guide or typed reason for a gesture that nearly matched Nova Pulse.

## Non-Goals

- Do not replace the shared skill gauge with per-skill resources.
- Do not alter Nova Pulse damage, radius, gauge cost, cooldown, or target cap.
- Do not add a new backend table, remote migration, deployment, or telemetry event family.
- Do not rewrite the whole `AppShell` screen system or introduce React.

## Design Direction

Keep the canonical premium 2.5D sci-fi language: deep navy surfaces, cyan energy, gold primary actions, violet unlocks, and red only for failure/destructive state. The external UI verifier's pixel-art and green-CTA proposal diverges from the canonical design and is rejected; only its contrast, responsive, focus, and reduced-motion checks are retained.

React Bits will not be installed because this is a PixiJS application without React. This pass adds no new motion; existing motion/reduced-motion behavior remains unchanged.

## Result Screen

### Information hierarchy

1. Outcome title and mode context.
2. Four primary stat cards: score, survival time, max combo, remaining energy.
3. A compact mode-detail card for boss progress, objective, Story stage, Daily modifier, or ranking state.
4. A dedicated unlock card area. Unlock information never joins the stat/detail text.
5. Action row: the primary action follows `retryDestination` (`sameRun` -> Retry, `modeSelect` -> Modes, `home` -> Home). Remaining destinations are secondary/tertiary. The unlock/Collection action occupies its own row above them.

### Layout boundary

Create a pure `ResultLayout` module that returns rectangles for header, stat grid, detail card, unlock cards, unlock action, and bottom action row. It accepts content density, root scale/touch-size, and safe-area inputs. Tests must prove that all active rectangles stay inside the panel and do not overlap in Korean or English dense-result cases, including the real first-boss density of at least seven unlock cards. The root container already applies the safe-area origin, so the layout applies only the remaining bottom inset once.

### Presentation boundary

Extend `ResultViewModel` to return structured stat cards, detail rows, and unlock cards. `AppShell` renders one Pixi `Text` per semantic value instead of constructing one newline-delimited paragraph. Success, survive, and failure tones control title/border accent without changing result logic.

Ranked-result updates use an `AppShell.updateResult()` path that replaces the presentation data without resetting the current result outcome or `summary -> unlock_reveal -> collection_choice` step.

## Home Primary Action

Extend `HomeViewModel` with a presentation-only primary action:

- `start_guided_story`: `첫 훈련 시작` / `Story 1에서 유성 베기부터 배웁니다`.
- `resume_guided_story`: `훈련 계속하기` / the current tutorial step label.
- `open_recommended_mode`: `모드 선택` / `해금된 모드에서 다음 전투를 고릅니다`.

`HomeFlowPolicy` remains the behavioral source of truth. The scene keeps its immediate scripted spawn. A short target-entry pulse and the existing tutorial message make the first enemy visible without adding a new wait state.

## Nova Pulse Guidance

### Exact user instruction

`지구 표면 가까이에서 시작해 바깥쪽으로 빠르고 곧게 플릭`.

The unlock card also shows `게이지 64`, `쿨타임 18초`, and the existing outward-arrow gesture icon. Solar Lance copy explicitly contrasts it as a long line through Earth.

### Shared gesture visual

Move the private HUD gesture drawing helper to `src/render/SkillGestureIcon.ts`. HUD and result unlock cards use the same renderer so the icon cannot drift.

### Evaluation and feedback

Add a pure, stateless Nova Pulse evaluator with a discriminated result. Repeated evaluation never mutates cooldown or gauge; only successful `tryNovaPulse()` starts cooldown. Successful evaluation preserves the existing activation. Failed evaluation uses one fixed rejection priority and may return one of:

- `cooldown`
- `gauge`
- `start_too_far`
- `endpoint_too_close`
- `too_short`
- `not_straight`
- `too_slow`
- `not_candidate`

Only a strong outward radial candidate may show one gesture coaching message per stroke. Solar Lance, circle, spiral, triangle, ordinary slash, Nova-disabled input, and any stroke that successfully activates another skill must remain silent. Coaching is visual feedback only and must not consume the gesture, combo, kill, or ordinary slash resolution.

When Nova Pulse is enabled, the opening skill tutorial prioritizes the exact Nova instruction instead of the generic five-skill sentence, except that an active boss weakpoint or guided-Story instruction has higher priority. Successful Nova use suppresses further near-miss feedback for the current run; restarting a run resets that suppression. Cost and cooldown copy come from the active RemoteConfig skill definition, not duplicated constants.

## Accessibility and Platform Constraints

- Korean and English copy must remain i18n-backed.
- Text contrast must remain at least 4.5:1 for body/stat labels.
- Touch targets remain at least 48 CSS px after root scaling.
- Safe-area bottom inset must not cover the action row.
- Reduced-motion disables count-up/reveal translation while keeping final state visible.
- No native browser controls or new platform SDK calls are introduced.

## Acceptance Criteria

- Dense Boss Rush and first-boss results with seven or more unlocks have no text/button overlap.
- Unlock reveal renders dedicated cards and never appends raw IDs to result text.
- All result actions remain reachable in Korean and English at 360, 390, and 430 CSS-pixel widths.
- Result primary action matches `retryDestination`, and a ranked async update preserves the current outcome and result-flow step.
- Result action targets remain at least 48 CSS px after root scaling, with bottom safe area applied once.
- Home primary CTA and hint match the actual onboarding action for new, resumed, and completed states.
- Nova unlock card states the exact gesture, cost, and cooldown.
- A valid Nova gesture still activates with unchanged balance values.
- Strong Nova near-misses show the deterministic reason once per stroke; unrelated or other-skill gestures show no Nova feedback and normal slash/combat resolution remains intact.
- Focused tests, full tests, typecheck, build, and local visual QA pass.
