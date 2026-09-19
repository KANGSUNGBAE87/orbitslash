---
version: 0.8
status: draft
updated: 2026-09-19
canonical: true
---

# Orbit Slash — Platform Release Checklist

## Change Log

- 2026-09-19 (codex): Local-preparation cleanup passed all automated gates; store release remains
  deferred. Historical July remote evidence below is not a claim about current local sources.

- 2026-06-28 (codex): Added draft release readiness checklist for Apps in Toss and Google Play paths.
- 2026-06-28 (codex): Updated after hybrid ranking decision, dormant Supabase schema work, asset sprite pass, QA presets, and release hardening. Current remote state still needs re-verification before release evidence use.
- 2026-07-04 (codex): Updated after P0/P1/P2 implementation pass. Local ranked remains blocked from public ranking through `rankingEligible=false`; server-stub contract exists but real Edge validation is still required.
- 2026-07-05 (codex): Updated after DEV QA recorder/progression isolation pass. QA runs are local verification only and are blocked from progression writes.
- 2026-07-05 (codex): Updated after Story/Daily objective runtime pass. Story 1-3 and Daily modifier pass/fail rules now execute locally; public ranked remains blocked until server validation exists.
- 2026-07-05 (codex): Updated after ranked server-boundary pass. Client can use a Supabase Edge adapter when public env is present, server-verified starts are the only ranked-eligible path, local/server-stub starts remain unranked, and Edge/migration drafts exist locally. Remote apply/deploy and full input/geometry validation are still pending.
- 2026-07-05 (codex): Updated after ranked semantic replay validation pass. Run-local `spawnOrdinal`, kill/combo-break/skill trace, boss-delayed spawn replay, replayed scoring summary match, stricter Edge semantic score replay, and replay-bound sanity checks now exist locally. Full input/geometry anti-cheat and remote Edge deploy remain pending.
- 2026-07-05 (codex): Updated after ranked source/segment geometry validation pass. Local and Edge validators now check hit source, segment geometry, Solar Lance skill-event pairing, directional slash angle, and boss weak-point geometry.
- 2026-07-05 (codex): Updated after ranked damage/HP progression validation pass. `hitEvents` now replay non-lethal damage history before killEvents are accepted. Remote Edge deploy and identity binding remain pending.
- 2026-07-05 (codex): Updated after Threat/ModeResult/Story-Daily/Boss identity closure. Local gameplay now has skill-responsive Threat, boss shield knockback, Story 1-5, five Daily modifiers, mode-specific result/progression metadata, and always-on Threat HUD. Remote Edge deploy and identity binding remain pending.
- 2026-07-05 (codex): Updated after Free Defense/Boss Rush mode-completion pass. Free Defense now has difficulty/preset/daily-limit contracts, practice runs do not write progression, mode cards use a 3x2 grid, and Boss Rush detail/result/progression surfaces emphasize sequence and best boss count. Rewarded-ad revive, remote ranking apply, and real-device QA remain pending.
- 2026-07-05 (codex): Updated after Story full-plan pass. Story now has 8 chapters x 4 stages, 32 fixed seeds, tutorial keys, selected-stage launch, seed mismatch fail-fast behavior, and final-stage unlock cap. True in-game tutorial overlay remains future work.
- 2026-07-05 (codex): Updated after in-game tutorial pass. Story selected-stage launch now reaches `GameApp`, Story renders live non-modal tutorial callouts, Boss Rush renders active weak-point tutorial copy, and i18n parity tests cover tutorial keys. Real-device readability QA remains pending.
- 2026-07-05 (codex): Updated after Boss Pattern Batch A micro-pass. Weak-point-locked body hits now show explicit feedback, and Ringed Destroyer shard warnings render telegraph lanes before shard spawn.
- 2026-07-05 (codex): Updated after rewarded telemetry draft pass. Local rewarded-ad telemetry migration and dedicated Edge Function draft exist, but remote migration apply and Edge deploy are still pending.
- 2026-07-05 (codex): Updated after revive readiness gate pass. Endpoint URL configuration and remote telemetry readiness are separated; default Supabase adapters keep ad telemetry disabled until the explicit remote-enable flag is set.
- 2026-07-05 (codex): Updated after release-prep / leaderboard rows pass. `preflight:release` now bundles both Edge drafts and public leaderboard rows are implemented behind explicit public flags plus identity-bound verified rows.
- 2026-07-05 (codex): Updated after gameplay telemetry / platform adapter and official-doc recheck pass. Gameplay telemetry and platform adapter shells exist locally, Apps in Toss and Google Play official release/app-content references were rechecked, and content rating/data safety/store listing draft positions were recorded.
- 2026-07-05 (codex): Updated after release-claim guard pass. User-facing i18n copy and package metadata now have automated checks against misleading global ranking, cross-device sync, live ad/IAP, and store-ready claims.
- 2026-07-05 (codex): Updated after result-title closure pass. Result overlay titles now distinguish clear/survived/game-over, Daily failure edge cases have direct tests, and Phase 4 mode-flow checklist wording matches the mode-detail start UX.
- 2026-07-05 (codex): Updated after release-build polish. Vite chunk-size warning is cleared by using a 600 kB warning threshold for the Pixi game bundle.
- 2026-07-05 (codex): Updated after local mode-detail guard pass. Story detail preview and Ringed Destroyer tutorial phase copy have local automated coverage; real-device readability QA remains open.
- 2026-07-05 (codex): Updated after 390x844 local browser smoke. Story detail spacing overlap was fixed and Story/BossRush tutorial smoke passed locally; real-device/WebView QA remains open.
- 2026-07-05 (codex): Updated after blocked weak-point feedback hardening. Weak-point-locked body hits now have local integration/HUD coverage for the dedicated blocked callout; real-device readability remains open.
- 2026-07-05 (codex): Updated after Story/Daily content-profile pass. Story/Daily now have active local content-profile runtime differences, but real-device/WebView QA remains open.
- 2026-07-05 (codex): Updated after boss phase pressure and special-object motion pass. Active boss phases now affect normal wave pressure, rescue/satellite objects move, and local automated coverage increased to 466 tests.
- 2026-07-05 (codex): Confirmed the project release-order plan from the shared app platform standard: Google Play-first release prep while preserving Apps in Toss compatibility. Actual publishing remains separate.
- 2026-07-05 (codex): Updated after release target SSOT / target-boundary pass. `ReleaseTarget.ts` records target status and `preflight:release` now runs generic, Google Play target, and Apps in Toss target boundary scans.
- 2026-07-05 (codex): Updated after product-plan release target addendum. The product plan now has a current target addendum pointing to `ReleaseTarget.ts` without deleting the original Apps in Toss plan text.
- 2026-07-05 (codex): Updated after asset-preload closure. The app-shell
  preload set now includes all shipped enemy and boss prototype assets; final
  artist-supplied replacements remain a content task.
- 2026-07-05 (codex): Updated after local-readiness closure pass. Gameplay
  telemetry now has client-to-backend wiring, collection UI reads stored
  progress, platform adapters are selected through a factory, ranked Edge calls
  require an explicit remote-enable flag, telemetry `ready` requires remote
  write verification, and `preflight:release` is labeled local-only.
- 2026-07-05 (codex): Updated after verification reconciliation. Boss asset
  preload tests now reject fallback URLs, misleading release-claim scans have
  typed unit coverage, and latest local verification passed at 78 files / 487
  tests.
- 2026-07-05 (codex): Updated after platform telemetry context pass. Platform
  adapters now expose runtime context, GameScene telemetry includes runtime
  metadata, Apps in Toss private/live/sandbox channel detection has local tests,
  and Google Play telemetry is allowed without Toss runtime_channel.
- 2026-07-05 (codex): Updated after read-only remote Supabase reverify. Remote
  currently has only `orbitslash_runs` and `orbitslash_scores`; both have RLS on,
  public policy count 0, and no anon/authenticated table grants. The 2026-07-05
  local migrations and Orbit Slash Edge Functions are not deployed remotely.
- 2026-07-06 (codex): Published commit `8821df6` to GitHub Pages, applied
  Orbit Slash Supabase migrations through targeted `db query` statements because
  the shared Supabase project has cross-app migration history, deployed
  `orbitslash-ranked-run`, `orbitslash-rewarded-ad-telemetry`, and
  `orbitslash-gameplay-telemetry`, added service-role table grants, and verified
  remote ranked begin plus rewarded/gameplay telemetry writes. Public leaderboard
  remains intentionally disabled and identity-bound ranked submission QA remains
  pending.

## Current status — 2026-09-19

No deployment/store release requested. Local tests (969), typecheck/build, three source boundary
scans, shell/assets/generated checks, seven Edge bundles and seven Deno type checks passed.
CI configuration now uses Node 24 and pinned Deno; actual GitHub execution awaits a future push.
Current feature/remote/device matrix: `review.md`; reproducible commands: `../../docs/local-development.md`.
The following July release history is retained for reference, not current launch approval.

## Historical Release Target Status — July 2026

- Current implementation target: GitHub Pages playable build plus remote backend
  smoke-ready release-candidate backend.
- Release target SSOT: `src/platform/ReleaseTarget.ts` records Google Play-first
  release prep, Apps in Toss compatibility, and the rule that actual publishing
  needs a separate Owner command.
- Public ranking: remote `orbitslash-ranked-run` is deployed and anonymous
  ranked begin smoke passes, but public leaderboard is still disabled and
  identity-bound ranked submit must be verified before enabling public ranking.
- Store release: not ready.
- GitHub deployment: commit `8821df6` deployed successfully through GitHub
  Actions run `28746871714`; live root returned `HTTP 200` with last-modified
  `Sun, 05 Jul 2026 16:17:32 GMT`.
- DEV-only QA screen: `Touch/HUD`, `Boss Weak`, `Special`, `Blitz` launchers with local PASS/PEND markers.
- DEV-only QA presets: `?qaPreset=directional`, `?qaPreset=lastSave`, `?qaPreset=dense`, `?qaPreset=boss`, `?qaPreset=blockedBody`, `?qaPreset=special`.
- Release-boundary preflight: local script passed on 2026-07-05 after
  local-readiness closure and release-boundary hardening; it is not remote,
  app-store, or GitHub verification.
- Asset preload: Earth core/shield plus every shipped enemy and five-boss
  prototype asset are included in the app-shell preload set.

## Apps in Toss Checklist

- [x] Re-check official Apps in Toss release, game checklist, UI/UX, sandbox, and Toss app testing docs.
- [x] Confirm game/service policy fit.
- [ ] Verify Safe Area and Toss navigation behavior on a real Toss test surface.
- [x] Keep Toss login, ads, IAP, haptics behind adapters.
- [x] Do not expose the `APPS_IN_TOSS_CONSOLE_API_KEY` value in repo, app bundle, logs, screenshots, or public env.
- [x] Confirm no raw Toss userKey storage.
- [x] Confirm ad/IAP are stub-only until officially implemented.

## Google Play Checklist

- [x] Confirm project release order: Google Play-first release prep while preserving Apps in Toss compatibility. Actual publishing still requires a separate Owner release command.
- [x] Prepare content rating/data safety draft based on current feature scope; final Console answers must be rechecked after feature freeze.
- [x] Keep Google login, Play Billing, AdMob, haptics behind adapters.
- [x] Do not imply online/global ranking before verified backend ranking exists.
- [x] Store listing draft position: describe implemented local/same-seed gameplay only until public ranking is live.

## Official Doc Recheck — 2026-07-05

Apps in Toss current official catalog references checked:
- Service open process/policy, service cautions, sandbox testing, Safe Area, runtime environment, storage, analytics init, user key for game, game center, in-app ad, in-app purchase, branding, external link, and Consumer UX/dark-pattern guidance are present in the Apps in Toss official `llms.txt` catalog.
- Current local implementation fit: game/service policy has no known blocker in code, but real Toss test surface QA is still required for Safe Area, navigation/back behavior, runtime channel detection, and WebView performance.
- Current local SDK posture: login, ads, IAP, haptics, storage, and analytics are adapter/bridge-only; no live Apps in Toss SDK is enabled.

Google Play current official references checked:
- Play Console App content must include safety/compliance/legal information.
- Data safety requires privacy policy, review of collected/shared user data, security practices, permissions, and APIs.
- Content rating requires an accurate rating questionnaire for each app/game and resubmission if content/features change.
- Target audience/content must be declared; children-targeting creates additional policy requirements.
- Google Play Games Services quality checklist requires authentication if claiming PGS compatibility.

Current Google Play draft positions:
- Target audience draft: not children-directed; final age group to be decided with store positioning.
- Content rating draft: arcade/action skill game with fantasy planet destruction, no blood/gore, no chat, no user-generated content, no gambling, no real-money gameplay reward.
- Data safety draft: local gameplay/progression plus optional Supabase ranking/telemetry after remote enable; no raw Toss userKey or device identifiers; service-role writes only through Edge Functions.
- Ads/IAP draft: stub-only now; do not claim enabled ad revive, AdMob, billing, or paid entitlement until real SDK integration and telemetry are deployed.
- Store copy draft: describe swipe/slash survival, waves, bosses, skills, and local/fair challenge modes; avoid global leaderboard copy until remote verified ranking is live.

## Backend/Ranking Checklist

- [x] Ranking strategy selected: hybrid with Supabase verified ranking primary and Apps in Toss leaderboard bridge-ready.
- [x] Keep dormant Supabase schema/RLS/service-role separation contract in local SQL and historical notes.
- [x] Reverify current remote Supabase schema/RLS state before release evidence use: 2026-07-06 check found `orbitslash_runs`, `orbitslash_scores`, `orbitslash_telemetry_events`, `orbitslash_rewarded_ad_events`, and `orbitslash_gameplay_events`; all have RLS on.
- [x] Implement local server/Edge `beginRankedRun` draft with server-issued token, seed, config version, expiry, and one ranked start response.
- [x] Implement local server/Edge `submitRankedRun` draft with token lookup, expiry, one-use guard, seed/difficulty/config matching, and sane score/count checks.
- [x] Add client Edge adapter path using only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; local fallback remains non-ranked.
- [x] Add semantic replay trace validation for public ranked submit: stable spawn ordinals, boss-delayed spawn ordinals, kill timing, combo breaks, skill events, replayed score/kills/maxCombo/Last Save/skill count match.
- [x] Add source/segment geometry validation for slash, Solar Lance, directional cut claims, and boss weak-point claims in local and Edge validators.
- [x] Add damage/HP progression replay for non-lethal hit history before killEvents are accepted.
- [x] Add local Edge draft guard that rejects ranked score inserts when `core_user_id` is missing.
- [x] Gate ranked Edge remote calls behind explicit `VITE_RANKED_EDGE_REMOTE_ENABLED=true`.
- [x] Add ranked submit outcome state so result UI can move from pending to submitted/failed.
- [x] Add rewarded-ad platform/backend contract stubs without enabling revive CTA.
- [x] Draft rewarded-ad telemetry migration and dedicated Edge Function locally.
- [x] Gate rewarded-ad telemetry remote readiness behind explicit remote-enable plus remote-write-verified state.
- [x] Add gated public leaderboard rows contract in adapter, UI, and Edge draft.
- [x] Add local Remote Config fetch/fallback gated behind explicit remote-config env flags.
- [x] Add admin-only rejected ranked-run diagnostics Edge draft plus local rejection-reason migration.
- [x] Add gameplay telemetry migration and dedicated Edge Function draft locally, with CORS, remote-enable gate, sensitive payload rejection, ranked run identity binding, and client `BackendAdapter.trackEvent` wiring.
- [x] Apply the 2026-07-05 ranking validation migration remotely.
- [x] Deploy `orbitslash-ranked-run` Edge Function remotely.
- [x] Apply the 2026-07-05 ad telemetry migration remotely.
- [x] Deploy `orbitslash-rewarded-ad-telemetry` Edge Function remotely.
- [x] Apply the 2026-07-05 gameplay telemetry migration remotely.
- [x] Deploy `orbitslash-gameplay-telemetry` Edge Function remotely.
- [x] Add/apply `service_role` grants for Orbit Slash Edge Function table writes.
- [x] Verify remote anonymous ranked begin smoke, rewarded telemetry write, and gameplay telemetry write.
- [ ] Verify remote ranked runs/scores bind to internal `core_user_id` before public leaderboard launch and before enabling `VITE_RANKED_EDGE_REMOTE_ENABLED=true`.
- [x] Verify local SQL/Edge source keeps RLS and anon/service-role separation.
- [x] Reverify current remote anon/service-role separation before release evidence use: remote tables have RLS enabled; public client writes stay routed through Edge Functions, with `service_role` grants added only for server-side function access.
- [x] Keep service-role operations server-only in the local Edge draft; client code only calls the Edge Function with public anon auth.

## QA Carryover

See canonical QA backlog:

- `ai/reviews/review.md`

Latest local verification:

- `npm test -- --run`: 78 files / 494 tests passed on 2026-07-05 after blocked-body QA preset, ranked Graviton guard, special-object feedback labels, and HUD geometry guards.
- `npm run build`: passed on 2026-07-05 after local-readiness closure. This includes `tsc --noEmit`; Vite chunk-size warning is cleared with the Pixi-game threshold at 600 kB.
- `npm run preflight:release`: passed on 2026-07-05 after blocked-body/HUD guard updates; it runs generic, Google Play target, Apps in Toss target boundary scans, and Edge draft bundle checks. Deno check was skipped because Deno is not installed in PATH.
- `git diff --check`: passed on 2026-07-05 after blocked-body/HUD guard updates.
- Edge Function draft syntax/bundle checks for `orbitslash-ranked-run`, `orbitslash-rewarded-ad-telemetry`, and `orbitslash-gameplay-telemetry` with `npx esbuild ... --external:https://esm.sh/@supabase/supabase-js@2`: passed through `preflight:release`.
- Release-claim guard: i18n copy and `package.json` metadata reject misleading global/online ranking, cross-device sync, live ad/IAP, and store-ready claims while remote ranking/ad/IAP remain gated.
- Focused ranked boundary check: 4 files / 27 tests passed for validator, run-session hit/kill trace copy, backend validation, and Edge adapter.
- `deno check`: skipped by `preflight:release` because Deno CLI is not installed in current PATH.
- GitHub Pages deploy: pushed `8821df6` to `main`; GitHub Actions run
  `28746871714` succeeded after rerunning a transient Pages deploy failure.
- Live GitHub Pages smoke: `https://kangsungbae87.github.io/orbitslash/`
  returned `HTTP 200`.
- Remote Supabase schema apply: targeted `supabase db query` statement runner
  applied Orbit Slash migrations because shared project migration history blocks
  repo-local `supabase db push`.
- Remote Supabase smoke: `orbitslash-ranked-run` leaderboard returns expected
  disabled `403`, anonymous ranked begin returns `200`, and rewarded/gameplay
  telemetry Edge writes return `200`.
- Graphify refreshed: 3232 nodes / 346877 edges after local gap closure and final blocked-body path update.
- cmm refreshed via CLI after MCP transport failure: `Users-kangsungbae-Documents-orbitslash` ready with 3284 nodes / 6878 edges.
- Production bundle string check: no `qaMode` / `qaPreset` / `qaGauge` strings found in `dist`.
- Historical local Chrome mobile smoke: canvas rendered, all five enemy SVG assets returned 200, no console/page errors before the latest QA recorder patch.
- Historical GitHub Pages live smoke: canvas rendered, enemy SVG asset returned 200, no console/page errors before the latest local-only QA recorder patch.
- Latest local in-app browser smoke: `http://127.0.0.1:5191/` rendered one canvas at 390x844, launched gameplay from home, and reported no app console errors before server shutdown.
- Latest local in-app browser 390x844 smoke: `http://127.0.0.1:5194/` showed Story detail selected-stage/tutorial/unlock summary after the spacing fix, Story gameplay tutorial below the playfield/top HUD, and Boss Rush QA weak-point tutorial copy with no console warnings/errors. Blocked-hit readability was attempted but not counted as evidence.
- Latest blocked weak-point automated guard: local tests cover `boss_body_locked` -> dedicated callout wiring, deterministic `?qaPreset=blockedBody` reproduction, and HUD callout readability/duration/geometry. In-app browser drag smoke at `http://127.0.0.1:5195/` reported no console errors, but the canvas drag path did not clearly prove a wrong-body-hit capture, so real-device/WebView readability remains pending.
- Latest local HTTP smoke: `http://127.0.0.1:5188/` returned `200 OK`.
- Latest automated Playwright re-smoke: after installing matching Playwright Chromium build `1200`, QA recorder stored Boss Weak PASS, launched `?qaMode=bossRush&qaPreset=boss&qaGauge=100&seed=1234`, and reported no console/page errors. This is still not real-device QA evidence.
