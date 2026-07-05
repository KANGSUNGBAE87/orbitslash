# orbitslash-ranked-run

Local Supabase Edge Function draft for public ranked runs.

## Contract

- `POST { "action": "begin", "difficulty": "rookie" }`
  - Creates one `orbitslash_runs` row with a `server-ranked-*` token, server seed, expiry, and `status='started'`.
  - Resolves internal `core_user_id` from a Supabase user access token when one is available.
  - Returns a client run start marked `verification: "server_verified"`, plus `identityBound`.
  - `rankingEligible` is true only when `identityBound` is true.
- `POST { "action": "submit", "summary": ..., "replayTrace": ... }`
  - Requires a matching unexpired run token, matching seed/difficulty/config, unused status, and sane non-negative counts.
  - Requires semantic replay trace arrays for kills, combo breaks, and skill use.
  - Requires hit replay events for non-lethal and lethal damage.
  - Rebuilds ranked spawn ordinals from seed/difficulty/survival time, applies boss-respawn delay from boss kill trace, and replays score/kills/max combo/Last Save counts before accepting.
  - Validates kill source/segment geometry for slash, Solar Lance, directional cut claims, and boss weak-point claims.
  - Replays hit damage through enemy HP and requires submitted killEvents to match the HP-derived kill sequence.
  - Inserts one verified `orbitslash_scores` row and marks the run `submitted`.

## Not Done Here

- Login/account UI is not implemented here; clients without a user access token begin local-only ranked runs because `identityBound=false`.
- Remote migration apply and Edge deployment are intentionally not done until Owner explicitly asks.
- Clients must not write directly to ranking tables.
