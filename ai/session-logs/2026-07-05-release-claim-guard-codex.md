---
date: 2026-07-05
actor: codex
topic: release-claim-guard
---

# Session Log — Release Claim Guard

## User Request

- Continue at high speed.
- Keep progressing through the remaining checklist.

## Subagents Used

- `reviewer` audited the current release-readiness surface. It flagged
  overclaiming and ambiguity risks in package metadata, records copy, DEV QA
  labels, and release checklist wording.
- Two additional `reviewer` passes audited the mode-matrix closure. They flagged
  result-title semantics, a mode-detail flow overclaim, and missing Daily
  failure edge tests; all three were fixed locally.

## Decisions

- Do not claim Google Play / Apps in Toss release readiness while the current
  build is still local web playable with release prep only.
- Keep public leaderboard language gated behind verified remote rows and
  account-linked accepted runs.
- Allow references to secret variable names, but prohibit exposing the actual
  secret value in repo, logs, screenshots, bundles, or public env.
- Local DEV QA labels should be localized like the rest of the app shell.
- No remote Supabase migration apply, Edge deploy, GitHub deploy, or store action
  was performed in this batch.

## Files Changed

- `package.json`
- `ai/plans/product-plan.md`
- `src/game/DevQa.ts`
- `src/game/DevQa.test.ts`
- `src/i18n/en.json`
- `src/i18n/i18nParity.test.ts`
- `src/i18n/ko.json`
- `src/i18n/releaseClaims.test.ts`
- `src/game/TutorialHudState.test.ts`
- `src/platform/ReleaseBoundary.test.ts`
- `src/platform/ReleasePrepScript.test.ts`
- `src/render/AppShell.ts`
- `src/render/AppShell.test.ts`
- `scripts/check-release-boundary.mjs`
- `scripts/check-release-prep.mjs`
- `vite.config.ts`
- `src/game/GameSceneBossIntegration.test.ts`
- `src/game/GameSceneSkillRelease.test.ts`
- `src/game/HitFeedback.ts`
- `src/game/HitFeedback.test.ts`
- `src/game/BossSystem.ts`
- `src/game/BossSystem.test.ts`
- `src/platform/ReleaseTarget.ts`
- `src/platform/ReleaseTargetDocs.test.ts`
- `src/platform/ReleaseBoundary.ts`
- `src/game/SpecialObjectRuntime.ts`
- `src/game/SpecialObjectRuntime.test.ts`
- `src/game/SpecialObjectSystem.ts`
- `src/game/ModeConfig.ts`
- `src/game/ModeConfig.test.ts`
- `src/game/ModeRuleEngine.ts`
- `src/game/ModeRuleEngine.test.ts`
- `src/game/WaveGenerator.ts`
- `src/game/WaveGenerator.test.ts`
- `src/i18n/i18nParity.test.ts`
- `src/i18n/ko.json`
- `src/i18n/en.json`
- `src/render/Hud.ts`
- `src/render/Hud.test.ts`
- `ai/plans/master-roadmap.md`
- `ai/reviews/phase0-4-qa-checklist.md`
- `ai/reviews/release-checklist.md`
- `ai/reviews/review.md`

## Verification

- `npm test -- --run`: 75 files / 466 tests passed after the latest local gameplay batch.
- Added AppShell automated six-mode start smoke: Story, Free Defense, Ranked, Boss Rush, 60s Blitz, and Daily detail screens emit the expected start payloads.
- Added automated mode-matrix hardening: Story locked-stage/raw-id guards, ranked local-only result boundary, Blitz survived result semantics, failed Story/Daily non-progression, Daily boss/master fail cases, and Boss Rush runtime sequence display.
- Added result-title semantics: clear/survived runs now show `클리어`/`생존`
  instead of always showing `게임 오버`.
- Added Daily edge coverage for failed protect, missing Last Save at time limit,
  and Master Trial protect failure.
- Corrected the Phase 4 QA checklist mode flow: mode card opens detail, then the
  detail start action launches gameplay.
- Added local automated guards for Story detail selected-stage/tutorial/unlock
  summary and Ringed Destroyer ring/body/core tutorial copy.
- Added dedicated blocked weak-point callout for `boss_body_locked` hits:
  `GameScene` now calls `flashBlockedWeakPoint`, `Hud` renders a title/detail
  panel separate from generic banners, and local tests cover visibility,
  wrapping, and longer-than-banner duration.
- Fixed Story detail 390x844 layout overlap by tightening body text and moving
  Story stage controls/start buttons lower.
- Ran local in-app browser smoke at 390x844 for Story detail, Story gameplay
  tutorial, and Boss Rush QA tutorial. Blocked-hit readability was attempted but
  not counted as evidence because the captured state did not clearly prove the
  wrong-body-hit feedback.
- Retried blocked-hit browser smoke on `http://127.0.0.1:5195/`; console
  warnings/errors stayed empty, but the in-app browser canvas drag path still
  did not clearly capture a wrong-body-hit state. Kept real-device/WebView
  readability QA open.
- Split active boss objective copy out of the main boss HP line so mobile HUD
  does not cram boss name, hits, and objective into one row.
- Added `directional.wrongAngle` short hit burst for wrong-direction directional
  rejects, while keeping damage/score/gauge unchanged.
- Added Story/Daily content profiles. Active profiles now adjust enabled skills,
  special-object policy, boss timing/type, spawn pressure, and enemy weight
  bias. Story default/selected stages and Daily modifiers now feed those runtime
  rules.
- Enforced `runConfig.rules.enabledSkills` in release-time skill activation and
  reserve checks, so disabled/no-skill modes do not still fire hidden skills.
- Added deterministic enemy weight bias support to `WaveGenerator`.
- Strengthened danger/Last Save hit feedback by adding band-specific burst
  lifetime, widening danger/Last Save rings, and making Last Save label/ring
  duration clearly stronger than ordinary danger kills.
- Connected active boss phase `spawnWeightMul` into normal wave pressure with a
  conservative interval multiplier, so pressure/enrage phases increase density
  without changing boss spawn timers or shard schedules.
- Added special-object motion scripts: friendly rescue objects drift gently
  toward Earth, satellites orbit in a small path, and capsules/mines remain
  static to keep their hit intent legible.
- Confirmed the project release-order plan from the shared app platform
  standard: Google Play-first release prep while preserving Apps in Toss
  compatibility. No publishing action was taken.
- Added `src/platform/ReleaseTarget.ts` as a small current-target SSOT and
  `ReleaseTargetDocs.test.ts` to guard package/docs alignment without rewriting
  historical product-plan text.
- Added a current release target addendum to `ai/plans/product-plan.md` so the
  original Apps in Toss plan text is preserved but execution points to
  `ReleaseTarget.ts`.
- Extended release-boundary checks so `preflight:release` runs generic,
  Google Play target, and Apps in Toss target scans.
- Split the broad `Leaderboard submission` roadmap item into checked local draft
  submit/outcome boundaries and an unchecked remote identity-bound leaderboard
  submission gate.
- Fixed Boss Rush detail copy to render the runtime boss sequence from `buildRunConfig("bossRush")` instead of static collection order.
- Added result-screen remaining Earth Energy display using existing `hud.energy` copy.
- `npm run build`: passed; Vite chunk-size warning is cleared by setting the
  Pixi-game build threshold to 600 kB.
- `npm test -- --run`: 76 files / 473 tests passed after release target SSOT / target-boundary pass.
- Focused boss/special regression: `npm test -- --run src/game/SpecialObjectRuntime.test.ts src/game/SpecialObjectSystem.test.ts src/game/GameSceneBossIntegration.test.ts src/game/BossSystem.test.ts` passed with 4 files / 35 tests.
- Focused release-target regression: `npm test -- --run src/platform/ReleaseBoundary.test.ts src/platform/ReleasePrepScript.test.ts src/platform/ReleaseTargetDocs.test.ts src/i18n/releaseClaims.test.ts` passed with 4 files / 18 tests.
- Target boundary smoke: `node scripts/check-release-boundary.mjs --target=google_play && node scripts/check-release-boundary.mjs --target=apps_in_toss` passed.
- `npm run build`: passed after release target SSOT / target-boundary pass.
- `npm run preflight:release`: passed after release target SSOT / target-boundary pass; Deno check skipped because Deno is not installed in PATH.
- `git diff --check`: passed.
- Local in-app browser smoke at `http://127.0.0.1:5191/`: one canvas rendered at
  390x844, gameplay launched from home, and no app console errors were reported.
- Local dev server was stopped and browser viewport was reset after smoke.
- Local in-app browser smoke at `http://127.0.0.1:5194/`: 390x844 Story detail
  showed selected stage/tutorial/unlock summary after spacing fix; Story gameplay
  tutorial stayed below playfield/top HUD; Boss Rush QA preset showed weak-point
  tutorial copy; console warning/error log was empty for all captured states.
- `graphify update . --no-cluster`: refreshed to 3130 nodes / 315488 edges.
- `codebase-memory-mcp cli index_repository`: refreshed to 3130 nodes / 6269 edges.
- Post-doc check: `npm test -- --run src/game/DocumentationSsot.test.ts src/i18n/releaseClaims.test.ts src/i18n/i18nParity.test.ts` passed with 3 files / 11 tests.
- Post-doc check: `npm run preflight:release` passed again.

## Remaining Risks

- Remote Supabase migrations and Edge Functions remain local drafts only.
- Public leaderboard remains locked until remote identity-bound accepted rows exist.
- Ad/IAP remain bridge/stub only; no real platform SDK integration is enabled.
- Deno CLI is not installed, so Edge Function TypeScript is bundle-checked but not `deno check`ed.
- Real-device touch, WebView safe-area, performance, and boss readability QA are still pending.
- Boss phase wave pressure and moving rescue/satellite objects need real-device
  feel/readability tuning.
- Latest local changes have not been deployed to GitHub Pages.

## Knowledge Promotion

- No new global rule added. Project-local plan, release checklist, QA checklist,
  and review backlog were updated.
