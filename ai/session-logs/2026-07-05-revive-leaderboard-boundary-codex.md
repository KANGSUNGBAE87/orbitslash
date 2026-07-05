---
date: 2026-07-05
actor: codex
topic: revive-leaderboard-boundary
---

# Revive / Leaderboard Boundary Pass

## User Request

- Continue implementation at high speed using subagents.
- Keep moving through the remaining checklist rather than doing more manual QA.

## Subagent Input

- Dalton/planner: recommended Free Defense ad revive as a disabled/adapter-gated contract, no reward CTA, and public leaderboard as locked boundary until identity-bound accepted runs exist.
- Einstein/reviewer: found i18n parity gap, public leaderboard server boundary risk, ranked outcome-state risk, Free Defense revive contract ambiguity, and Free Defense daily-limit UX risk.

## Decisions

- Do not enable actual rewarded revive yet.
- Do not show public leaderboard rows by default; rows require explicit public flags and identity-bound verified remote data.
- Show Free Defense ad revive only as `locked / 준비 중`.
- Route leaderboard availability through backend adapter status, while defaulting to locked.
- Reject ranked score inserts in the local Edge draft when `core_user_id` is missing.
- Draft rewarded-ad telemetry as a separate table/function from ranked validation.
- Keep revive CTA disabled even though the telemetry draft now exists.
- Treat ad telemetry endpoint URL as local draft only unless remote deployment is explicitly enabled.
- Pass Free Defense revive readiness from `GameApp` into `AppShell` instead of letting UI infer readiness from env alone.
- Add a local/Edge public leaderboard rows contract, but keep it gated off by default.
- Add a combined local release preflight script for release-boundary and Edge bundle checks.

## Files Changed

- `src/game/RevivePolicy.ts`
- `src/game/RevivePolicy.test.ts`
- `src/platform/LeaderboardBoundary.ts`
- `src/platform/LeaderboardBoundary.test.ts`
- `src/platform/RankedEdgeBoundary.test.ts`
- `src/platform/BackendAdapter.ts`
- `src/platform/BackendAdapter.test.ts`
- `src/platform/SupabaseEdgeBackendAdapter.ts`
- `src/platform/SupabaseEdgeBackendAdapter.test.ts`
- `src/platform/BackendAdapterFactory.ts`
- `src/platform/BackendAdapterFactory.test.ts`
- `src/platform/AdTelemetryBoundary.test.ts`
- `src/platform/RankedEdgeBoundary.test.ts`
- `src/platform/ReleasePrepScript.test.ts`
- `src/render/AppShell.ts`
- `src/render/AppShell.test.ts`
- `src/game/GameApp.test.ts`
- `src/i18n/ko.json`
- `src/i18n/en.json`
- `src/i18n/i18nParity.test.ts`
- `src/game/GameApp.ts`
- `package.json`
- `scripts/check-release-prep.mjs`
- `supabase/functions/orbitslash-ranked-run/index.ts`
- `supabase/functions/orbitslash-rewarded-ad-telemetry/index.ts`
- `supabase/functions/orbitslash-rewarded-ad-telemetry/README.md`
- `supabase/migrations/20260705_orbitslash_rewarded_ad_telemetry.sql`
- `ai/plans/master-roadmap.md`
- `ai/plans/product-plan.md`
- `ai/reviews/review.md`
- `ai/reviews/release-checklist.md`

## Verification

- RED confirmed:
  - Missing `RevivePolicy` / `LeaderboardBoundary` modules.
  - Missing i18n keys.
  - Edge source had no `identity_not_bound` guard before score insert.
  - Backend adapters had no `leaderboardStatus()`.
- GREEN passed:
  - `npm test -- --run src/game/RevivePolicy.test.ts src/platform/LeaderboardBoundary.test.ts src/render/AppShell.test.ts src/i18n/i18nParity.test.ts`
  - `npm test -- --run src/platform/RankedEdgeBoundary.test.ts src/game/RevivePolicy.test.ts src/platform/LeaderboardBoundary.test.ts src/render/AppShell.test.ts src/i18n/i18nParity.test.ts`
  - `npm test -- --run src/platform/BackendAdapter.test.ts src/platform/SupabaseEdgeBackendAdapter.test.ts`
  - `npm test -- --run src/platform/AdTelemetryBoundary.test.ts src/platform/SupabaseEdgeBackendAdapter.test.ts src/platform/BackendAdapterFactory.test.ts src/platform/BackendAdapter.test.ts src/platform/PlatformAdapter.test.ts`
  - `npm test -- --run src/platform/BackendAdapter.test.ts src/platform/SupabaseEdgeBackendAdapter.test.ts src/platform/BackendAdapterFactory.test.ts src/game/GameApp.test.ts src/render/AppShell.test.ts`
  - `npm test -- --run src/platform/BackendAdapter.test.ts src/platform/SupabaseEdgeBackendAdapter.test.ts src/platform/BackendAdapterFactory.test.ts src/render/AppShell.test.ts src/platform/RankedEdgeBoundary.test.ts src/game/GameApp.test.ts`
  - `npm test -- --run src/platform/ReleasePrepScript.test.ts`
  - `npm test -- --run src/render/AppShell.test.ts src/game/GameApp.test.ts src/platform/BackendAdapter.test.ts src/platform/SupabaseEdgeBackendAdapter.test.ts src/platform/LeaderboardBoundary.test.ts src/platform/RankedEdgeBoundary.test.ts`
  - `npm test -- --run`: 72 files / 420 tests passed.
  - `npm run build`: passed; Vite still warns that one generated chunk is over 500 kB.
  - `npm run preflight:release`: passed; Deno check skipped because Deno is not installed in PATH.
  - `git diff --check`: passed.
  - `npx esbuild supabase/functions/orbitslash-ranked-run/index.ts --bundle --platform=browser --format=esm --external:https://esm.sh/@supabase/supabase-js@2 --outfile=/tmp/orbitslash-edge-check.js`: passed.
  - `npx esbuild supabase/functions/orbitslash-rewarded-ad-telemetry/index.ts --bundle --platform=browser --format=esm --external:https://esm.sh/@supabase/supabase-js@2 --outfile=/tmp/orbitslash-ad-edge-check.js`: passed.
  - `deno check`: not run because Deno CLI is not installed in PATH.
  - `graphify update . --no-cluster`: refreshed to 2944 nodes / 225112 edges.
  - cmm CLI `index_repository(mode=fast)`: refreshed project `Users-kangsungbae-Documents-orbitslash` to 2931 nodes / 6055 edges.

## Remaining Risks

- Actual rewarded-ad revive is still not implemented; the local telemetry endpoint/table draft exists, but a real platform adapter plus remote apply/deploy and explicit remote-enable flag are required before enabling the CTA.
- Public leaderboard rows are implemented but still hidden by default; remote Edge deploy/apply, identity-bound accepted runs, and explicit public flags are required first.
- Ranked result outcome state now updates to `submitted`/`failed`, but live remote submit still needs remote deployment.
- Free Defense 5/5 standard limit now shows explicit locked UX while practice remains available.
- Deno CLI check still depends on Deno being installed.

## Next Steps

1. Prepare remote ranked Edge deploy/apply only when explicitly requested.
2. Prepare remote rewarded-ad telemetry migration/function deploy only when explicitly requested.
3. Enable public leaderboard rows only after identity-bound accepted remote runs exist and public flags are intentionally set.
4. Continue final boss pattern art and real-device mode QA.

## Knowledge Promotion

- No cross-project knowledge promotion needed. This is project-specific readiness state.
