---
date: 2026-07-05
actor: codex
topic: p0-p2-closure
---

# P0/P1/P2 Closure Pass

## User Request

- Make P0/P1/P2 checklists.
- Use subagents with Claude as lead where possible.
- Implement until the checklist is complete.

## Routing

- Claude CLI auth status was active, but `claude -p` runtime returned session limit reset at 4am Asia/Seoul.
- Degraded routing used Codex planner/reviewer subagents plus Antigravity auth-checked secondary review.
- Reviewer subagent found ranked replay gaps: server draft was too weak, boss replay schedule differed from runtime, combo/skill trace validation was loose, and submit failure handling lacked catch coverage.
- Planner subagent found stale SSOT docs: Nova Pulse already canonical but `reserve_slot` wording remained; DEV preset docs missed boss/special; deployment wording overstated current dirty-worktree deploy state.

## Decisions

- Keep P0/P1/P2 local implementation complete, but keep external release carryover separate:
  - remote Supabase migration apply
  - Edge Function deploy
  - full input/geometry validation for directional and boss-weak hit claims
  - real-device and platform release gates
- Superseded in the continuation below: ranked semantic replay, source/segment geometry replay, and HP progression replay are implemented locally and in the Edge draft. Remote deploy and identity binding remain pending before public ranking claims.
- Nova Pulse is the canonical fifth release skill.

## Files Changed

- `src/game/RankedReplayValidator.ts`
  - Strict trace array validation.
  - Combo-break and skill event timing validation.
  - Valid distance band, accuracy, combo-break reason, and skill id checks.
  - Boss-delayed replay spawn ordinals: a later periodic boss only exists after the prior boss is defeated.
- `src/game/RankedReplayValidator.test.ts`
  - Added invalid combo-break timing test.
  - Added unknown skill id test.
  - Added later-boss-before-prior-defeat rejection test.
- `src/platform/SupabaseEdgeBackendAdapter.ts`
  - Converts ranked submit network failures into rejected submit results.
- `src/platform/SupabaseEdgeBackendAdapter.test.ts`
  - Added network failure test.
- `src/game/GameScene.ts`
  - Catches ranked submit promise failures and records telemetry instead of leaking unhandled rejections.
- `supabase/functions/orbitslash-ranked-run/index.ts`
  - Added Edge-side semantic replay: deterministic ranked normal spawns, boss-delayed spawn ordinals, trace shape/time/id checks, replayed score/kills/maxCombo/Last Save consistency.
- `supabase/functions/orbitslash-ranked-run/README.md`
  - Updated Edge contract and pending input/geometry validation note.
- `ai/plans/p0-p2-implementation-checklist.md`
- `ai/reviews/release-checklist.md`
- `ai/reviews/review.md`
- `ai/plans/backend-contract.md`
- `ai/plans/master-roadmap.md`
  - Synced Nova Pulse, DEV presets, deploy-state wording, semantic replay status, and latest verification numbers.

## Verification

- `npm test`: 58 files / 291 tests passed.
- `npm run build`: passed.
- `npm run preflight:release-boundary`: passed.
- `git diff --check`: passed.
- Edge Function draft syntax/bundle check passed:
  - `npx esbuild supabase/functions/orbitslash-ranked-run/index.ts --bundle --platform=browser --format=esm --external:https://esm.sh/@supabase/supabase-js@2 --outfile=/tmp/orbitslash-edge-check.js`
- `deno check`: not run; Deno CLI is not installed in current PATH.
- Graphify refreshed: 2149 nodes / 134256 edges.
- cmm refreshed: 2179 nodes / 4722 edges.

## Remaining Risks

- Edge draft duplicates some ranked replay constants from app data. Before production deploy, either keep this mirror in lockstep or move replay validation into a shared deploy-safe module.
- Superseded in the continuation below: source/segment geometry validation and HP progression replay are now implemented locally and in the Edge draft.
- Remote Supabase apply/deploy not done in this pass.
- Current dirty worktree has not been committed or redeployed.
- Real-device QA remains external/human carryover.

## Knowledge Store Promotion

- No cross-project reusable knowledge promoted.
- Project-local docs and graphs were updated.

---

# Ranked Source/Segment Geometry Continuation

## User Request

- Continue P0/P1/P2 implementation until complete.
- Use subagents with Claude lead where possible.

## Routing

- Claude CLI auth status was active.
- Claude review attempt failed at runtime with `session limit · resets 4am (Asia/Seoul)`.
- A native reviewer subagent was spawned for the same geometry-review focus but also hit account usage limit.
- Main Codex completed the implementation and verification directly. Degraded route was recorded instead of silently claiming Claude review.

## Decisions

- Mark source/segment geometry replay validation complete locally and in the Edge draft.
- Keep public anti-cheat/global ranking copy blocked until the remaining external/backend items are done:
  - remote apply of `supabase/migrations/20260705_orbitslash_ranked_validation.sql`
  - remote deploy of `supabase/functions/orbitslash-ranked-run`
  - user/account identity binding through internal `core_user_id`
- Treat current Edge geometry constants as a mirrored draft; a shared validation module is still preferable before production hardening.

## Files Changed

- `src/game/RankedReplayTrace.ts`
  - Hit events now carry source, skill id, damage, and replay segment.
  - Kill events can carry hit `source`, damage, skill id, and replay `segment`.
- `src/game/GameScene.ts`
  - Kill commits record hit source and cloned hit segment for slash, Solar Lance, and skill kills.
- `src/game/RunSession.ts`
  - Records every ranked hit event, not only kills.
  - Replay trace snapshots deep-copy nested hit/kill segments.
- `src/game/RankedReplayValidator.ts`
  - Replays hitEvents through enemy HP and requires killEvents to match the HP-derived kill sequence.
  - Validates expected damage by source/skill id.
  - Validates replay source values.
  - Requires slash/Solar Lance sourced kills to include a segment.
  - Rejects slash segments shorter than the live hit minimum.
  - Requires Solar Lance source to match a nearby Solar Lance skill event.
  - Replays enemy position/radius and checks segment-circle intersection.
  - Rechecks distance band, directional angle accuracy, and boss weak-point geometry.
- `supabase/functions/orbitslash-ranked-run/index.ts`
  - Mirrors ranked geometry validation for the Edge draft.
  - Mirrors ranked HP progression validation for the Edge draft.
  - Adds boss weak-point data, replay visual scale, segment-circle intersection, directional-angle check, and source-specific hit radius inflation.
- `src/game/RankedReplayValidator.test.ts`
  - Added geometry rejection coverage for missed directional claims, missing boss weak segment, Solar Lance without skill event, slash without segment, and too-short slash segment.
- `src/game/RunSession.test.ts`
  - Added deep-copy test for replay kill segments.
- `src/platform/BackendAdapter.ts`
  - Added `replay_trace_invalid_geometry` to public ranked submission validation reasons.
- `ai/plans/p0-p2-implementation-checklist.md`
- `ai/plans/backend-contract.md`
- `ai/reviews/release-checklist.md`
- `ai/reviews/review.md`
  - Updated status, verification, and remaining carryover.

## Verification

- Focused ranked checks: 4 files / 27 tests passed.
- `npm test`: 58 files / 297 tests passed.
- `npm run build`: passed.
- Edge Function draft bundle check passed:
  - `npx esbuild supabase/functions/orbitslash-ranked-run/index.ts --bundle --platform=browser --format=esm --external:https://esm.sh/@supabase/supabase-js@2 --outfile=/tmp/orbitslash-edge-check.js`
- `npm run preflight:release-boundary`: passed.
- `git diff --check`: passed.
- `deno check`: not run; Deno CLI is not installed in current PATH.

## Remaining Risks

- Edge draft duplicates app constants and boss weak-point data; drift must be controlled before production deploy.
- Remote Supabase migration apply and Edge deploy are not done.
- Current dirty worktree has not been committed or redeployed.
- Real-device QA remains external/human carryover.

## Knowledge Store Promotion

- No cross-project reusable knowledge promoted.
- Project-local docs are updated; Graphify/cmm refresh follows this log.
