---
version: 0.6
status: active
updated: 2026-07-05
canonical: false
---

# Orbit Slash — P0/P1/P2 Implementation Checklist

## P0

- [x] Sync SSOT docs to 2026-07-04 implementation state.
- [x] Promote Nova Pulse as the fifth release skill.
- [x] Record current gameplay Earth size as the active gameplay SSOT.
- [x] Rebalance special objects so cutting protected objects is not always beneficial.
- [x] Add protected-object expiration rewards.
- [x] Add Delta Shield persistent HUD state.
- [x] Keep public ranking claims blocked until server validation exists.
- [x] Add DEV-only QA launcher/result recorder for all remaining human carryover scenarios.
- [x] Prevent DEV QA runs from writing local progression/unlocks/collection.
- [x] Convert periodic boss threat from pure timer to skill-responsive pressure from kills, combo, Last Save, and boss weak hits.
- [x] Keep Delta Shield from instantly defeating bosses; bosses are shield-knocked back and must still be beaten through HP/weak-point play.

## P1

- [x] Add first-boss weak-point positional resolver.
- [x] Add first-boss phase pattern metadata.
- [x] Add distinct phase/objective/weak-point contracts for Lava Titan, Ice Colossus, and Dark Planet.
- [x] Wire boss hits so only weak-point hits get bossWeak accuracy.
- [x] Add a visible weak-point overlay for bosses.
- [x] Complete Boss Rush as a sequence mode contract.
- [x] Complete 60s Blitz as six 10-second runtime bands.

## P2

- [x] Add Story Stage 1-5 release-slice contracts.
- [x] Add Story objective runtime evaluation for basic slash, Last Save, protect-object, combo mastery, and boss-threat stages.
- [x] Add Daily modifier preset registry including no-skill, rescue, Last Save, Boss Alert, and Master Trial variants.
- [x] Add Daily modifier pass/fail evaluation and `daily_challenge_failed` failure path.
- [x] Fill `ModeResult` mode-specific metadata for Story, Daily, ranked submission state, protection counters, and objective outcome.
- [x] Persist Story clear markers, Daily completion markers, and Boss Rush best boss-count progress.
- [x] Show Story/Daily progression details in local records.
- [x] Add ranked server-stub contract that cannot be mistaken for public ranking.
- [x] Add public ranked start/submission validation contract with `server-ranked-*` token, expiry, seed/config/difficulty matching, and score/count sanity checks.
- [x] Add Supabase Edge Function draft and client Edge adapter path for `beginRankedRun` / `submitRankedRun`.
- [x] Add ranked semantic replay trace validation: stable `spawnOrdinal`, boss-delayed spawn ordinals, kill events, combo-break events, skill events, replayed scoring summary match, and replay-bound sanity checks.
- [x] Add ranked source/segment geometry replay validation for slash, Solar Lance, directional cuts, and boss weak-point hit claims in both local validator and Edge draft.
- [x] Add ranked damage/HP progression replay for non-lethal hit history in both local validator and Edge draft.
- [x] Add release/platform gate notes and boundary checks.
- [x] Record QA still requiring human device checks.

## Verification

- [x] `npm test`: 59 files / 340 tests passed on 2026-07-05 after Story full-plan pass.
- [x] `npm run build`: passed on 2026-07-05 after Story full-plan pass.
- [x] `npm run preflight:release-boundary`: passed on 2026-07-05 after Story full-plan pass.
- [x] `git diff --check`: passed on 2026-07-05 after Story full-plan pass.
- [x] Edge Function draft syntax/bundle check: `npx esbuild supabase/functions/orbitslash-ranked-run/index.ts --bundle --platform=browser --format=esm --external:https://esm.sh/@supabase/supabase-js@2 --outfile=/tmp/orbitslash-edge-check.js` passed on 2026-07-05.
- [x] Focused ranked geometry/HP tests: 4 files / 27 tests passed for ranked replay validator, run-session trace copying, backend validation, and Edge adapter boundaries.
- [x] Mobile browser visual smoke at `http://127.0.0.1:5187/`: DEV QA launcher, Blitz, Boss Weak, and Special buttons launch the matching QA mode/preset and render with no console warnings/errors.
- [x] Mobile browser visual smoke at `http://127.0.0.1:5188/`: DEV QA recorder stores Boss Weak PASS state, launches `?qaMode=bossRush&qaPreset=boss&qaGauge=100&seed=1234`, and reports no console/page errors.
- [x] Production bundle check: no `qaMode`, `qaPreset`, or `qaGauge` strings in `dist`.
- [x] Focused ranked boundary tests: local/stub ranked stays unranked, `server_verified` ranked start is eligible, expired/mismatched ranked submissions reject, and ranked retry drops stale server config.
- [x] Focused replay tests: missing trace rejects, valid semantic trace accepts, duplicate kill rejects, kill-before-spawn rejects, trace-derived summary mismatch rejects.
- [x] Graphify refreshed: 2627 nodes / 169771 edges after P0 AppShell contract cleanup.
- [x] cmm refreshed via CLI after MCP transport failure: `Users-kangsungbae-Documents-orbitslash` ready with 2690 nodes / 5617 edges.

## External Release Carryover

- [ ] Remote apply `supabase/migrations/20260705_orbitslash_ranked_validation.sql`.
- [ ] Deploy `supabase/functions/orbitslash-ranked-run`.
- [ ] Bind ranked runs to user/account identity through internal `core_user_id` before public leaderboard launch.

## Human QA Carryover

- [ ] Real-device touch feel and HUD safe-area QA after the 2026-07-05 QA recorder update. DEV QA screen item: `Touch/HUD`.
- [ ] Boss weak-point readability on real phone. DEV QA screen item: `Boss Weak`.
- [ ] Special object avoid/protect readability on real phone. DEV QA screen item: `Special`.
- [ ] 60s Blitz pacing feel on real phone. DEV QA screen item: `Blitz`.
