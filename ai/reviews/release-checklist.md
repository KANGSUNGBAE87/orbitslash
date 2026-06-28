---
version: 0.1
status: draft
updated: 2026-06-28
canonical: true
---

# Orbit Slash — Platform Release Checklist

## Change Log

- 2026-06-28 (codex): Added draft release readiness checklist for Apps in Toss and Google Play paths.
- 2026-06-28 (codex): Updated after hybrid ranking decision, remote dormant Supabase schema provisioning, asset sprite pass, QA presets, and release hardening.

## Release Target Status

- Current implementation target: local web playable build.
- Public ranking: not ready.
- Store release: not ready.
- GitHub deployment for latest local changes: pending final commit/push.
- DEV-only QA presets: `?qaPreset=directional`, `?qaPreset=lastSave`, `?qaPreset=dense`.
- Release-boundary preflight: local script added and passed on 2026-06-28.

## Apps in Toss Checklist

- [ ] Re-check official Apps in Toss release, game checklist, UI/UX, sandbox, and Toss app testing docs.
- [ ] Confirm game/service policy fit.
- [ ] Verify Safe Area and Toss navigation behavior on a real Toss test surface.
- [ ] Keep Toss login, ads, IAP, haptics behind adapters.
- [ ] Do not expose `APPS_IN_TOSS_CONSOLE_API_KEY` in repo, app bundle, logs, screenshots, or public env.
- [ ] Confirm no raw Toss userKey storage.
- [ ] Confirm ad/IAP are stub-only until officially implemented.

## Google Play Checklist

- [ ] Confirm final release order with Owner; current implementation keeps Google Play-first readiness and Apps in Toss compatibility.
- [ ] Prepare content rating/data safety only after feature scope is frozen.
- [ ] Keep Google login, Play Billing, AdMob, haptics behind adapters.
- [ ] Do not imply online/global ranking before verified backend ranking exists.
- [ ] Store listing should describe implemented local/same-seed gameplay only until public ranking is live.

## Backend/Ranking Checklist

- [x] Ranking strategy selected: hybrid with Supabase verified ranking primary and Apps in Toss leaderboard bridge-ready.
- [x] Apply dormant Supabase schema with RLS on and no public-open policies.
- [ ] Implement server/Edge `beginRankedRun`.
- [ ] Implement server/Edge `submitRankedRun` with deterministic validation.
- [x] Verify RLS and anon/service role separation for current dormant tables.
- [ ] Keep service-role operations server-only.

## QA Carryover

See canonical QA backlog:

- `ai/reviews/review.md`

Latest local verification:

- `npm test`: 28 files / 154 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run preflight:release-boundary`: passed.
- Production bundle string check: no `qaPreset` / `qaGauge` strings found in `dist`.
- Local Chrome mobile smoke: canvas rendered, all five enemy SVG assets returned 200, no console/page errors.
