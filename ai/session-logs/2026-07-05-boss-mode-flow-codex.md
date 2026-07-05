# 2026-07-05 Boss Mode Flow

Actor: codex

## User Request

- Implement the current plan using subagents, including Claude:
  - organize the large dirty worktree before the next commit
  - Boss Pattern Batch A for Ringed Destroyer
  - Mode Flow completion with Mode Detail, lock/progress cards, mode-specific result stats, and Ranking/Records skeleton

## Subagents

- release/reviewer style audit identified the main risks: dirty staging scope, Ringed Destroyer contract, shield boss bypass, mode progress wiring, result/ranking visibility.
- Boss worker implemented a forked Ringed Destroyer API patch and confirmed targeted/full verification in its worktree.
- Mode worker implemented a forked AppState/ModeConfig state patch and confirmed targeted/typecheck in its worktree.
- Main Codex integrated the compatible pieces into the active worktree and avoided wholesale copying from forked worktrees because the main checkout already had many dirty/untracked files.

## Decisions

- Do not commit or stage yet. The worktree is still large and needs intentional commit grouping.
- Ringed Destroyer now uses weak-point-gated damage:
  - ring weak points during approach
  - body weak point after HP phase transition
  - blocked non-weak boss body hits do not damage or record score/replay hit
- Ringed Destroyer shard pattern now emits warning/spawn events and GameScene converts spawn events into spread `shard_meteor` spawns.
- Boss Rush now starts with Ringed Destroyer so Batch A is the first real boss-feel encounter.
- Mode Detail is the required route from mode cards; cards no longer start runs directly.
- Mode progress comes from `ProgressStore` unlocks and records. Boss Rush is locked by default until unlock rules open it.
- Records/Ranking is a local skeleton for now. Public verified ranking remains a later backend/product task.

## Files Changed

- `src/game/BossDefinitions.ts`
- `src/game/BossSystem.ts`
- `src/game/BossHudState.ts`
- `src/game/GameScene.ts`
- `src/game/types.ts`
- `src/game/AppState.ts`
- `src/game/ModeConfig.ts`
- `src/game/ModeRuleEngine.test.ts`
- `src/game/ProgressStore.ts`
- `src/game/GameApp.ts`
- `src/render/AppShell.ts`
- `src/render/Hud.ts`
- `src/i18n/ko.json`
- `src/i18n/en.json`
- Related tests:
  - `src/game/BossSystem.test.ts`
  - `src/game/BossHudState.test.ts`
  - `src/game/GameSceneBossIntegration.test.ts`
  - `src/game/AppState.test.ts`
  - `src/game/ProgressStore.test.ts`
  - `src/render/AppShell.test.ts`

## Verification

- `npm test -- src/game/BossSystem.test.ts src/game/AppState.test.ts src/game/ProgressStore.test.ts`
  - passed: 3 files / 22 tests
- `npm test -- src/game/GameSceneBossIntegration.test.ts src/game/BossSystem.test.ts`
  - passed: 2 files / 13 tests
- `npm test -- src/render/AppShell.test.ts`
  - passed: 13 tests
- `npm run typecheck`
  - passed
- `npm test`
  - passed: 58 files / 311 tests
- `npm run build`
  - passed
- Local dev server started:
  - `http://127.0.0.1:5185/`

## Remaining Risks

- Delta Shield still has an existing tested behavior that can absorb and record boss defeat. This may undercut Ringed Destroyer weak-point fantasy in Boss Rush and needs an explicit balance decision.
- Records/Ranking screen is a skeleton only; verified Supabase ranking UX and live submission state are not complete.
- No git commit/staging was performed. Use explicit path staging only, never `git add .`.
- Real-device QA remains needed for Boss Rush feel, Ringed Destroyer warning readability, mode detail lock/progress clarity, and records screen readability.

## Next Steps

1. Manually test Boss Rush first boss flow on the dev server.
2. Decide Delta Shield vs boss rule:
   - keep as emergency boss absorb
   - or change to push/stun without counting as boss defeat
3. Add visible Ringed Destroyer asset/pattern polish if the placeholder visual still feels generic.
4. Implement real Records/Ranking data states after public ranking strategy is settled.
5. Split commits carefully by feature boundary.

Knowledge-store promotion: not promoted yet; this is project-local implementation evidence.
