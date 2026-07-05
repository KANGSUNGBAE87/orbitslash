# 2026-07-05 Local Readiness Closure

Actor: codex

## User Request

- Continue implementation at high speed with subagents already involved.
- Keep moving through the remaining local checklist without deploying or
  committing unless explicitly requested.

## Decisions Made

- Treat public Supabase URL/anon key as configured-only, not ranked readiness.
- Require `VITE_RANKED_EDGE_REMOTE_ENABLED=true` before remote ranked Edge calls
  can run.
- Treat telemetry endpoint URL plus remote-enable flag as configured-only.
  Telemetry `ready` now requires explicit remote verification or a successful
  remote write.
- Keep release preflight wording local-only: boundary scans and Edge draft
  bundle checks are not remote/app-store/GitHub verification.

## Files Changed

- Gameplay telemetry now drains local gameplay events into
  `BackendAdapter.trackEvent` after death and ranked submit result events.
- Collection UI now reads stored boss, special-object, title, and mode progress.
- Platform adapter selection now routes through `PlatformAdapterFactory` instead
  of a hardcoded web stub.
- Supabase Edge ranked, rewarded telemetry, and gameplay telemetry adapters now
  separate configured, enabled, verified, and ready states.
- App-shell visual preload includes all shipped enemy, boss, and Earth assets.
- Release boundary logic now has typed misleading-release-claim coverage.
- Platform adapters now expose telemetry runtime context; GameScene sends that
  context with gameplay telemetry instead of hardcoding `web_stub`.
- Apps in Toss runtime channel detection covers sandbox, private test, and live
  hints; Google Play telemetry remains `google_play` without Toss
  `runtimeChannel`.
- Docs updated:
  - `ai/reviews/review.md`
  - `ai/reviews/release-checklist.md`
  - `ai/reviews/phase0-4-qa-checklist.md`
  - `ai/plans/master-roadmap.md`

## Subagent / Claude Notes

- Pasteur release-state audit identified overclaims around remote Supabase/RLS,
  ranked Edge readiness, telemetry readiness, and release-prep wording.
- Peirce implementation review identified dead gameplay telemetry flushing,
  static collection state, and hardcoded platform adapter selection.
- Claude CLI first-party review identified stale verification numbers, missing
  asset-preload documentation, weak boss-asset fallback tests, and missing typed
  misleading-claim scan coverage.

## Verification Run

- `npm test -- --run`: 78 files / 489 tests passed.
- `npm run build`: passed, including `tsc --noEmit`.
- `npm run preflight:release`: passed local boundary scans and Edge draft bundle
  checks; `deno check` skipped because Deno is not installed in PATH.
- `git diff --check`: passed.
- `graphify update . --no-cluster`: refreshed to 3192 nodes / 331096 edges.
- `codebase-memory-mcp cli index_repository`: refreshed to 3223 nodes / 6515
  edges.
- Read-only remote Supabase check:
  - Existing Orbit Slash remote tables: `orbitslash_runs`, `orbitslash_scores`.
  - Both existing tables have RLS enabled.
  - Public policy count: 0.
  - anon/authenticated table grants: none found.
  - Orbit Slash remote Edge Functions: none found.
  - 2026-07-05 local telemetry/rejection tables are not applied remotely.

## Remaining Risks

- Remote Supabase 2026-07-05 migrations and Orbit Slash Edge Function deploys
  are not applied.
- Remote ranked identity binding must be verified before enabling
  `VITE_RANKED_EDGE_REMOTE_ENABLED=true`.
- Rewarded-ad and gameplay telemetry remote writes must be verified before
  treating telemetry as release-ready.
- Real-device/WebView QA remains open for touch feel, boss readability,
  five-slot HUD, safe-area, and performance.
- Final artist-supplied assets remain pending.

## Knowledge Promotion

- No cross-project durable rule promoted. This session refined Orbit Slash local
  readiness and release-boundary evidence only.

## Continuation — Local Gap Closure

User request:
- Continue the current high-speed implementation pass.

Files changed:
- `src/game/GameScene.ts`
  - Added DEV `blockedBody` QA preset.
  - Reused the same blocked boss-body feedback helper for actual
    `boss_body_locked` hits and the deterministic QA preset.
  - Added `movementDtForEnemy` so ranked mode keeps Graviton pull disabled while
    non-ranked movement still applies pull acceleration.
  - Added type-specific special-object penalty/benefit/reward feedback labels.
- `src/game/DevQa.ts`, `src/game/GameApp.ts`, `src/render/AppShell.test.ts`
  - Routed the Boss Weak DEV QA launcher to `blockedBody` while preserving the
    older `boss` preset for direct URL checks.
- `src/render/Hud.ts`, `src/render/HudLayout.test.ts`
  - Exposed tutorial/blocked-panel/skill-row metrics and added non-overlap
    layout guards.
- `src/i18n/ko.json`, `src/i18n/en.json`, `src/i18n/i18nParity.test.ts`
  - Added localized special-object feedback labels and parity coverage.
- `ai/plans/implementation-plan.md`, `ai/plans/master-roadmap.md`,
  `ai/reviews/review.md`, `ai/reviews/release-checklist.md`
  - Cleaned stale Phase 1/Four-skills wording and updated verification evidence.

Verification run:
- `npm test -- --run`: 78 files / 494 tests passed.
- `npm run build`: passed earlier in this continuation after source changes.
- `npm run preflight:release`: passed; `deno check` skipped because Deno is not
  installed in PATH.
- `git diff --check`: passed.
- Stale wording scan for old Phase 1/Four-skills/Apps-in-Toss-LATER markers:
  clean.
- `graphify update . --no-cluster`: refreshed to 3232 nodes / 346877 edges.
- `codebase-memory-mcp cli index_repository`: refreshed to 3284 nodes / 6869
  edges after retrying with the required `repo_path` argument, then refreshed
  again to 3284 nodes / 6878 edges after the final blocked-body path update.

Remaining risks:
- Real-device/WebView readability remains pending for blocked boss-body
  feedback, special-object labels, HUD panel spacing, and Graviton feel.
- Latest local changes are still uncommitted and undeployed.
- Remote Supabase migrations/functions remain unapplied.
