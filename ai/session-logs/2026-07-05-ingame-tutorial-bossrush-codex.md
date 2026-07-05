# Session Log — In-Game Tutorial and Boss Rush Weak-Point Callouts

Date: 2026-07-05
Actor: codex

## User Request

Continue the active checklist-driven implementation using subagents, including Claude, until the planned gameplay/product checklist is filled.

## Subagent Input

- Claude CLI first-party auth was valid, but the Claude prompt call hit the current Claude session limit before returning analysis.
- Native `game-logic-reviewer` and `reviewer` subagents reviewed Story/Boss Rush tutorial gaps against product/design plans and current code.
- Consensus: Story and Boss Rush already had data contracts, but gameplay lacked live tutorial callouts. Tutorial must not change seed, objective, weak-point geometry, scoring, or unlock rules.
- Reviewer also found a real existing bug: `GameApp.startRun()` did not forward selected `storyStageId`, so selected Story stages could launch with the default `story-1` seed.

## Decisions Made

- Implement tutorial as a non-modal HUD callout first. It explains live rules without pausing, suppressing input, or changing game timing.
- Keep Story tutorial source of truth in `StoryStageContract.tutorialKey`.
- Keep Boss Rush tutorial tied to `BossHudState.objectiveKey`, so ring/body/core copy follows the active boss phase.
- Fix selected Story stage launch forwarding before relying on Story tutorial copy.
- Add i18n parity coverage for Story and Boss Rush tutorial keys.

## Files Changed

- `src/game/TutorialHudState.ts`
- `src/game/TutorialHudState.test.ts`
- `src/game/GameScene.ts`
- `src/game/GameSceneTutorialHud.test.ts`
- `src/game/GameApp.ts`
- `src/game/GameApp.test.ts`
- `src/render/Hud.ts`
- `src/render/Hud.test.ts`
- `src/i18n/ko.json`
- `src/i18n/en.json`
- `src/i18n/i18nParity.test.ts`
- `src/game/BossShardTelegraph.ts`
- `src/game/BossShardTelegraph.test.ts`
- `ai/plans/master-roadmap.md`
- `ai/plans/story-chapter-plan.md`
- `ai/reviews/review.md`
- `ai/reviews/release-checklist.md`

## Verification Run

- Focused RED/GREEN verified:
  - `GameApp.test.ts` failed first with selected `story-8` launching seed `1001`, then passed after forwarding `storyStageId`.
  - Tutorial HUD tests failed first because `TutorialHudState` and HUD rendering did not exist, then passed after implementation.
- Focused current pass:
  - `npm test -- src/i18n/i18nParity.test.ts src/game/GameApp.test.ts src/game/TutorialHudState.test.ts src/game/GameSceneTutorialHud.test.ts src/render/Hud.test.ts --run`: 5 files / 12 tests passed.
- Full verification:
  - `npm test -- --run`: 63 files / 351 tests passed.
  - `npm run build`: passed, including `tsc --noEmit` and Vite production build.
  - `npm run preflight:release-boundary`: passed.
  - `git diff --check`: passed.
  - `graphify update . --no-cluster`: passed, 2522 nodes / 161229 edges.
  - `codebase-memory-mcp index_repository`: failed with `Transport closed`; cmm may be stale.

## Boss Pattern Batch A Addendum

- Added explicit `boss.weakPointOnly` feedback for blocked body hits on weak-point-locked bosses.
- Added `BossShardTelegraph` and rendered fan-shaped warning lanes for Ringed Destroyer shard volleys.
- Focused check: `npm test -- src/game/BossShardTelegraph.test.ts src/game/BossSystem.test.ts src/game/GameSceneBossIntegration.test.ts --run`: 3 files / 19 tests passed.

## Remaining Risks

- Real-device QA still must verify Story callout readability and Boss Rush phase copy against weak-point visuals.
- Current tutorial is non-modal. A pause/dismiss tutorial remains a future product choice if first-run onboarding needs stronger guidance.
- Claude review was unavailable due session limit, so this batch used native subagents plus direct verification.
- Worktree remains large and uncommitted; commits need careful staging before deployment/release.

## Next Steps

1. Run full automated verification.
2. Refresh project graph if verification passes.
3. Continue with Boss Pattern Batch A or Ranked remote apply/deploy, depending on next priority.

Knowledge promotion: not promoted to `/Users/kangsungbae/Documents/지식저장소` yet; this is project-local implementation evidence.
