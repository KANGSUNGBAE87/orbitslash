# 2026-07-05 P0 AppShell Contract Cleanup

Actor: codex

## User Request

- Continue the current checklist implementation with subagent-backed planning already completed.
- Close P0 drift where app-shell surfaces still leaked raw ids, stale labels, or non-functional settings.

## Decisions Made

- Treat AppShell labels as contract output: user-visible mode, boss, daily modifier, ranking state, result, records, and collection text must come from canonical definitions and i18n keys.
- Keep the settings screen small for now: locale switch only, with future audio/haptics/settings work still deferred.
- Keep boss labels in English display names for both ko/en locale until final brand naming changes.

## Files Changed

- `src/render/AppShell.ts`
  - Added a real Settings surface and `triggerSettingsAction`.
  - Rebuilds static shell screens when locale changes.
  - Localizes records, result extras, collection, mode details, lock/coming-soon states, progress labels, and number formatting.
- `src/render/AppShell.test.ts`
  - Added coverage for locale switching, canonical collection labels, localized result metadata, and no raw mode/boss/daily ids in visible shell text.
- `src/game/ProgressStore.ts`
  - Localizes `ModeProgressSummary.bestLabel` and `progressLabel`.
- `src/game/SkillSystem.ts`
  - Updated stale header comment from the old 4-skill Phase 1 note to the current 5-skill contract.
- `src/i18n/ko.json`, `src/i18n/en.json`
  - Added missing shell/progress/result/ranking/boss keys.
- `src/i18n/i18nParity.test.ts`
  - Added parity coverage for boss labels, mode definitions, daily/free-defense labels, shell, progress, result, and ranking-state keys.
- `ai/reviews/review.md`, `ai/plans/master-roadmap.md`
  - Recorded the cleanup and updated current verification evidence.

## Verification

- `npm test -- src/render/AppShell.test.ts src/i18n/i18nParity.test.ts src/game/ProgressStore.test.ts --run`
  - Passed: 3 files / 34 tests.
- `npm test -- --run`
  - Passed: 63 files / 355 tests.
- `npm run build`
  - Passed.
- `npm run preflight:release-boundary`
  - Passed.
- `git diff --check`
  - Passed.
- `graphify update . --no-cluster`
  - Passed: 2627 nodes / 169771 edges.
- cmm CLI refresh
  - Passed after MCP transport fallback: project ready with 2690 nodes / 5617 edges.

## Remaining Risks

- Worktree is still very large and includes many prior uncommitted files; commit boundaries need careful staging before any deploy/release push.
- Settings persistence is not implemented yet; locale is runtime-only.
- Real-device QA for mode shell readability and boss/tutorial screens remains pending.
- cmm MCP transport was unavailable earlier in this continuation with `Transport closed`; direct file reads were used during implementation, then the project index was refreshed successfully through the cmm CLI.

## Next Steps

1. Continue P0/P1 checklist toward real Boss Pattern Batch A feel: Ringed Destroyer weak-point/body/shard pattern polish beyond the current telegraph and blocked-hit feedback.
2. Add settings persistence when broader platform settings are ready.
3. Before deploy, stage only the intended files because this repository still has many unrelated/uncommitted prior changes.

## Knowledge Promotion

- No cross-project knowledge-store promotion needed. This was project-local contract cleanup.
