---
version: 0.5
status: active
updated: 2026-09-19
canonical: true
---

# Orbit Slash — Master Roadmap Checklist

This is the canonical implementation checklist that connects the original
release-product plan to the current code state. Use it before choosing the next
implementation task so work stays aligned with the six-mode product goal.

## Change Log

- 2026-09-19 (codex): 0~1단계 cleanup 완료. 기준선 백업, 공유 경계/취소/검사 복구,
  Node 24/Deno 및 CI preflight, Edge 타입 검사 정상화. 136 files / 969 tests 통과.

- 2026-09-19 (codex): Owner 방향을 로컬 구현 준비로 변경. 아래 현재 상태/큐가 우선하며,
  Phase 0–8의 오래된 체크는 역사적 작업 기록이다. 출시/설치를 로컬 작업의 선행 조건에서 제외.

- 2026-07-11 (codex): Added the current product-completion 1~5 queue and linked
  the detailed execution plan. Corrected Phase 7 wording so bridge interfaces
  are not reported as completed Google Play/Apps in Toss runtime integrations.

- 2026-07-01 (codex): Created after three subagent reviews of the original
  product plan, implementation plan, current code state, QA backlog, and release
  checklist.
- 2026-07-01 (codex): Implemented Phase 0/1/3/4 core pass: mode contracts,
  `RunConfig`-driven `GameScene`, early skill activation/effects, special object
  contract, five boss definitions, app shell, and local progression storage.
- 2026-07-04 (codex): Synced after P0/P1/P2 implementation pass: Nova Pulse is
  the fifth release skill, gameplay Earth size follows current `coords.ts`
  values, special objects now include protect/avoid rewards, Delta Shield has
  persistent HUD state, boss weak-point positional hits are wired, 60s Blitz has
  six runtime bands, Story 1-3 and Daily modifier contracts exist, and ranked
  remains blocked behind server validation.
- 2026-07-05 (codex): Synced after P0/P1/P2 checklist audit: Nova Pulse is the
  canonical fifth skill, DEV QA presets include boss/special, ranked semantic
  replay includes boss-delayed spawn ordinals, and current dirty worktree has not
  been redeployed.
- 2026-07-05 (codex): Synced after in-game tutorial pass: Story selected-stage
  launch now reaches `GameApp`, Story stages render live tutorial callouts, and
  Boss Rush renders weak-point tutorial copy from the active boss phase.
- 2026-07-05 (codex): Synced after Boss Pattern Batch A micro-pass: Ringed
  Destroyer shard warnings render telegraph lanes and weak-point-locked body
  hits show explicit blocked-hit feedback.
- 2026-07-05 (codex): Synced after P0 AppShell contract cleanup: settings now
  opens locale switching, static shell screens rebuild when locale changes,
  records/results/collection use canonical mode/boss/daily labels, and i18n
  parity covers shell/progress/result keys.
- 2026-07-05 (codex): Synced after Phase 4 closure batch: AppState now boots
  through boot/loading/ready, bootstrap mounts GameApp before remote/config asset
  preload, AppShell exposes boot/loading surfaces and settings through the app
  state machine, and safe-area/root-fit layout tests cover mobile viewports.
- 2026-07-05 (codex): Synced after P0-A enemy pool/replay alignment: eight
  advanced enemy variants, four additional boss visual identities, mode-specific
  wave overlays, split/shield/armor/graviton runtime hooks, and ranked replay
  spawn/absorbed-hit trace semantics are implemented. Graviton pull is gated off
  in ranked until server replay can reproduce interactive pull geometry.
- 2026-07-05 (codex): Synced after Boss Pattern Batch B: boss shard attacks now
  use active phase pattern profiles, Lava/Ice/Dark bosses spawn themed attack
  enemies, phase transitions emit one-shot phase-action bursts and reset shard
  timing, telegraphs carry phase/pattern metadata, and Lava Titan body damage is
  locked behind phase-specific core/heart weak points.
- 2026-07-05 (codex): Synced after Boss Practice / Ranked hardening pass:
  Free Defense Boss Practice can pin any of the five release bosses, DEV QA URL
  can open a selected practice boss, Ranked detail has Rookie/Defender/Elite/Master
  difficulty tabs, ranked retry returns for a fresh token, ranked seeds are fixed
  by KST Monday 06:00 weekly windows, and local/Edge replay rejects invalid
  boss-shard type/time claims.
- 2026-07-05 (codex): Synced after revive/leaderboard boundary pass: Free
  Defense ad revive is explicit disabled/adapter-gated copy with no reward CTA,
  records can render verified-leaderboard locked/live boundary states, backend
  adapters expose leaderboard status, and the local Edge draft rejects ranked
  score inserts when `core_user_id` is not bound.
- 2026-07-05 (codex): Synced after outcome/limit/ad-contract pass: ranked
  submit results can update the result screen from pending to submitted/failed,
  Free Defense standard 5/5 shows an explicit locked state while practice stays
  startable, and platform/backend rewarded-ad contracts now separate capability,
  reward earned, dismiss, and telemetry-not-configured states.
- 2026-07-05 (codex): Synced after rewarded telemetry draft pass: local
  `orbitslash_rewarded_ad_events` migration, dedicated
  `orbitslash-rewarded-ad-telemetry` Edge Function draft, and Supabase adapter
  routing to the dedicated endpoint now exist. Remote migration apply/deploy is
  still not done.
- 2026-07-05 (codex): Synced after revive readiness gate pass: rewarded-ad
  telemetry endpoint configuration is separated from remote deployment, default
  Supabase adapters keep ad telemetry in local-draft mode, and Free Defense
  revive remains locked unless platform rewarded ads and remote telemetry are
  both explicitly ready.
- 2026-07-05 (codex): Synced after release-prep / leaderboard rows pass:
  `preflight:release` bundles both Edge drafts and runs release-boundary checks,
  public leaderboard rows have a gated local/Edge contract, and rows remain
  hidden unless public leaderboard flag plus identity-bound verified rows exist.
- 2026-07-05 (codex): Synced after release-claim guard pass: package metadata,
  records copy, DEV QA copy, and i18n text now have tests preventing misleading
  global ranking, cross-device sync, live ad/IAP, or store-ready claims before
  remote/backend/platform evidence exists.
- 2026-07-05 (codex): Synced after automated mode-matrix hardening pass: ranked
  local-only result state, Blitz survived result state, Story locked-stage/raw-id
  guards, failed Story/Daily non-progression, Daily fail cases, and Boss Rush
  runtime sequence display are covered by local tests.
- 2026-07-05 (codex): Synced after result-title closure pass: result overlay
  titles now distinguish clear/survived/game-over outcomes, Daily failed-protect
  and missing-target edge cases have direct tests, and the Phase 4 mode-flow
  checklist wording matches the mode-detail start UX.
- 2026-07-05 (codex): Synced after release-build polish: Vite chunk-size warning
  is cleared by using a 600 kB threshold for the Pixi game bundle.
- 2026-07-05 (codex): Synced after local mode-detail guard pass: Story detail
  selected-stage/tutorial/unlock summary and Ringed Destroyer ring/body/core
  tutorial copy are covered by local automated tests.
- 2026-07-05 (codex): Synced after 390x844 local browser smoke: Story detail
  spacing overlap was fixed, and local smoke confirmed Story tutorial plus Boss
  Rush weak-point tutorial visibility without console warnings/errors.
- 2026-07-05 (codex): Synced after leaderboard submission wording split:
  local draft submit/outcome boundaries are checked separately from remote
  identity-bound leaderboard submission.
- 2026-07-05 (codex): Synced after content-profile pass: Story and Daily now
  carry active content profiles that affect enabled skills, special-object mix,
  boss timing/type, spawn pressure, and enemy weight bias; release-time skill
  activation now respects `enabledSkills`; directional wrong-angle hits have a
  distinct short feedback burst.
- 2026-07-05 (codex): Synced after boss phase pressure and special-object
  motion pass: active boss phases now conservatively increase normal wave
  pressure through existing `spawnWeightMul`, and friendly rescue/satellite
  objects now move while capsule/mine objects stay static.
- 2026-07-05 (codex): Synced release-order decision from the shared app platform
  standard: Orbit Slash stays Google Play-first for release prep while preserving
  Apps in Toss compatibility; actual publishing remains a separate Owner action.
- 2026-07-05 (codex): Synced after release target SSOT / target-boundary pass:
  `src/platform/ReleaseTarget.ts` records the current release target plan and
  `preflight:release` now runs generic, Google Play target, and Apps in Toss
  target boundary scans.
- 2026-07-05 (codex): Synced product-plan release target addendum so the
  canonical product plan preserves the original Apps in Toss wording while
  pointing current execution to `src/platform/ReleaseTarget.ts`.
- 2026-07-05 (codex): Synced after asset-preload closure: app-shell visual
  preload now includes every shipped enemy and boss asset; final artist-supplied
  asset replacement remains a future content pass.
- 2026-07-05 (codex): Synced after local-readiness closure pass: gameplay
  telemetry flushes through `BackendAdapter.trackEvent`, collection UI reads
  boss/special/title progress, platform adapter selection is injectable, ranked
  Edge calls require `VITE_RANKED_EDGE_REMOTE_ENABLED=true`, and telemetry
  `ready` requires remote write verification.
- 2026-07-05 (codex): Synced after verification reconciliation: boss asset
  preload tests reject fallback asset URLs, misleading release-claim scans have
  typed unit coverage, and latest full local regression passed at 78 files / 487
  tests.
- 2026-07-05 (codex): Synced after platform telemetry context pass: adapters
  expose runtime metadata, GameScene telemetry no longer hardcodes `web_stub`,
  Apps in Toss private/live/sandbox channel detection is tested, and latest full
  local regression passed at 78 files / 489 tests.
- 2026-07-05 (codex): Synced after read-only remote Supabase reverify: remote
  has only `orbitslash_runs` and `orbitslash_scores`, both RLS-on with no public
  policies or anon/authenticated grants; latest local telemetry/rejection tables
  and Orbit Slash Edge Functions are not remote-deployed.
- 2026-07-05 (codex): Synced after local gap closure: Boss Weak DEV QA uses
  deterministic `blockedBody`, special-object feedback labels are type-specific,
  ranked Graviton pull has a GameScene-level replay guard, HUD tutorial/blocked
  panel geometry has local guards, and latest full local regression passed at
  78 files / 494 tests.

## Source Of Truth Map

- Product scope: `ai/plans/product-plan.md`
  - Six modes: Story Stage, Free Defense, Ranked League, Boss Rush, 60s Blitz,
    Daily / Event Challenge.
  - Release-product scope: core combat, judgment objects, five skills, five
    bosses, six modes, ranking server, Remote Config, retry/ad readiness.
- Visual and UI direction: `ai/plans/design-plan.md`,
  `ai/plans/design-system.md`
  - Home screen includes a six-card mode grid.
  - Mode screens exist for Ranked, Free Defense, Boss Rush, 60s Blitz, Daily.
- Architecture reference: `ai/plans/implementation-plan.md`
  - Phase 1 architecture, data-driven balance, pure logic boundaries, platform
    adapter separation.
- Current readiness: `ai/reviews/review.md`
  - Latest QA backlog and implementation backlog.
- Release gates: `ai/reviews/release-checklist.md`
  - Platform, backend/ranking, Apps in Toss, Google Play readiness.
- Evidence: `ai/session-logs/`
  - Dated implementation, QA, and handoff records.

## Current Product State — 2026-09-19

Current scope: **local implementation preparation; no release execution**.
The current queue below and `implementation-plan.md` §0 supersede historical queue wording.

| Area | Status | Remaining |
|---|---|---|
| Combat / skills / bosses | Local implementation + automated tests | Actual touch feel, readability, balance |
| Six modes / Guided Story | Local game paths implemented | User feedback and full mode walkthrough |
| Home / results / Collection / settings | Local implementation; ko/en, BGM and pause/resume wired | Selected UX fixes after local app review |
| Progress / retention | Local save, medals, unlocks, weekly claim implemented | Real account/cloud integration |
| Cloud / product telemetry / entitlements / friends | Local contracts, Edge/SQL drafts | Native/auth/UI gaps and remote deployment remain |
| Ranked | Local practice + shared validation contracts | boss_shard server replay mismatch; public mode deferred |
| Sharing / code boundary | Adapter split and scanner repair complete; actual-source regression passed | Native/Toss device sharing verification |
| Platform / release | Host shells + Node 24/Deno/CI local checks ready; release deferred | Native services, Android toolchain, real device/store proof |

Historical Phase 0–8 entries below are not fresh verification claims. For current evidence see
`ai/reviews/review.md` and the 2026-09-19 session log.

## Non-Negotiable Rules

- Game field stays Canvas/WebGL, not DOM.
- Every skill must be Earth-linked.
- Solar Lance is judged on release; its later laser animation is visual only.
- Ranked mode has no ad revive.
- Ranking priority is survival time first, score second.
- Ranked difficulties stay separated.
- Master difficulty should make 60s survival rare.
- No item stat upgrades or pay-to-win power scaling.
- Balance values must move through JSON/Remote Config, not ad hoc literals.
- No public ranking copy before server-side validation is live.
- No public ranking/ad/IAP/cross-device release claim before server-side and
  platform evidence exists.
- Platform SDKs stay behind adapters.
- Public Supabase URL/anon key alone is not ranked readiness. Ranked Edge calls
  require `VITE_RANKED_EDGE_REMOTE_ENABLED=true`; public rows also require
  `VITE_PUBLIC_LEADERBOARD_ENABLED=true` plus identity-bound accepted rows.
- Telemetry endpoint URL plus remote-enable flag is configured-only state.
  `ready` requires explicit remote verification or a successful remote write.
- Current release target SSOT is `src/platform/ReleaseTarget.ts`: local web
  playable implementation, Google Play-first release prep, Apps in Toss
  compatibility, and no actual publishing without a separate Owner command.

## Phase 0 — SSOT And Common Contracts

Goal:
- Stop the roadmap from drifting. Define the contracts that six modes will share
  before adding more mode-specific code.

Completion Criteria:
- A future mode can be added by registering rules/data, not by hardcoding a new
  `GameScene` branch.

Checklist:
- [x] Resolve document conflicts and record decisions.
  - [x] Reconcile current Earth visual/gameplay size against `design-plan.md`,
    `design-system.md`, and current `coords.ts`.
  - [x] Reconcile 5-skill canonical list: Solar Lance, Orbital Cut, Gravity Slow,
    Delta Shield, Nova Pulse.
  - [x] Decide whether Solar Lance overrides directional enemies or respects
    directional accuracy.
  - [x] Mark outdated release-checklist verification numbers as stale or update
    them from latest evidence.
- [x] Define core mode contracts.
  - [x] `ModeId`: `story`, `freeDefense`, `ranked`, `bossRush`, `blitz60`,
    `daily`.
  - [x] `ModeDefinition`: label, description, availability, unlock state,
    default difficulty, UI theme token.
  - [x] `RunRules`: duration limit, win/loss condition, scoring priority,
    revive policy, skill availability, boss policy, special object policy.
  - [x] `SeedPolicy`: random, fixed pattern, daily fixed, weekly ranked, server
    assigned.
  - [x] `ObjectiveType`: survival, score, boss kill count, stage mission, daily
    modifier.
  - [x] `RevivePolicy`: none, ad revive, retry ticket, story retry.
- [x] Define mode-result contract.
  - [x] Common result fields.
  - [x] Mode-specific result fields.
  - [x] Ranking eligibility flag.
  - [x] Replay/retry destination.
- [x] Define config layering.
  - [x] Base data from JSON / RemoteConfig.
  - [x] Difficulty overlay.
  - [x] Mode overlay.
  - [x] Daily/event modifier overlay.
  - [x] Server-provided ranked config version.
- [x] Add tests for contract data validation once implemented.

## Phase 1 — Mode-Ready Combat Core

Goal:
- Convert the current single Rookie loop into a reusable engine that can run
  survival, timer, boss, stage, ranked, and daily variants.

Completion Criteria:
- The same combat engine can run an endless Free Defense run, a 60s timer run,
  a fixed-seed ranked run, and a boss-focused run without duplicating the scene.

Checklist:
- [x] Core PixiJS combat scene exists.
- [x] Deterministic `WaveGenerator` exists.
- [x] Pure collision/scoring logic exists.
- [x] Current run summary records score, kills, combo, skill use, seed, survival.
- [x] Replace hardcoded `DIFFICULTY = "rookie"` with run config.
- [x] Start `GameScene` from `RunConfig`.
- [x] Route wave duration, boss interval, enemy mix, skill costs, and HUD mode
  through config.
- [x] Add explicit run-end reasons.
  - [x] Earth destroyed.
  - [x] Timer expired.
  - [x] Stage objective complete.
  - [x] Boss sequence complete.
  - [x] Daily challenge failed.
- [x] Support timer-limited runs for 60s Blitz.
- [x] Support fixed-pattern stage runs for Story.
- [x] Support server-seeded ranked runs.
- [x] Support boss-sequence runs for Boss Rush.
- [x] Add tests for each run-end reason.
- [x] Add tests proving mode config changes behavior without editing
  `GameScene` internals.

## Phase 2 — Core Combat QA Closure

Goal:
- Close the current touch-feel and readability risks before expanding content.

Completion Criteria:
- The current core loop feels fair on a real device and its remaining risks are
  documented as tuning, not missing architecture.

Checklist:
- [ ] Real-device slash QA.
  - [ ] Live contact hit feels immediate.
  - [ ] Tap/tiny movement does not damage enemies.
  - [ ] Same-stroke re-entry damages after exit margin and cooldown.
  - [ ] Non-lethal hit shake reads clearly.
  - [ ] Combo timeout feels fair.
- [ ] Real-device skill QA.
  - [ ] Solar Lance charges naturally after cost 72.
  - [ ] Solar Lance fires from dense-wave strokes even after hitting enemies.
  - [ ] Solar Lance width feels powerful without erasing too much of the screen.
  - [ ] Gravity Slow triggers from intended closed circles.
  - [ ] Gravity Slow false positives stay rare.
- [ ] Real-device HUD QA.
  - [ ] Top-center time is readable.
  - [ ] Thick wave bar is readable.
  - [ ] Bottom Earth energy bar does not interfere with thumb input.
  - [ ] 5-slot HUD fits with browser/WebView chrome.
- [ ] Wave/boss feel QA.
  - [ ] 7-second waves feel energetic, not abrupt.
  - [ ] First boss at 60s is visible.
  - [ ] Boss warning is useful.
  - [ ] Boss HP 50 is not tedious.
  - [ ] Boss non-lethal hit feedback is obvious.
- [ ] Update `ai/reviews/review.md` after QA with pass/fail decisions.

## Phase 3 — Release Common Content Set

Goal:
- Implement the common gameplay ingredients needed by Story, Ranked, Boss Rush,
  60s Blitz, and Daily before mode-specific balancing.

Completion Criteria:
- Five skills, judgment objects, and boss contracts exist as reusable systems.

Checklist:
- [x] Solar Lance implemented.
- [x] Gravity Slow implemented.
- [x] Orbital Cut implementation.
  - [x] Gesture contract.
  - [x] Activation cost/cooldown.
  - [x] VFX.
  - [x] Hit rules.
  - [x] Tests.
- [x] Delta Shield implementation.
  - [x] Gesture or trigger contract.
  - [x] Shield timing.
  - [x] Damage prevention rules.
  - [x] HUD state.
  - [x] Tests.
- [x] Judgment / special objects.
  - [x] Friendly rescue object.
  - [x] Satellite object.
  - [x] Energy Capsule object.
  - [x] EMP Mine object.
  - [x] Movement scripts for friendly rescue and satellite objects.
  - [x] Friendly Fire / rescue failure feedback.
  - [x] Spawn rules per mode.
  - [x] Tests for each object.
- [x] Enemy set expansion.
  - [x] Attribute/elemental variants.
  - [x] Split / shield / black-hole-like variants.
  - [x] Mode-specific enemy mix overlays.
  - [x] Tests for wave selection and anti-streak rules.
- [x] Boss contract.
  - [x] Boss definition table.
  - [x] Boss weak-point model.
  - [x] Boss phase model.
  - [x] Boss phase-driven normal wave pressure hook.
  - [x] Boss attack/spawn pattern model.
  - [x] Boss result metrics.
  - [x] Tests for boss phase transitions.
- [x] Implement five bosses.
  - [x] Eclipse Core / first boss.
  - [x] Ringed Destroyer.
  - [x] Lava Titan.
  - [x] Ice Colossus.
  - [x] Dark Planet.

## Phase 4 — App Shell, Home, And Progression

Goal:
- Turn the playable scene into a product flow with home, mode selection,
  progress, result, and retry paths.

Completion Criteria:
- Players can launch the app, choose a mode, play, see results, and return
  without direct dev URLs or hidden state.

Checklist:
- [x] Add app state machine.
  - [x] Boot/loading.
  - [x] Home.
  - [x] Mode select.
- [x] Mode detail.
  - [x] Gameplay.
  - [x] Result.
  - [x] Ranking / records.
  - [x] Settings / collection placeholder.
- [x] Home screen.
  - [x] Orbit Slash title.
  - [x] Start CTA.
  - [x] Six mode cards in 3x2 grid.
  - [x] Settings and Collection entry points.
  - [x] Safe-area/mobile layout test.
- [x] Mode cards.
  - [x] Story Stage card.
  - [x] Free Defense card.
  - [x] Ranked League card.
  - [x] Boss Rush card.
  - [x] 60s Blitz card.
  - [x] Daily/Event card.
  - [x] Lock/coming-soon/progress states.
  - [x] i18n strings.
- [x] Result screen.
  - [x] Common stats.
  - [x] Mode-specific stats.
  - [x] Retry button.
  - [x] Home button.
  - [x] Ranking submission state.
- [x] Local progression storage.
  - [x] Story progress.
  - [x] Free Defense local best.
  - [x] Boss Rush best boss count.
  - [x] 60s best score.
  - [x] Daily completion marker.
  - [x] Storage adapter boundary.

## Phase 5 — Six Mode Implementation

Goal:
- Implement the six original release-product modes on top of the shared
  contracts and combat systems.

Completion Criteria:
- Each mode has a distinct start path, rule set, result path, QA checklist, and
  release eligibility state.

### Story Stage

- [x] Stage data model.
- [x] 8 chapters x 4 stages plan.
- [x] Stage objective types.
- [x] Stage content profiles for skill gates, object mix, boss pressure, spawn pressure, and enemy bias.
- [x] Fixed pattern stage seed support.
- [x] Unlock progression.
- [x] Tutorial messaging.
- [x] Chapter 1: First Impact.
- [x] Chapter 2: Orbital Defense.
- [x] Chapter 3: Friendly Signals.
- [x] Chapter 4: Element Storm.
- [x] Chapter 5: Precision Cut.
- [x] Chapter 6: Planet Threat.
- [x] Chapter 7: Gravity Crisis.
- [x] Chapter 8: Final Orbit.
- [x] Story result screen.
- [x] Story QA matrix.

### Free Defense

- [x] Difficulty selection.
- [x] Random seed policy.
- [x] Non-ranked local records.
- [x] Practice-friendly skill/boss options.
- [x] Ad revive policy: disabled/adapter-gated until rewarded-ad telemetry and platform adapter are ready.
- [x] Ad revive readiness gate separates local telemetry draft from remote enabled telemetry.
- [x] Daily free-play limit policy.
- [x] Daily limit locked UX with practice presets still startable.
- [x] Result screen.
- [x] Free Defense QA matrix.

### Ranked League

- [x] Difficulty tabs: Rookie, Defender, Elite, Master.
- [x] Server-assigned seed/run token.
- [x] Fixed daily/weekly seed policy.
- [x] No ad revive.
- [x] Retry ticket policy.
- [x] Survival-time-first scoring.
- [x] Server deterministic validation draft.
- [x] Local draft leaderboard submission path returns `submitted`, `failed`, and `localOnly` states through backend adapter and result UI boundaries.
- [ ] Remote verified leaderboard submission accepts identity-bound runs end-to-end and exposes public rows.
- [x] Ranked result screen.
- [x] Ranked submit outcome state can update result screen to submitted/failed.
- [x] Anti-cheat / config-version handling.
- [x] Ranked automated QA matrix.

### Boss Rush

- [x] Boss sequence data.
- [x] Boss-specific intro/result.
- [x] Boss weak-point tutorial flow.
- [x] Boss count + survival + energy + score result stats.
- [x] Boss Rush ranking eligibility.
- [x] Boss Rush QA matrix.

### 60s Blitz

- [x] Exact 60-second duration.
- [x] 0-10s basic band.
- [x] 10-20s fast band.
- [x] 20-30s satellite/capsule band.
- [x] 30-40s directional band.
- [x] 40-50s advanced band.
- [x] 50-60s mass wave + mini boss.
- [x] Daily fixed seed.
- [x] Score-first result screen.
- [x] Blitz automated QA matrix.

### Daily / Event Challenge

- [x] Daily challenge generator.
- [x] Modifier registry.
  - [x] No Skill Day.
  - [x] Last Save Day.
  - [x] Rescue Day.
  - [x] Boss Alert.
  - [x] Master Trial.
- [x] Modifier content profiles for skill locks, object mix, boss pressure, spawn pressure, and enemy bias.
- [x] Daily seed/rule date key.
- [x] Daily completion/reward state.
- [x] Event text and i18n.
- [x] Daily result screen.
- [x] Daily automated QA matrix.

## Phase 6 — Backend, Ranking, And Live Ops

Goal:
- Make public ranking, config updates, telemetry, and operating claims true.

Completion Criteria:
- Public ranked copy can be shown without lying about verification or fairness.

Checklist:
- [x] Backend adapter boundary exists.
- [x] Ranking strategy selected: hybrid, Supabase primary, Apps in Toss bridge-ready.
- [x] Dormant Supabase schema exists.
- [x] Remote dormant schema state reverified read-only: only runs/scores exist remotely; latest telemetry/rejection local migrations are not applied.
- [x] `beginRankedRun` server / Edge Function local draft.
- [x] `submitRankedRun` server / Edge Function local draft.
- [x] Deterministic server validation local draft.
- [x] Config version pinning local draft.
- [x] Weekly reset policy.
- [x] Monday 06:00 KST balance-window handling.
- [x] Server-side gameplay telemetry route.
- [x] Rewarded-ad platform/telemetry contract stub.
- [x] Rewarded-ad telemetry route local draft.
- [x] Rewarded-ad telemetry remote-enable gate.
- [ ] Apply/deploy rewarded-ad telemetry route remotely if ads are implemented.
- [x] Remote Config fetch and fallback.
- [x] Local anon/service-role boundary verification.
- [x] No raw Toss userKey storage.
- [x] Public leaderboard locked boundary UI.
- [x] Public leaderboard rows local/Edge contract.
- [ ] Public leaderboard live remote rows.
- [x] Admin/debug visibility for rejected runs.

## Phase 7 — Platform Release

Goal:
- Prepare Google Play-first release while preserving Apps in Toss compatibility.

Completion Criteria:
- Store release candidates can be evaluated against platform gates with current
  docs, real-device QA, and no misleading ranking/ad/IAP claims.

Checklist:
- [x] Update `ai/reviews/release-checklist.md` with latest verification.
- [x] Re-check Apps in Toss official docs.
- [x] Re-check Google Play game release requirements.
- [x] Confirm final release order: Google Play-first release prep, then Apps in
  Toss compatibility/release path; actual publishing still requires a separate
  Owner release command.
- [x] Define platform adapter interfaces and injected bridge shells.
- [ ] Implement and verify Google Play runtime bridge.
  - [ ] Credential/login.
  - [ ] AdMob.
  - [ ] Google Play Billing.
  - [ ] Haptics.
  - [ ] Persistent storage.
  - [ ] Analytics.
- [ ] Implement and verify Apps in Toss runtime bridge.
  - [ ] Toss login.
  - [ ] Apps in Toss ads.
  - [ ] Apps in Toss IAP.
  - [ ] Haptics.
  - [ ] Persistent storage.
  - [ ] Analytics and `runtime_channel`.
- [x] Content rating prep.
- [x] Data safety / privacy disclosure prep.
- [ ] Safe-area and WebView QA.
- [ ] Real-device performance QA.
- [x] Store listing copy.
- [x] No public claims for unimplemented ranking, ads, IAP, or cross-device
  persistence.

## Phase 8 — Release Candidate QA

Goal:
- Verify the full release product across modes, devices, and platform boundaries.

Completion Criteria:
- A release candidate has evidence for functionality, performance, fairness,
  privacy, and platform compliance.

Checklist:
- [x] All automated tests pass.
- [x] Build passes.
- [x] Release-boundary preflight passes.
- [x] Production debug-string scan passes.
- [x] Local mobile browser smoke passes.
- [x] Automated six-mode start smoke passes.
- [ ] Live deployed smoke passes after latest commit.
- [ ] Real-device touch QA passes.
- [ ] Mode matrix QA passes.
  - [ ] Story.
  - [ ] Free Defense.
  - [ ] Ranked.
  - [ ] Boss Rush.
  - [ ] 60s Blitz.
  - [ ] Daily/Event.
- [ ] Backend/ranking QA passes.
- [ ] Platform adapter QA passes.
- [x] Apps in Toss gate reviewed.
- [x] Google Play gate reviewed.
- [x] Release checklist updated with dates and evidence.

## Current Local Implementation Queue — 2026-09-19

Details and file/test scope: `ai/plans/implementation-plan.md` §0.

- [x] Reconcile existing implementation, unconnected features, and verification gaps in canonical docs.
- [x] Replace release-first work order with local implementation preparation.
- [ ] A: inspect the local app with Owner feedback; record concrete reproductions and priorities.
- [x] B: preserve baseline; split sharing SDK; repair scanner; run real-source regression, Edge type checks and local preflight.
- [x] Prepare Node 24/Deno and wire preflight into CI; GitHub run itself remains unverified until a future push.
- [ ] C: implement one selected gameplay/UI feedback slice; extract only touched responsibilities.
- [ ] D: align local ranked boss-shard contracts and prepare unconnected feature boundaries.
- [ ] Later: real identity/cloud/native services and remote verification, when requested.
- [ ] Later: Android JDK/SDK, store packaging and publishing, when requested.

Already implemented local slices: progression/reducer, mode/skill unlock, home/result flow,
Guided Story, audio/settings, grouped assets, pause/lifecycle, medals/Collection/Daily/weekly.
These are not to be reimplemented from the July task checklist.

## Completed Initial Implementation Queue

These were the original immediate prerequisites. They are kept here as evidence
that the early queue is closed, not as the current next-work list.

- [x] Phase 0 contract pass.
  - [x] Create `ModeId` / `ModeDefinition` / `RunRules` draft.
  - [x] Decide fifth skill / reserve slot policy.
  - [x] Decide Solar Lance directional override policy.
  - [x] Record Earth size SSOT decision.
- [x] Phase 1 engine pass.
  - [x] Replace hardcoded Rookie run with `RunConfig`.
  - [x] Add timer/end-condition contracts.
  - [x] Add seed policy contract.
- [x] Phase 4 shell pass.
  - [x] Add app state machine.
  - [x] Add six mode cards as locked/available states.
  - [x] Connect current combat loop to Free Defense first.

## Stale Data Guard

- Any verification count must include date and source command.
- Any live deploy smoke must state whether it happened after the latest local
  gameplay batch.
- `ai/reviews/release-checklist.md` is a gate snapshot, not the newest state
  unless it has been updated after the latest session log.
- `ai/reviews/review.md` remains the current QA/readiness backlog.
- This file is the roadmap checklist; it must point to evidence, not replace
  dated session logs.

## Historical July Review Summary

- Product roadmap review:
  - Current state is a six-mode local playable product shell on top of the
    original Pixi combat loop.
  - Release goal is six modes plus five skills, judgment objects, five bosses,
    ranking/live ops, and platform readiness.
  - Common contracts now exist; remaining work is mostly tuning, remote
    verification, platform QA, and final content/art.
- Current implementation review:
  - Core judgment, five skills, special objects, five boss contracts, Story
    8x4 plan, Daily modifiers, Boss Rush, Blitz, Free Defense, Ranked local
    boundary, app shell, progression, telemetry drafts, and adapter shells are
    locally implemented.
  - Public ranking, rewarded telemetry, gameplay telemetry, and platform
    runtime are still remote/app-store gated until actual Supabase Edge deploy,
    identity binding, and real-device/WebView evidence exist.
- Document audit:
  - `product-plan.md` is product scope SSOT.
  - `review.md` is closest to current QA/readiness SSOT.
  - Current `implementation-plan.md` §0 supersedes this historical summary; Phase 1 is Appendix A.
  - `release-checklist.md` is current for local checks but cannot be used as
    remote/store release evidence until the unchecked remote and device gates
    are closed.
