---
version: 0.4
status: active
updated: 2026-07-05
canonical: false
---

# Phase 0-4 QA Checklist

This file records QA items created by the Phase 0-4 implementation pass. Keep
this as a focused evidence checklist; canonical rolling QA remains
`ai/reviews/review.md`.

## Change Log

- 2026-07-05 (codex): Split boss-art status into local/prototype asset coverage
  versus final artist-supplied asset replacement. Added app-shell preload
  coverage for every shipped enemy and boss asset.
- 2026-07-05 (codex): Updated latest local verification after local-readiness
  closure and release-boundary hardening.
- 2026-07-05 (codex): Updated after platform telemetry context pass.

## Automated Verification

- [x] `npm test`: 59 files / 340 tests passed on 2026-07-05 after Story full-plan pass.
- [x] `npm run build`: passed on 2026-07-05 after Story full-plan pass.
- [x] `npm run preflight:release-boundary`: passed on 2026-07-05, including production bundle QA-token leakage scan.
- [x] Historical local dev server visual smoke: `http://127.0.0.1:5187/`.
- [x] P0/P1/P2 targeted tests passed on 2026-07-04.
- [x] Browser visual smoke: mobile 390x844 DEV QA launcher, Blitz, Boss Weak, and Special buttons launch the matching QA mode/preset and render with no console warnings/errors.
- [x] Production bundle check: no `qaMode`, `qaPreset`, or `qaGauge` strings in `dist`.
- [x] DEV QA recorder tests: all four carryover scenarios have launch params, pass criteria, PASS/PEND storage normalization, QA progress isolation, and `progress off` result labeling.
- [x] 2026-07-05 Playwright re-smoke of the new QA recorder: Boss Weak PASS stored, boss QA mode launched, no console/page errors.
- [x] Story/Daily objective tests: Story basic slash, Last Save, protect-object, combo mastery, boss-threat pass/fail, Daily no-skill/rescue/Last Save/Boss Alert/Master Trial pass/fail, and GameScene objective endReason integration.
- [x] Latest full regression: `npm test -- --run` passed with 78 files / 489 tests on 2026-07-05 after platform telemetry context pass.
- [x] AppShell automated mode-start smoke: Story, Free Defense, Ranked, Boss Rush, 60s Blitz, and Daily detail screens emit the expected start payloads.
- [x] Automated mode-matrix hardening: Story locked-stage/raw-id guards, ranked local-only result boundary, Blitz survived result semantics, failed Story/Daily non-progression, Daily boss/master fail cases, and Boss Rush runtime sequence display.
- [x] Latest build/preflight: `npm run build`, `npm run preflight:release`, and `git diff --check` passed on 2026-07-05 after platform telemetry context pass.
- [x] Latest local in-app browser smoke: `http://127.0.0.1:5191/` rendered one canvas at 390x844, launched gameplay from home, and reported no app console errors.

## Phase 0 Contract QA

- [x] Six `ModeId` values exist in stable order.
- [x] Mode definitions have label/description keys.
- [x] Ranked uses `serverAssigned` seed policy, no revive, ranking eligibility,
  and survival-time-first scoring priority.
- [x] 60s Blitz uses a 60-second duration limit and score-first objective.
- [x] Five release skills are enabled, including Nova Pulse.
- [x] Release checklist stale verification numbers refreshed after latest full regression.

## Phase 1 Combat Core QA

- [x] `GameScene` starts from `RunConfig` difficulty and seed.
- [x] `RunSession` records `modeId`, seed, difficulty, skill use, and explicit
  end reason.
- [x] Timer-limited run support exists for 60s Blitz.
- [x] Wave duration, boss interval, skill slots, and HUD mode read from
  `RunConfig`.
- [x] Story fixed-pattern runtime objective evaluation exists for all five release-slice stages.
- [x] Boss Rush sequence completion end reason exists and automated contracts cover sequence completion.
- [x] Daily challenge failure path exists through modifier objective evaluation and `daily_challenge_failed`.

## Phase 2 Real Device QA Still Required

- [ ] General slash immediate contact feel.
- [ ] Tap/tiny movement should not damage enemies.
- [ ] Same-stroke exit/re-entry hit feel.
- [ ] Combo timeout feel after long drag.
- [ ] Solar Lance release after hitting enemies in dense waves.
- [ ] Gravity Slow intended-circle success and open-gesture false positives.
- [ ] Orbital Cut long-orbit gesture false positives.
- [ ] Delta Shield triangle gesture false positives.
- [x] Automated mobile browser smoke for top time, 5-slot HUD, thicker wave bar, and bottom Earth Energy fit.
- [ ] Real-device safe-area fit with browser/WebView chrome.
- [x] DEV QA screen includes `Touch/HUD` for real-device safe-area/touch/HUD pass marking.
- [x] Automated mobile browser smoke for boss warning, boss remaining-hit HUD, and weak-point overlay.
- [ ] Boss warning and remaining-hit readability on real phone.
- [x] DEV QA screen includes `Boss Weak`, `Special`, and `Blitz` pass markers for the remaining P0/P1/P2 carryover checks.

## Phase 3 Content QA

- [x] Orbital Cut activation, cost/cooldown, AOE hit, VFX, and tests exist.
- [x] Delta Shield activation, timing, absorb count, damage prevention, and
  tests exist.
- [x] Special object contract exists for friendly rescue, satellite, energy
  capsule, and EMP mine.
- [x] Five boss definitions and enemy data exist.
- [x] Delta Shield needs persistent HUD indicator beyond activation banner.
- [x] Special objects need runtime spawn/render wiring.
- [x] Friendly rescue failure feedback needs real gameplay wiring.
- [x] Boss weak points/phases need runtime pattern and VFX wiring.
- [x] Delta Shield no longer instantly defeats bosses; boss impacts are shield-knocked back and still require boss HP/weak-point play.
- [x] Local/prototype art assets exist for all five release bosses and are in the
  app-shell preload set.
- [ ] Final artist-supplied boss art replacements remain pending.

## Phase 4 Product Flow QA

- [x] App starts on home shell instead of immediately starting gameplay.
- [x] Mode select renders six mode cards.
- [x] Mode cards render as a 3x2 grid.
- [x] Selecting a mode opens mode detail; the detail start action launches a `GameScene` with that mode's `RunConfig`.
- [x] Result overlay offers retry, mode select, and home actions.
- [x] Local progression records best score/survival through platform storage.
- [ ] Manual mobile visual smoke of home -> modes -> gameplay -> result.
- [x] Mode card lock/progress states.
- [x] Ranking/records screen.
- [x] Mode-specific result stats and ranking submission state.
- [x] Free Defense mode detail surfaces difficulty, practice presets, and today's standard-play limit.
- [x] Boss Rush mode detail/result surfaces sequence, weak-point hint, local-unranked state, and boss-count progress.
- [x] Settings/collection screens beyond placeholder entry points.

## Follow-Up Priority

1. Run real-device QA on the new app shell and five-skill build.
2. Real-device QA for persistent Delta Shield HUD and protect/avoid special objects.
3. Real-device QA for boss weak-point readability and 60s Blitz pacing.
4. Continue Story/Daily beyond current Story 1-5 and five daily modifier contracts after boss-pattern feel stabilizes.
