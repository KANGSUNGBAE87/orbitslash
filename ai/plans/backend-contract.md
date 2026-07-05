---
version: 0.5
status: draft
updated: 2026-07-05
canonical: true
---

# Orbit Slash — Backend and Ranking Contract

## Change Log

- 2026-06-28 (codex): Added local contract draft for ranked run seed/token boundary, Supabase table draft, and release safety constraints.
- 2026-06-28 (codex): Fixed ranking strategy as hybrid, recorded dormant Supabase schema provisioning work, and added hardening migration. Current remote state must be reverified before release evidence use.
- 2026-07-05 (codex): Added local ranked Edge Function draft, client Edge adapter path, server-verified start validation, expiry/one-use submission checks, and ranked retry stale-token protection.
- 2026-07-05 (codex): Added ranked semantic replay trace contract: run-local spawn ordinals, boss-delayed spawn ordinals, kill/combo-break/skill events, local replayed scoring match, and stricter Edge semantic score replay checks.
- 2026-07-05 (codex): Added source/segment geometry replay validation in local and Edge validators for slash, Solar Lance, directional cut claims, and boss weak-point claims.
- 2026-07-05 (codex): Added damage/HP progression replay validation with `hitEvents`, expected source/skill damage checks, and HP-derived kill sequence matching.
- 2026-07-05 (codex): Added explicit ranked Edge remote-enable gate so public
  Supabase env alone does not imply ranked Edge deployment or public leaderboard
  readiness.

## Scope

This is a backend readiness contract. Dormant remote Supabase schema provisioning from 2026-06-28 is done. The 2026-07-05 validation migration and Edge Function are local drafts only until Owner explicitly asks to apply/deploy them. Apps in Toss Console setup, Google Play setup, user identity binding, and production ranking are not done.

## Ranking Strategy

Selected strategy:

- Primary: Supabase verified ranking.
- Secondary: Apps in Toss leaderboard bridge-ready mirror.

Meaning:

- Supabase is the source of truth for verified ranked runs across platforms.
- Apps in Toss leaderboard can mirror accepted scores later, after official-doc re-check and platform adapter implementation.
- Public copy must not promise online/global ranking until `beginRankedRun` and `submitRankedRun` server verification are live.

## Ranked Run Boundary

Client flow:

1. `beginRankedRun(difficulty)` returns `runToken`, deterministic `seed`, `difficulty`, `configVersion`, `verification`, `issuedAtMs`, and `expiresAtMs`.
2. `GameApp` awaits the backend start and passes it to `GameScene`.
3. `GameScene` creates `RunSession` with that run start only if it passes public ranked start validation.
4. Local/stub starts remain playable but are forced to `rankingEligible=false`.
5. Ranked retry must fetch a fresh start; stale `server-ranked-*` config is not reused.
6. `WaveGenerator` uses the run seed and local config tables.
7. End of run creates a `RunSummary`:
   - `runToken`
   - `seed`
   - `difficulty`
   - `configVersion`
   - `verification`
   - `survivalMs`
   - `score`
   - `kills`
   - `maxCombo`
   - `lastSaveCount`
   - `remainingEnergy`
   - `skillUse`
8. `RunSession` records a ranked semantic replay trace:
   - `hitEvents`: `spawnOrdinal`, `hitAtMs`, distance band, accuracy, exact damage, optional damage multiplier, source, optional skill id, and optional hit segment.
   - `killEvents`: `spawnOrdinal`, `hitAtMs`, distance band, accuracy, optional damage multiplier, optional hit `source`, and optional hit `segment`.
   - `comboBreakEvents`: miss or Earth-hit combo break time.
   - `skillEvents`: skill id and use time.
9. `submitRankedRun(summary, replayTrace)` accepts only matching, unexpired, one-use server-issued tokens.
10. Local public-ranked validation replays the semantic trace against deterministic ranked spawns and scoring before submission.
11. The Edge draft also replays semantic score/kills/maxCombo/Last Save consistency before inserting a verified score.
12. Local and Edge validators require geometry proof for slash/Solar Lance, directional, and boss weak-point claims:
   - invalid source rejects.
   - slash and Solar Lance sourced kills require a replay segment.
   - slash segment shorter than the live hit minimum rejects.
   - Solar Lance sourced kills require a matching Solar Lance skill event near the hit time.
   - segment must intersect the replayed enemy hit circle using source-specific inflate.
   - claimed distance band must match replayed orbit radius.
   - directional enemies must match required slash angle.
   - boss weak-point claims must intersect the configured weak-point circle and match optional damage multiplier.
13. Local and Edge validators replay `hitEvents` through enemy HP before accepting submitted `killEvents`:
   - hit damage must match the source and skill definition.
   - non-lethal hit history must accumulate to the submitted kill.
   - hits after the replayed enemy death reject as duplicate kills.
   - submitted killEvents must match the HP-derived kill sequence.

## Data Classification

- Supabase-backed later: ranked runs, verified scores, minimal telemetry events, config version pinning.
- Local-only now: live slash points, frame state, local WebStub storage.
- Server-only secret/admin: Supabase service role, DB password, Apps in Toss Console API key, Toss login verification secret, Google Play credentials.

## Supabase Draft

Applied migrations:

- `supabase/migrations/20260628_orbitslash_ranking_draft.sql`
- `supabase/migrations/20260628_orbitslash_ranking_hardening.sql`

Local draft pending remote apply:

- `supabase/migrations/20260705_orbitslash_ranked_validation.sql`

Rules:

- Use `public` schema with `orbitslash_` prefix.
- RLS is enabled.
- No public-open policies.
- No raw Toss `userKey`.
- Client must not write service-role/admin data directly.
- `orbitslash_scores.run_id` has a unique index so one run can produce only one score row.
- Direct `anon` and `authenticated` table grants are revoked until server/Edge verification exists.
- `expires_at`, `used_at`, and `validation_version` are added in the local 2026-07-05 draft so ranked tokens expire and cannot be reused.

Historical remote verification note from 2026-06-28, not refreshed in the current release checklist:

- Tables exist: `orbitslash_runs`, `orbitslash_scores`, `orbitslash_telemetry_events`.
- RLS enabled on all three.
- Policy count is `0`.
- `orbitslash_scores_run_id_uidx` exists.
- `anon` / `authenticated` direct grants are empty.

Before release evidence use, re-run current remote schema/RLS/grant checks and
record the command/date/result next to the migration ids.

## Adapter Boundaries

- `src/game` must not import Supabase, Toss SDK, AdMob, Google Billing, or platform SDKs.
- Backend operations go through `BackendAdapter`.
- `src/platform/SupabaseEdgeBackendAdapter.ts` calls only the Edge Function with public anon auth.
- `src/platform/BackendAdapterFactory.ts` uses the Edge adapter only when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exist; otherwise it returns the local stub.
- Ranked Edge begin/submit/leaderboard remote calls require
  `VITE_RANKED_EDGE_REMOTE_ENABLED=true`; public Supabase URL/anon key alone
  remains a local-draft state.
- Public leaderboard rows require both `VITE_RANKED_EDGE_REMOTE_ENABLED=true`
  and `VITE_PUBLIC_LEADERBOARD_ENABLED=true`, plus identity-bound accepted rows
  returned by the Edge Function.
- `src/game/RankedReplayValidator.ts` owns the local semantic replay validator and spawn-bound sanity checks.
- Platform services stay behind `PlatformAdapter`.
- Telemetry has an allowlist and strips unapproved free-text-like props.
- Local gameplay without public Supabase env uses `LocalBackendAdapter`; public submit remains non-public until remote Edge deploy and identity binding are accepted.

## Edge Function Draft

Local file:

- `supabase/functions/orbitslash-ranked-run/index.ts`

Current checks:

- `begin`: validates difficulty, creates `server-ranked-*` token, seed, `server-ranked-v1` config version, expiry, and `status='started'`.
- `submit`: requires matching token, seed, difficulty, config version, unexpired `started` status, unused token, non-negative integer stats, and `remainingEnergy` within `0..100`.
- `submit`: requires trace arrays, unique positive `spawnOrdinal`, hit/skill/combo-break times within survival, valid distance bands/accuracy ids/combo-break reasons/skill ids, matching kill count, Last Save count, skill-use count, deterministic ranked spawn ordinal match, and replayed score/maxCombo consistency.
- `submit`: validates hit source/segment geometry for slash, Solar Lance, directional hits, and boss weak-point claims with the same replay constants mirrored from the local validator.
- `submit`: replays `hitEvents` through HP and rejects killEvents that do not match the HP-derived kill sequence.
- Inserts one verified score and marks the run `submitted`.

Still pending:

- Remote deploy.
- User/account identity binding through internal `core_user_id`.

## AI Readiness

AI UX is disabled for this stage.

Possible future AI/backend touchpoints:

- run anomaly review
- balance analysis summary
- QA session summarization

Any provider key must be server-only and called through backend/Edge proxy, not from the client.
