# 2026-07-05 Phase 4 Shell Closure

Actor: codex

## User Request

- Continue the active implementation goal until the project checklists are filled.
- Use subagents, with Claude included when available.

## Subagent / Claude Notes

- Claude CLI auth was valid, but `claude -p` was blocked by session limit until 16:30 KST. This batch proceeded in degraded mode with native subagents and main Codex integration.
- Native planner recommended the Phase 4 closure batch before Phase 3 enemy expansion: boot/loading state machine, safe-area/mobile layout hardening, and closing parent checklist items whose children were already implemented.
- Native reviewer flagged settings AppState drift, bootstrap preload order, GameApp test thinness, safe-area coverage, and boot/loading i18n parity.

## Decisions Made

- Implement Phase 4 closure before enemy expansion because it directly closes product-flow checklist items and is smaller/risk-lower than combat content expansion.
- `AppState` now starts at `boot`, can enter `loading`, and moves to `home` through `APP_READY`.
- `GameApp.init()` owns the loading shell and accepts a `beforeReady` hook so `main.ts` can mount the app before remote/config and visual preload.
- Settings now routes through `GameApp` / `AppState` instead of bypassing state with a shell-only transition.
- Safe-area work is split into two testable layers:
  - `computeRootFit()` handles viewport plus optional safe-area insets.
  - `appShellLayoutMetrics()` exposes logical shell control bounds for safe-area tests.

## Files Changed

- `src/game/AppState.ts`, `src/game/AppState.test.ts`
  - Added `boot` / `loading` screens and `APP_LOADING` / `APP_READY` transitions.
- `src/game/coords.ts`, `src/game/coords.test.ts`
  - Added `computeRootFit()` with optional safe-area insets and mobile viewport tests.
- `src/game/GameApp.ts`, `src/game/GameApp.test.ts`
  - Added loading orchestration, settings state-machine routing, and root-fit resize usage.
- `src/main.ts`, `src/main.test.ts`
  - Exported injectable `bootstrap()` and moved remote/config/asset preload into GameApp `beforeReady`.
- `src/render/AppShell.ts`, `src/render/AppShell.test.ts`
  - Added boot/loading surfaces, visibility snapshot, app shell safe-area metrics, and settings callback.
- `src/i18n/ko.json`, `src/i18n/en.json`, `src/i18n/i18nParity.test.ts`
  - Added boot/loading keys and parity coverage.
- `ai/plans/master-roadmap.md`, `ai/reviews/review.md`
  - Closed Phase 4 checklist items now covered by implementation/tests.

## Verification So Far

- RED:
  - `npm test -- src/game/AppState.test.ts src/render/AppShell.test.ts src/game/coords.test.ts --run`
    failed on missing `boot`, missing `computeRootFit`, missing `showLoading`/visibility/layout metrics.
  - `npm test -- src/main.test.ts --run`
    failed because `bootstrap` was not exported and import side-effect tried to access `document`.
  - `npm test -- src/render/AppShell.test.ts src/game/GameApp.test.ts --run`
    failed because settings did not route through callback/AppState.
- GREEN:
  - `npm test -- src/render/AppShell.test.ts src/game/GameApp.test.ts src/main.test.ts src/game/AppState.test.ts src/game/coords.test.ts src/i18n/i18nParity.test.ts --run`
    passed: 6 files / 49 tests.
- Full verification:
  - `npm test -- --run`
    passed: 65 files / 363 tests.
  - `npm run build`
    passed.
  - `npm run preflight:release-boundary`
    passed.
  - `git diff --check`
    passed.
  - `graphify update . --no-cluster`
    passed: 2660 nodes / 178423 edges.
  - cmm CLI `index_repository`
    passed: 2736 nodes / 5678 edges.

## Remaining Risks

- Real-device safe-area/WebView QA is still required; automated tests cover logical bounds and viewport fit only.
- `GameApp` still has limited integration tests around full Pixi runtime because headless Pixi boot is not cheap to exercise in unit tests.
- Worktree remains very large; staging/commit/deploy must be scoped carefully.

## Next Steps

1. Run full tests, build, release-boundary check, and diff whitespace check.
2. Refresh Graphify/cmm after verification.
3. Continue with the next implementation queue: Phase 3 enemy expansion or Phase 6 ranked backend remote deploy/leaderboard UI, depending on whether gameplay variety or backend readiness is prioritized.

## Knowledge Promotion

- No cross-project promotion needed. This is project-local product-flow implementation.
