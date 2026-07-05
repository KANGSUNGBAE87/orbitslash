# 2026-07-01 Phase 0-4 Implementation

Actor: codex

## User Request

Use subagents and implement Phase 0 through Phase 4 in order. Record all QA
items and check the roadmap checklist as work progresses.

## Subagents Used

- Beauvoir (`planner`, read-only): reviewed contract order, `GameScene`
  `RunConfig` risks, Phase 3 minimum viable scope, and Phase 4 Pixi app-shell
  approach.
- Goodall (`reviewer`, read-only): reviewed missing automated tests, manual QA
  risks, and which roadmap checkboxes could or could not be marked complete.

## Implemented

- Phase 0 contracts:
  - Added `ModeConfig` with six `ModeId` values, `ModeDefinition`, `RunRules`,
    `SeedPolicy`, `ObjectiveType`, `RevivePolicy`, `RunEndReason`,
    `ModeResult`, and config layer order.
  - Added mode i18n keys in Korean and English.
- Phase 1 combat core:
  - `GameScene` now starts from `RunConfig` rather than a hardcoded Rookie
    constant.
  - `RunSession` and `RunSummary` now include `modeId`, explicit end reason,
    and full skill-use counts.
  - Timer-limited run support exists for 60s Blitz.
  - Wave duration, boss interval, difficulty, skill slots, and HUD mode read
    from `RunConfig`.
- Phase 3 common content:
  - Added Orbital Cut activation, cost/cooldown, AOE hit rules, VFX, and tests.
  - Added Delta Shield activation, shield timer, absorb count, Earth-hit damage
    prevention, and tests.
  - Added special object contract for friendly rescue, satellite, energy
    capsule, and EMP mine.
  - Added five boss definitions and enemy data.
- Phase 4 app shell:
  - Added `AppState` reducer and `AppShell` Pixi overlay.
  - App now opens on home, supports mode select, launches gameplay by mode, and
    shows result actions for retry, mode select, and home.
  - Added local progression storage through the platform storage adapter.

## Files Changed

- `src/game/ModeConfig.ts`
- `src/game/AppState.ts`
- `src/game/GameScene.ts`
- `src/game/GameApp.ts`
- `src/game/RunSession.ts`
- `src/game/RankingSystem.ts`
- `src/game/SkillSystem.ts`
- `src/game/SpecialObjectSystem.ts`
- `src/game/BossDefinitions.ts`
- `src/game/ProgressStore.ts`
- `src/render/AppShell.ts`
- `src/data/enemies.json`
- `src/data/skills.json`
- `src/i18n/ko.json`
- `src/i18n/en.json`
- related tests under `src/game`, `src/render`, and `src/platform`
- `ai/plans/master-roadmap.md`
- `ai/reviews/review.md`
- `ai/reviews/phase0-4-qa-checklist.md`

## Verification

- `npm test`: 46 files / 209 tests passed.
- `npm run build`: passed.
- `npm run preflight:release-boundary`: passed.
- Local dev server HTTP smoke: `http://127.0.0.1:5190/` returned `200 OK`.

Browser visual smoke was attempted with Playwright, but the local Playwright
browser binary is not installed in this environment, so no visual screenshot
evidence was produced.

## Remaining QA

- Real-device touch feel for slash, same-stroke re-entry, combo timeout, and
  non-lethal hit shake.
- Real-device skill QA for Solar Lance, Gravity Slow, Orbital Cut, and Delta
  Shield gesture false positives.
- Mobile visual QA for the new home -> mode select -> gameplay -> result flow.
- Persistent Delta Shield HUD indicator.
- Runtime spawn/render wiring for special objects.
- Runtime boss weak-point/phases/patterns and final art assets beyond the first
  boss.
- Mode-specific data for Story, Boss Rush, 60s Blitz, and Daily.

## Knowledge Promotion

No cross-project knowledge promotion needed. This is project-specific roadmap
and implementation state.
