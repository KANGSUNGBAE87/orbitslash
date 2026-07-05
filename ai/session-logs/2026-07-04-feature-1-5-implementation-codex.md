# 2026-07-04 Feature 1-5 Implementation

Actor: codex

## User Request

성배님 asked to use subagents, explicitly including Claude, and implement all planned feature groups:
boss runtime, special object runtime, fifth skill, six-mode rules, and progression/collection.

## Subagents

- `code-mapper` subagent mapped implementation boundaries and conflict risks.
- `game-logic-reviewer` subagent reviewed balance/rules risks.
- Claude CLI was checked with `claude auth status --text`, which reported logged in, but actual prompt execution failed with `401 Invalid authentication credentials`. The implementation therefore proceeded in degraded mode with Codex subagents and main Codex integration.
- `reviewer` subagent was dispatched for final read-only diff review.

## Implemented

- Replaced the stub boss system with `BossEncounterRuntime`.
- Added boss rush sequence scheduling, periodic boss scheduling, defeated boss tracking, and boss phase lookup.
- Added `SpecialObjectRuntime` for seeded special-object spawn, TTL expiry, hit application, and friendly rescue expiry reward.
- Replaced the planned fifth slot with `nova_pulse`.
- Added Nova Pulse gesture detection, cooldown, gauge cost, radius, damage, push, and target cap.
- Added `ModeRuleEngine` to split boss rush, blitz, ranked, daily, and normal runtime rules.
- Expanded local progress storage to v2 with profile totals, unlocks, and collection state.
- Added unlock rules for boss codex, Boss Rush, and Nova Pulse.
- Connected AppShell collection action and a first collection panel.
- Wired GameScene to boss runtime, special object runtime, Nova Pulse, boss sequence completion, special object drawing, special object effects, boss kill result fields, and five active HUD skill slots.

## Files Changed

- `src/game/BossSystem.ts`
- `src/game/BossSystem.test.ts`
- `src/game/SpecialObjectRuntime.ts`
- `src/game/SpecialObjectRuntime.test.ts`
- `src/game/ModeRuleEngine.ts`
- `src/game/ModeRuleEngine.test.ts`
- `src/game/UnlockSystem.ts`
- `src/game/SkillSystem.ts`
- `src/game/SkillSystemNova.test.ts`
- `src/game/ModeConfig.ts`
- `src/game/ModeConfig.test.ts`
- `src/game/ProgressStore.ts`
- `src/game/ProgressStore.test.ts`
- `src/game/ScoringSystem.ts`
- `src/game/ScoringSystem.test.ts`
- `src/game/RankingSystem.ts`
- `src/game/RunSession.ts`
- `src/game/types.ts`
- `src/game/GameScene.ts`
- `src/game/GameApp.ts`
- `src/render/AppShell.ts`
- `src/render/AppShell.test.ts`
- `src/data/skills.json`
- `src/i18n/ko.json`
- `src/i18n/en.json`

## Verification

- Initial implementation verification passed, then reviewer found blocking issues.
- After fixes, `npm test` passed: 52 test files, 234 tests.
- `npm run build` passed.
- `npm run preflight:release-boundary` passed.
- `git diff --check` passed.

## Reviewer Findings Addressed

- Fixed boss respawn scheduling to use game `elapsedMs` instead of pointer `performance.now()` timestamps.
- Added boss defeat helper so normal kills and Delta Shield boss absorption both update boss runtime, boss kill count, and defeated boss codex IDs.
- Changed local ranked runs to `rankingEligible: false`; only server-configured ranked runs are eligible.
- Preserved retry seed by default instead of silently creating a new seed.
- Added runtime boss countdown support for boss rush and mode-specific boss schedules.
- Backfilled ProgressStore v1 records with `bestBossKills: 0` and merged default unlocks/collection arrays during v2 normalization.

## Remaining Risks

- Claude runtime could not participate because prompt execution failed with 401 despite auth status reporting login.
- Special object balance still needs product decision: current implementation keeps existing contract where `friendlyRescue` is the primary avoid object and the others are beneficial. The game-logic review recommended making at least one more special object negative or escort-based to better break the "slice everything" habit.
- Ranked still uses local app start flow for now, but local ranked runs are no longer marked ranking eligible. Server-assigned seed/runToken enforcement remains a backend release task.
- Boss weak-point definitions exist and phase lookup works, but weak-point positional hit resolution is still a follow-up polish item rather than a complete pattern system.
- Collection panel is a first functional surface, not the final collection UX.

## Next Steps

- Apply final reviewer findings if any.
- Refresh project Graphify after verified feature completion.
- Optional next implementation: positional boss weak-point hit resolver and special-object balance pass.
