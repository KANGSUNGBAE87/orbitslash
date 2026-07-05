# 2026-07-05 Boss Practice / Ranked Hardening

Actor: codex

## User Request

- Continue at high speed from the current roadmap/checklist implementation work.
- Keep implementation moving rather than adding more QA-only backlog.

## Decisions

- Treat P0/P1/P2 as locally implemented and move to the next concrete implementation risk:
  Boss Practice coverage and ranked/server hardening.
- Keep remote Supabase apply/deploy and public leaderboard launch as carryover,
  because those require release/backend action beyond local code.
- Keep ad revive policy unimplemented for now; next pass should make it an
  adapter-gated disabled contract before any reward UI is shown.

## Files Changed

- `src/render/AppShell.ts`
  - Home still exposes 6 mode cards.
  - Free Defense Boss Practice can select any release boss.
  - Ranked detail exposes Rookie/Defender/Elite/Master difficulty tabs.
  - Bottom skill HUD naming stayed aligned to `skillSlotLayout`.
- `src/game/ModeConfig.ts`
  - Added `practiceBossId` launch/config option.
  - Boss Practice pins `bossPolicy.bossEnemyType` and single-boss sequence.
- `src/game/AppState.ts`
  - Carries `practiceBossId` into start/retry config.
- `src/game/GameApp.ts`
  - Added DEV `qaBoss` URL handling for selected Free Defense boss practice.
- `src/game/GameScene.ts`
  - Ranked results now return to mode selection for a fresh token instead of same-run retry.
- `src/game/RankedReplayValidator.ts`
  - Rejects boss shard replay spawn events whose parent timing/type is invalid.
- `src/platform/BackendAdapter.ts`
  - Added KST Monday 06:00 weekly ranked seed helper.
- `supabase/functions/orbitslash-ranked-run/index.ts`
  - Edge draft uses the same weekly seed policy and rejects invalid boss-shard replay events.
- `src/i18n/ko.json`, `src/i18n/en.json`
  - Added Boss Practice selection copy.
- `ai/plans/design-plan.md`, `ai/plans/design-system.md`, `ai/plans/implementation-plan.md`, `ai/plans/product-plan.md`
  - Synced Earth size, 5-skill scope, and Eclipse/Black Core boss identity docs.
- `ai/plans/master-roadmap.md`, `ai/reviews/review.md`
  - Updated completed checklist items and latest readiness state.

## Tests / Verification

- RED checks were observed before implementation for:
  - document SSOT stale values,
  - Free Defense selected practice boss,
  - ranked difficulty tabs,
  - boss-shard replay type/time rejection,
  - ranked weekly seed helper,
  - ranked fresh-token retry policy,
  - DEV `qaBoss` mapping.
- `npm test -- --run`: 66 files / 393 tests passed.
- `npm run build`: passed; Vite still warns that `index-*.js` is slightly over 500 kB.
- `npm run preflight:release-boundary`: passed.
- `git diff --check`: passed.
- Edge bundle check passed:
  `npx esbuild supabase/functions/orbitslash-ranked-run/index.ts --bundle --platform=browser --format=esm --external:https://esm.sh/@supabase/supabase-js@2 --outfile=/tmp/orbitslash-edge-check.js`

## Remaining Risks

- `deno check` still not run because Deno CLI is not installed in current PATH.
- Supabase migration and Edge Function are still local drafts, not remotely applied/deployed.
- Public leaderboard UI should stay blocked until identity-bound accepted ranked runs exist.
- Free Defense ad revive policy remains unimplemented and must stay disabled until rewarded-ad telemetry/platform adapter work exists.
- Real-device QA remains queued for boss readability, HUD safe area, skill gestures, and touch feel.

## Next Steps

1. Implement Free Defense ad-revive policy as disabled/adapter-gated contract.
2. Add public leaderboard boundary UI that shows verified-only/locked state without claiming live ranking.
3. If approved, apply/deploy Supabase ranked migration/Edge Function and then run live backend smoke.
4. Keep mode matrix QA recorded but do not block local implementation on human QA.

## Knowledge Promotion

- Project-local log only for now. Cross-project promotion not needed; this is Orbit Slash-specific gameplay/backend implementation detail.
