---
date: 2026-07-05
actor: codex
topic: ranked-server-boundary
---

# Ranked Server Boundary Session

## User Request

- Complete P0/P1/P2 checklist using subagents, Claude-led if possible.
- Continue implementation until checklist items are complete.

## Subagent / Claude Notes

- Claude CLI auth check passed earlier in the turn, but `claude -p` consult failed because the Claude session limit was reached until 04:00 Asia/Seoul.
- Native read-only reviewer subagent audited P0/P1/P2 and identified the ranked server boundary as the remaining machine-implementable blocker.
- Reviewer confirmed human-only QA remains: `Touch/HUD`, `Boss Weak`, `Special`, `Blitz` on real device.

## Decisions

- Do not remotely apply Supabase migrations or deploy Edge Functions without an explicit Owner deploy/apply request.
- Keep local/stub ranked playable but never public-ranked eligible.
- Only `server_verified` starts with `server-ranked-*` token, `server-ranked-*` config, expiry, and sane seed can become ranked eligible.
- Ranked retry must drop stale server config and fetch a fresh run start through `BackendAdapter`.
- Client uses Edge adapter only with public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; service-role work stays in Supabase Edge Function draft.

## Files Changed

- `src/game/RankingSystem.ts`
- `src/game/RunSession.ts`
- `src/game/GameScene.ts`
- `src/game/GameApp.ts`
- `src/game/AppState.ts`
- `src/platform/BackendAdapter.ts`
- `src/platform/BackendAdapterFactory.ts`
- `src/platform/SupabaseEdgeBackendAdapter.ts`
- `src/i18n/ko.json`
- `src/i18n/en.json`
- `supabase/migrations/20260705_orbitslash_ranked_validation.sql`
- `supabase/functions/orbitslash-ranked-run/index.ts`
- `supabase/functions/orbitslash-ranked-run/README.md`
- Focused tests for ranking/backend/run config/app state/Edge adapter.
- Updated `ai/plans/p0-p2-implementation-checklist.md`, `ai/reviews/review.md`, `ai/reviews/release-checklist.md`, `ai/plans/backend-contract.md`.

## Verification

- Focused tests passed:
  - `npm test -- --run src/platform/BackendAdapterFactory.test.ts src/platform/SupabaseEdgeBackendAdapter.test.ts src/platform/BackendAdapter.test.ts src/game/GameSceneRunConfig.test.ts src/game/AppState.test.ts src/game/RunSession.test.ts src/game/RankingSystem.test.ts src/game/ModeConfig.test.ts src/game/GameApp.test.ts`
  - 9 files / 37 tests passed.
- Full verification passed after fixes:
  - `npm test`: 57 files / 281 tests passed.
  - `npm run build`: passed.
  - `npm run preflight:release-boundary`: passed.
  - `git diff --check`: passed.
  - `graphify update . --no-cluster`: refreshed 2005 nodes / 110460 edges.
  - cmm `index_repository`: refreshed 2018 nodes / 4124 edges.

## Remaining Risks

- Full deterministic gameplay replay validation is not implemented yet.
- Remote apply/deploy pending:
  - `supabase/migrations/20260705_orbitslash_ranked_validation.sql`
  - `supabase/functions/orbitslash-ranked-run`
- Real-device QA remains human-only:
  - Touch/HUD
  - Boss Weak
  - Special
  - Blitz

## Knowledge Promotion

- No cross-project durable rule promoted. Project-local backend/ranked contract updated.
