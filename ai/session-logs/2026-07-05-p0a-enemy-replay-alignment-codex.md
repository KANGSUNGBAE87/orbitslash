---
date: 2026-07-05
actor: codex
topic: p0a-enemy-replay-alignment
---

# Session Log — P0-A Enemy Pool And Replay Alignment

## User Request

- Use subagents including Claude to analyze whether current gameplay matches the product/design plan.
- Synthesize the next implementation plan.
- Continue implementation until the P0/P1/P2 checklist work is closed enough to move forward.

## Subagent / External Review

- Native reviewer subagent flagged P0-A as blocked until split spawns, shield/armor absorbed hits, and graviton pull are reconciled with ranked replay.
- Claude CLI auth was logged in earlier, but prompt execution was unavailable due Claude session limit / 429, so Claude participation was degraded for this batch.

## Decisions

- Treat P0-A enemy expansion as data + runtime + replay contract work, not only visuals.
- Add eight advanced enemy variants and mode-specific wave overlays.
- Keep split spawning immediate at parent kill time for now because `OrbitSpawner` has no delayed spawn queue yet.
- Record ranked runtime `spawnEvents` so dynamic split/boss-shard spawns and shifted runtime ordinals can be validated.
- Record shield/armor absorbed hits as `damage: 0` with `absorbed: "shield" | "armor"`.
- Gate graviton pull off in ranked mode until the server replay model can reproduce interactive pull geometry.

## Files Changed

- `src/data/enemies.json`
- `src/data/waves.json`
- `src/game/types.ts`
- `src/game/Enemy.ts`
- `src/game/ObjectManager.ts`
- `src/game/GameScene.ts`
- `src/game/RankedReplayTrace.ts`
- `src/game/RankedReplayValidator.ts`
- `src/game/RunSession.ts`
- `src/render/EnemyVisual.ts`
- `public/assets/enemies/*.svg` advanced/boss assets
- `supabase/functions/orbitslash-ranked-run/index.ts`
- Related focused tests under `src/game/*` and `src/render/*`
- `ai/plans/master-roadmap.md`
- `ai/reviews/review.md`

## Verification

- `npm test -- src/game/RunSession.test.ts src/game/RankedReplayValidator.test.ts src/game/Enemy.test.ts src/game/ObjectManager.test.ts --run` passed.
- Focused P0-A regression passed: 10 files / 74 tests.
- `npm test -- --run` passed: 65 files / 377 tests.
- `npm run build` passed. Vite still reports one chunk-size warning over 500 kB.
- `npm run preflight:release-boundary` passed.
- `git diff --check` passed.
- `deno check supabase/functions/orbitslash-ranked-run/index.ts` was not run because Deno CLI is not installed in current PATH.
- Graphify refreshed with `graphify update . --no-cluster`: 2804 nodes / 182950 edges.
- cmm refreshed by CLI with project-local HOME: 2808 nodes / 5922 edges.

## Remaining Risks

- Edge Function draft was patched for the new trace shape, but Deno typecheck was not available locally.
- Edge wave table is still less strict than local validator when `spawnEvents` is present; remote deployment/review should revisit strict server-side wave parity before public ranking.
- Graviton pull is intentionally disabled in ranked and must be modeled in replay before enabling ranked pull behavior.
- Delayed split spawn queue is not implemented; split children spawn immediately at parent kill time.
- Real-device QA remains for advanced enemy readability, split feel, shield/armor feedback, graviton pull feel, and dense-wave difficulty.

## Next Steps

1. Boss Pattern Batch B: author true attack/VFX behavior for the five bosses beyond Ringed Destroyer shard telegraph.
2. Ranked backend hardening: Deno check, strict Edge wave parity, remote Edge deployment, leaderboard policy decision.
3. Real-device gameplay QA: advanced enemy readability, shield/armor absorbed feedback, split fragments, 7-second wave spikes.
4. Balance pass: tune rookie/defender early advanced variant density after phone QA.
5. Release cleanup: split first commit/staging carefully because the repo/worktree is still large and pre-initial-commit sensitive.
