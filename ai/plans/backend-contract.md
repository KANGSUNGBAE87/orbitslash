---
version: 0.1
status: draft
updated: 2026-06-28
canonical: true
---

# Orbit Slash — Backend and Ranking Contract

## Change Log

- 2026-06-28 (codex): Added local contract draft for ranked run seed/token boundary, Supabase table draft, and release safety constraints.
- 2026-06-28 (codex): Fixed ranking strategy as hybrid, provisioned dormant Supabase schema remotely, and added hardening migration.

## Scope

This is a backend readiness contract. Remote Supabase schema provisioning is done, but Edge Function deployment, Apps in Toss Console setup, Google Play setup, and production ranking are not done.

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

1. `beginRankedRun(difficulty)` returns `runToken`, deterministic `seed`, and `difficulty`.
2. `GameScene` creates `RunSession` with that run start.
3. `WaveGenerator` uses the run seed and local config tables.
4. End of run creates a `RunSummary`:
   - `runToken`
   - `seed`
   - `difficulty`
   - `survivalMs`
   - `score`
   - `kills`
   - `maxCombo`
   - `lastSaveCount`
   - `remainingEnergy`
   - `skillUse`
5. Production server must recompute or validate the run before accepting a public score.

## Data Classification

- Supabase-backed later: ranked runs, verified scores, minimal telemetry events, config version pinning.
- Local-only now: live slash points, frame state, local WebStub storage.
- Server-only secret/admin: Supabase service role, DB password, Apps in Toss Console API key, Toss login verification secret, Google Play credentials.

## Supabase Draft

Applied migrations:

- `supabase/migrations/20260628_orbitslash_ranking_draft.sql`
- `supabase/migrations/20260628_orbitslash_ranking_hardening.sql`

Rules:

- Use `public` schema with `orbitslash_` prefix.
- RLS is enabled.
- No public-open policies.
- No raw Toss `userKey`.
- Client must not write service-role/admin data directly.
- `orbitslash_scores.run_id` has a unique index so one run can produce only one score row.
- Direct `anon` and `authenticated` table grants are revoked until server/Edge verification exists.

Remote verification on 2026-06-28:

- Tables exist: `orbitslash_runs`, `orbitslash_scores`, `orbitslash_telemetry_events`.
- RLS enabled on all three.
- Policy count is `0`.
- `orbitslash_scores_run_id_uidx` exists.
- `anon` / `authenticated` direct grants are empty.

## Adapter Boundaries

- `src/game` must not import Supabase, Toss SDK, AdMob, Google Billing, or platform SDKs.
- Backend operations go through `BackendAdapter`.
- Platform services stay behind `PlatformAdapter`.
- Telemetry has an allowlist and strips unapproved free-text-like props.
- Local gameplay currently uses `LocalBackendAdapter`; public submit remains disabled.

## AI Readiness

AI UX is disabled for this stage.

Possible future AI/backend touchpoints:

- run anomaly review
- balance analysis summary
- QA session summarization

Any provider key must be server-only and called through backend/Edge proxy, not from the client.
