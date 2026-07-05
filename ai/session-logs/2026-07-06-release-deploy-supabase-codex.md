---
date: 2026-07-06
actor: codex
topic: release-deploy-supabase
---

# Orbit Slash Release Deploy + Supabase Remote Apply

## User Request

- Implement through item 4 with subagents:
  1. commit cleanup
  2. GitHub deploy
  3. real-device/WebView QA prep/smoke
  4. Supabase migration/function remote apply/deploy

## Subagents

- `release-state-auditor`: confirmed GitHub Pages workflow deploy path and warned about large dirty worktree before cleanup.
- `live-qa-runner`: ran local production/dev mobile smoke, confirmed visible canvas, no failed requests, and only one non-blocking Pixi adapter warning.
- `toss-compliance-auditor`: flagged shared Supabase migration-history mismatch and reminded that real Toss WebView/Safe Area QA remains human-device work.

## Decisions

- Committed the large local release-candidate batch as one scoped gameplay/backend/docs commit after local tests/build/preflight passed.
- Used GitHub Actions Pages workflow by pushing `main`; no separate `gh-pages` branch or `docs/` deploy path.
- Did not enable public leaderboard flags. Remote backend is deployed and smoke-ready, but public ranking remains gated until identity-bound ranked submit is verified.
- Did not use `supabase db push` because the shared Supabase project contains cross-app migration history that is not present in this repo. Applied Orbit Slash SQL through targeted `supabase db query` statements instead.
- Added a new service-role grants migration because Edge Functions were deployed correctly but PostgREST writes failed until `service_role` had table/sequence grants.

## Files Changed

- `supabase/migrations/20260706_orbitslash_service_role_grants.sql`
- `ai/reviews/release-checklist.md`
- `ai/reviews/review.md`
- `ai/session-logs/2026-07-06-release-deploy-supabase-codex.md`

## Commands / Verification

- `npm test -- --run`: 78 files / 494 tests passed before the initial release commit.
- `npm run build`: passed before the initial release commit.
- `npm run preflight:release`: passed before the initial release commit; `deno check` skipped because Deno is not installed in PATH.
- `git diff --check`: passed before the initial release commit.
- `git commit -m "Build Orbit Slash release candidate core"` -> `8821df6`.
- `git push origin main`: pushed `8821df6`.
- GitHub Actions run `28746871714`: build/test/upload succeeded; first Pages deploy attempt hit transient `Deployment failed, try again later`, failed job rerun succeeded.
- Live Pages HTTP smoke: `https://kangsungbae87.github.io/orbitslash/` returned `HTTP 200`, last-modified `Sun, 05 Jul 2026 16:17:32 GMT`.
- Supabase SQL apply: applied Orbit Slash migrations through statement-by-statement `supabase db query`.
- Supabase Edge deploy: deployed `orbitslash-ranked-run`, `orbitslash-rewarded-ad-telemetry`, and `orbitslash-gameplay-telemetry`.
- Supabase remote verification:
  - five Orbit Slash tables present.
  - RLS enabled on all five Orbit Slash tables.
  - Edge Functions `ACTIVE`, `verify_jwt=true`.
  - `orbitslash-ranked-run` leaderboard returned expected disabled `403`.
  - anonymous ranked begin returned `200` with `rankingEligible=false`.
  - rewarded telemetry write returned `200`.
  - gameplay telemetry write returned `200`.

## Remaining Risks

- Real Toss app/WebView QA is still not complete: Safe Area, back/navigation, runtime_channel, and mobile WebView performance need device evidence.
- Public leaderboard remains intentionally disabled.
- Identity-bound ranked submit is not verified yet because a real internal `core_user_id` auth mapping flow is required.
- Latest local QA smoke still reports a non-blocking console warning: `No available adapters.`
- Deno is not installed, so Edge Functions were checked through esbuild/preflight and remote HTTP smoke, not `deno check`.

## Next Steps

- Do real Toss WebView QA and record screenshots/results.
- Verify identity-bound ranked begin/submit using a real mapped user.
- Only after identity-bound score write passes, enable public leaderboard flags and run live leaderboard smoke.
- Decide whether to clean the Pixi `No available adapters.` warning before store-facing QA.
- Prepare Google Play content rating/data safety final answers after feature freeze.

## Knowledge Store Promotion

- No cross-project knowledge promotion required. The shared migration-history issue is already covered by this project log and release checklist.
