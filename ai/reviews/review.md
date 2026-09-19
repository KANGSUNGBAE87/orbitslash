---
version: 0.10
status: active
updated: 2026-09-19
canonical: true
---

# Orbit Slash — QA and Implementation Backlog

This is the canonical current QA/readiness backlog. It tracks deferred manual QA and the implementation queue after the current local gameplay changes.

## Change Log

- 2026-09-19 (codex): Completed the approved 0–1 cleanup; current evidence below replaces
  earlier failed checks. Sharing/cancellation, scanner, CI, toolchain and Edge types repaired.

- 2026-09-19 (codex): Reconciled current audit and Owner's local-implementation direction.
  Release execution is deferred; historical checkboxes below are not new runtime proof.

- 2026-06-28 (codex): Created backlog after combo timeout, same-stroke rehit, directional cut, destruction VFX, distance multiplier feedback, and Last Save feedback local implementation.
- 2026-06-28 (codex): Updated after wave shaping, low-frequency directional enemy, Gravity Slow, 5-slot HUD readiness, backend/ranking draft, release boundary scan, and platform notes. DEV-only QA harness remains deferred as QA work.
- 2026-06-28 (codex): Updated after Gravity Slow reserve fix, inactive HUD slot gauge fix, directional/heavy anti-streak, top HUD spawn safety, DEV QA presets, SVG enemy sprite pass, hybrid ranking decision, and dormant Supabase schema work. Current remote state must be reverified before release evidence use.
- 2026-06-28 (codex): Updated after 8-tier enemy data, 10-second wave gauge, 60-second fixed-speed boss scaffold, stronger Solar Lance, large top 5-slot HUD, and high-HP crack/hit overlay implementation.
- 2026-06-28 (codex): Updated after subagent review fixes for deterministic boss scheduling, large-enemy top-HUD spawn safety, i18n seconds labels, and explicit Solar Lance/HUD/boss tests.
- 2026-06-28 (codex): Updated after enemy asset pass, user-provided `eclipse_core` boss image integration, boss HP `50`, boss radius `340`, unique 9-enemy asset mapping, and type-colored crack/sparkle hit overlays.
- 2026-06-29 (codex): Updated after live slash kills now commit score/gauge immediately during continuous dragging, so Solar Lance can charge without waiting for pointer release.
- 2026-06-29 (codex): Updated after multitouch guard plus design-sample image extraction for Earth core/shield and all 8 normal enemy PNG sprites.
- 2026-06-29 (codex): Updated after enemy liveliness pass: self rotation, subtle breathing, comet trail/glow, travel-direction orientation, and stronger overlay-only non-lethal hit feedback.
- 2026-06-30 (codex): Updated after skill release hit-history fix: Solar Lance and Gravity Slow now judge the final gesture shape even if the stroke already hit enemies.
- 2026-06-30 (codex): Updated after HUD priority pass: time moved to top center, wave gauge thickened, Earth energy moved to thick bottom full-width bar, 7-second wave cadence applied, Solar Lance cost lowered to 72, and boss warning/remaining-hit HUD added.
- 2026-07-01 (codex): Updated after Phase 0-4 core implementation pass: mode contracts, `RunConfig`-driven `GameScene`, Orbital Cut, Delta Shield, special object contract, five boss definitions, app shell, and local progression storage.
- 2026-07-04 (codex): Updated after P0/P1/P2 implementation pass: special objects became protect/avoid judgment objects, Delta Shield persistent HUD was added, boss weak-point positional resolver and weak-point overlays were wired, 60s Blitz bands/Story 1-3/Daily modifier contracts were added, and ranked server-stub remains non-public.
- 2026-07-05 (codex): Updated after DEV QA recorder pass: all four human carryover QA scenarios now appear in the DEV QA screen, local PASS/PEND state is stored separately, DEV QA runs are marked `devQa`, progression writes are blocked for QA runs, and result screens label QA runs as `progress off`.
- 2026-07-05 (codex): Updated after Story/Daily objective runtime pass: `ModeObjectiveSystem` now evaluates Story 1-3, Daily no-skill/rescue/Last Save pass/fail conditions, GameScene tracks protected-object success/failure counters, and Daily can emit `daily_challenge_failed`.
- 2026-07-05 (codex): Updated after ranked server-boundary pass: `GameApp` now begins ranked runs through `BackendAdapter`, `GameScene` only honors server-verified starts for `rankingEligible`, ranked retry drops stale server config, public ranked validation checks token/expiry/seed/difficulty/stat sanity, and Supabase Edge Function/migration drafts were added locally.
- 2026-07-05 (codex): Updated after ranked semantic replay pass: `RunSession` records kill/combo-break/skill trace, enemies carry run-local `spawnOrdinal`, public ranked submit requires replay trace, `RankedReplayValidator` replays scoring summaries and boss-delayed spawn ordinals, and the Edge draft now replays semantic score summaries before inserting verified scores.
- 2026-07-05 (codex): Updated after ranked source/segment geometry pass: replay kill events now carry hit source and cloned segment data, and local/Edge validators check slash/Solar Lance/directional/boss weak-point geometry.
- 2026-07-05 (codex): Updated after ranked damage/HP progression pass: replay traces now include `hitEvents`, validators replay non-lethal HP damage history, and killEvents must match the HP-derived kill sequence.
- 2026-07-05 (codex): Updated after Threat/ModeResult/Story-Daily/Boss identity closure: periodic boss threat now advances from kills, combo, Last Save, and boss weak hits; Delta Shield knocks bosses back instead of instantly defeating them; Story expanded to 1-5; Daily expanded to five modifiers; `ModeResult` and `ProgressStore` now carry mode-specific result/progression metadata; HUD shows always-on Threat.
- 2026-07-05 (codex): Updated after Free Defense/Boss Rush mode-completion pass: Free Defense now has difficulty selection, standard/skill-practice/boss-practice presets, practice runs are non-progress, standard runs are gated by a daily free-play limit, mode cards render in a 3x2 grid, and Boss Rush detail/result surfaces emphasize sequence, weak points, local-unranked status, and best boss count.
- 2026-07-05 (codex): Updated after Story full-plan pass: Story now has 8 chapters x 4 stages, 32 fixed seeds, tutorial keys, stage objective params, Story stage launch option, seed mismatch fail-fast behavior, final-stage unlock cap, and Story detail preview for selected stage/tutorial/unlock summary.
- 2026-07-05 (codex): Updated after in-game tutorial pass: `GameApp` now forwards selected Story stage launch options, Story stages render live HUD tutorial callouts, Boss Rush renders active weak-point tutorial copy from boss phase state, and i18n parity tests cover Story/Boss tutorial keys.
- 2026-07-05 (codex): Updated after Boss Pattern Batch A micro-pass: blocked boss-body hits now show weak-point-only feedback, and Ringed Destroyer shard warnings render fan-shaped telegraph lanes before shard spawn.
- 2026-07-05 (codex): Updated after P0 AppShell contract cleanup: settings opens a locale switcher, static shell screens rebuild on locale change, records/results/collection use canonical mode/boss/daily labels, progress summaries are localized, and i18n parity now covers shell/progress/result keys.
- 2026-07-05 (codex): Updated after Phase 4 closure batch: AppState now starts at `boot`, moves through loading/ready, bootstrap mounts GameApp before remote/config asset preload so the loading shell can render, settings routes through AppState, and safe-area/root-fit tests cover shell controls and mobile viewport scaling.
- 2026-07-05 (codex): Updated after P0-A enemy pool/replay alignment: advanced enemy variants now have authored metadata/visuals/wave overlays, split/shield/armor/graviton runtime hooks exist, ranked traces record runtime spawn events and absorbed hits, local validator accepts split children and shield/armor honest traces, and ranked disables graviton pull until server replay can reproduce pull geometry.
- 2026-07-05 (codex): Updated after Boss Pattern Batch B: boss shard attacks now use active phase pattern profiles, Eclipse/Ringed/Lava/Ice/Dark bosses have themed attack spawn identities, phase changes emit one-shot `phase_action` bursts through replay-aware boss-shard spawning, telegraphs carry phase/pattern metadata, and Lava Titan body damage is locked behind core/heart weak points.
- 2026-07-05 (codex): Updated after Boss Practice / Ranked hardening pass: Free Defense Boss Practice can pin any release boss, DEV QA URL accepts `qaBoss`, Ranked detail exposes Rookie/Defender/Elite/Master tabs, ranked retry returns for a fresh token, ranked weekly seeds use KST Monday 06:00 windows, and local/Edge replay rejects invalid boss-shard type/time claims.
- 2026-07-05 (codex): Updated after revive/leaderboard boundary pass: Free Defense ad revive now renders as disabled/adapter-gated with no reward CTA, records expose a verified-leaderboard locked/live boundary state, backend adapters expose leaderboard status, and the local Edge draft rejects ranked score inserts without `core_user_id`.
- 2026-07-05 (codex): Updated after outcome/limit/ad-contract pass: ranked backend submit outcome can update result UI to `submitted`/`failed`, Free Defense standard 5/5 now shows explicit locked copy while practice remains startable, and rewarded-ad platform/backend contracts now separate capability, reward earned, dismissed, and telemetry-not-configured states.
- 2026-07-05 (codex): Updated after rewarded telemetry draft pass: local `orbitslash_rewarded_ad_events` migration, dedicated `orbitslash-rewarded-ad-telemetry` Edge Function draft, source guards for RLS/sensitive payload rejection, and Supabase adapter routing to the dedicated endpoint now exist. Remote apply/deploy is still pending.
- 2026-07-05 (codex): Updated after revive readiness gate pass: ad telemetry endpoint configuration no longer implies remote readiness, default Supabase adapters keep rewarded telemetry disabled until `VITE_REWARDED_AD_TELEMETRY_REMOTE_ENABLED=true`, and `GameApp` passes platform/backend readiness into Free Defense detail.
- 2026-07-05 (codex): Updated after release-prep / leaderboard rows pass: `preflight:release` now runs release-boundary plus both Edge bundle checks, and public leaderboard rows have a gated adapter/UI/Edge contract that stays disabled until `VITE_PUBLIC_LEADERBOARD_ENABLED=true` and identity-bound verified rows exist.
- 2026-07-05 (codex): Updated after boss readability / Remote Config / rejected-run debug pass: boss definitions now carry visual themes, active weak points render phase/zone-aware markers, boss shard telegraphs use per-boss colors, Dark Planet is weak-point-only to match false/true-core copy, Remote Config can fetch/fallback behind an explicit flag, and ranked rejected-run diagnostics have an admin-only Edge draft plus migration.
- 2026-07-05 (codex): Updated after gameplay telemetry / platform adapter pass: added dedicated gameplay telemetry migration and Edge draft with CORS, remote-enable gate, sensitive payload rejection, ranked run identity binding, raw identity release-boundary guard, and injected Apps in Toss / Google Play platform adapter shells for login, ads, IAP, haptics, storage, and analytics.
- 2026-07-05 (codex): Updated after release-claim guard pass: i18n copy, package metadata, Records live hints, and DEV QA labels now have automated checks against misleading global ranking, cross-device sync, live ad/IAP, and store-ready claims before remote/platform evidence exists.
- 2026-07-05 (codex): Updated after automated mode-matrix hardening pass: Story locked-stage/raw-id guards, ranked local-only result boundary, Blitz survived result semantics, Daily fail cases, failed Story/Daily non-progression, Boss Rush runtime sequence display, and result energy display are covered locally.
- 2026-07-05 (codex): Updated after result-title closure pass: result overlay titles now distinguish clear, survived, and game-over outcomes; Daily failed-protect/missing-Last-Save/Master-Trial edge cases are covered by tests; Phase 4 QA mode-flow wording now matches the detail-start UX.
- 2026-07-05 (codex): Updated after release-build polish: Vite chunk-size warning is cleared by raising the Pixi-game warning threshold to 600 kB without manual chunk cycles.
- 2026-07-05 (codex): Updated after local mode-detail guard pass: Story detail selected-stage/tutorial/unlock summary and Ringed Destroyer ring/body/core tutorial copy are covered by local automated tests; real-device readability checks remain open.
- 2026-07-05 (codex): Updated after blocked weak-point feedback hardening: weak-point-locked boss body hits now trigger a dedicated persistent callout with title/detail text, and local tests cover visibility, duration, and GameScene wiring.
- 2026-07-05 (codex): Updated after Story/Daily content-profile pass: Story and Daily active content profiles now affect skills, special objects, boss timing/type, spawn pressure, and enemy weight bias; disabled skills no longer fire from release gestures; directional wrong-angle rejects now show a distinct short burst.
- 2026-07-05 (codex): Updated after Last Save feedback pass: danger/Last Save hit feedback now separates radius, particles, ring width, label scale, and life duration more clearly while preserving score logic.
- 2026-07-05 (codex): Updated after boss phase pressure and special-object motion pass: active boss phases now feed conservative normal-wave pressure, friendly rescue objects drift toward Earth, and satellites orbit while capsules/mines remain static.
- 2026-07-05 (codex): Updated after release target SSOT / target-boundary pass: `ReleaseTarget.ts` now records local-web / Google Play-first / Apps in Toss-compatible target status, docs/package alignment is tested, and release preflight runs generic plus target-specific scans.
- 2026-07-05 (codex): Updated after product-plan release target addendum: `product-plan.md` now preserves the original Apps in Toss plan while explicitly pointing current execution to `ReleaseTarget.ts`.
- 2026-07-05 (codex): Updated after local-readiness closure pass: gameplay telemetry now flushes through `BackendAdapter.trackEvent`, collection UI reads stored boss/special/title progress, `PlatformAdapterFactory` injects web/Apps in Toss/Google Play adapters, ranked Edge requires `VITE_RANKED_EDGE_REMOTE_ENABLED=true`, telemetry `ready` requires remote write verification, and release preflight wording is local-only.
- 2026-07-05 (codex): Updated after verification reconciliation: boss asset preload tests now reject fallback URLs, release-boundary misleading-claim scans have direct typed coverage, and full local verification passed at 78 files / 487 tests.
- 2026-07-05 (codex): Updated after platform telemetry context pass: platform adapters now expose runtime context, GameScene gameplay telemetry carries web/Apps in Toss/Google Play runtime metadata, Apps in Toss private/live/sandbox channel detection is covered, and Google Play telemetry is allowed without Toss runtime_channel.
- 2026-07-05 (codex): Updated after read-only remote Supabase reverify: remote currently has only `orbitslash_runs` and `orbitslash_scores`, both RLS-on with no public policies or anon/authenticated grants; 2026-07-05 local tables/functions are not deployed remotely.
- 2026-07-05 (codex): Updated after local gap closure: Boss Weak DEV QA now uses deterministic `blockedBody`, ranked Graviton pull has a GameScene-level replay guard, special-object hit/reward labels are type-specific, HUD tutorial/blocked panel geometry has local guards, stale implementation-plan wording was cleaned, and full local verification passed at 78 files / 494 tests.
- 2026-07-06 (codex): Updated after release/deploy batch: commit `8821df6`
  was pushed to `main` and deployed by GitHub Pages run `28746871714`, Orbit
  Slash Supabase migrations/functions were applied to the shared project through
  targeted SQL statements and Edge deploys, service-role grants were added for
  server-only table writes, and remote smoke passed for anonymous ranked begin,
  rewarded telemetry, and gameplay telemetry. Public leaderboard and
  identity-bound ranked submit remain gated.

## Current State — 2026-09-19

Owner scope: prepare the next local implementation and open the app; no release needed now.
Current next-work scope is `ai/plans/implementation-plan.md` §0.

### Latest local verification — cleanup complete

- Node 24.21.0, Deno 2.9.7 installed; project launcher avoids changing global Hermes Node.
- Full suite: **136 files / 969 tests passed**; typecheck and production web build passed.
- Local preflight passed: generic/Google Play/Apps in Toss source boundaries, asset budget,
  both platform shells, generated ranked core, 7 Edge bundles and 7 frozen-lock Deno checks.
- Sharing SDK and deep-link handling live in the Toss adapter. Default app composition retains
  Toss → browser → clipboard fallback; AbortError cancellation stops and returns UI to idle.
- Scanner now checks module imports/re-exports/dynamic import/require, not account labels.
  `inviteCode` is limited to two reviewed transient sharing files; storage/log/transport sinks
  and all other raw-identity/secret rules remain blocked. This is a static guard, not complete taint analysis.
- CLI and unit/repository tests use the same rules. Deno dependencies are locked; CI reads
  Node/Deno version files and runs preflight before uploading. PRs never upload/deploy Pages.
- CI YAML parsed locally; no GitHub run was triggered. Android tooling/device QA remain pending.
- Earlier read-only remote evidence from this conversation: 3 existing Edge functions and 5
  RLS-on app tables. New progress/product/entitlement/friend services remain undeployed.
- Pages remains the July 6 KST `e168118` version. Current local work was not published.
- Local Node 24 dev server/home startup confirmed at `http://127.0.0.1:5173/`. No save reset.
  This is local web/web_stub evidence, not native/Toss or full six-mode QA.
- Details: `local-baseline.md`, `../session-logs/2026-09-19-local-prep-cleanup-codex.md`.

### Current implementation backlog

| Priority | Finding | Next action / acceptance |
|---|---|---|
| A | User has not reviewed the latest local app in this continuation | Open local app; collect concrete gameplay/UI feedback |
| B complete | Share SDK boundary and cancellation | Automated regression passed; real native/Toss share remains device QA |
| B complete | Scanner label false positive, rule duplication, missing repo checks | Actual sources and CLI tests passed; preserve security guard tests |
| C | GameScene/AppShell concentrate many responsibilities | Extract only the responsibility touched by the next requested feature; preserve behavior |
| D | Ranked runtime emits boss_shard while newest Edge validator rejects it | Reproduce legitimate trace then add deterministic server replay and tamper tests before public ranking |
| D | Cosmetic/entitlement/friend modules do not form complete user flows | Mark missing UI/auth/runtime connections explicitly before implementing a selected flow |
| D | AI UX disabled documented, but dedicated AI service/proxy stub absent | Record as future boundary implementation, not completed readiness |

### Follow-up work, not current local prerequisites

Actual provider login, cloud deployment, monetization, JDK/Android SDK setup,
store packaging and release QA remain deferred. Node/Deno and CI preflight are prepared locally. Gameplay/UX work need not wait on those services.

The QA and implementation checklists below retain historical evidence from June/July. Their
unchecked boxes must be reconciled with the current table before assigning work; they are not an
instruction to reimplement completed tutorial, BGM, settings, or retention work.

## QA Backlog

### P0 — Real Device Touch Feel

- [ ] General slash: immediate contact hit should feel instant while dragging.
- [ ] Live slash reward feel: Solar Lance gauge should rise during a continuous drag as soon as enemies die.
- [ ] Heavy asteroid re-entry: same stroke should damage once on entry, wait until exit margin, then damage again on re-entry.
- [ ] Heavy asteroid non-lethal hit: shake should be obvious enough that "hit but HP remains" is understood.
- [ ] Combo timeout `650ms`: long drag should not keep combo alive forever, but natural quick chains should still feel rewarding.
- [ ] Gravity Slow first-try success: closed circle should trigger at least 8/10 attempts on phone.
- [ ] Gravity Slow false positives: half-circle/open spiral should trigger at most 1/10 attempts.
- [ ] Normal slash vs short tap: tap or tiny movement should not accidentally damage enemies.
- [ ] 8-tier pacing: HP `1/3/5/7/9/11/13/15` should feel like depth, not drag.
- [ ] High-HP crack overlay should make non-lethal hits legible on phone.

### P0 — Directional Cut Feel

- [ ] Directional guide line on `directional_comet` should be visible on phone without hiding the enemy.
- [ ] Required slash direction should feel learnable and fair while the enemy orbits.
- [ ] Wrong-direction reject burst should read as "wrong angle", not as a successful hit.
- [x] Local automated guard: wrong-direction rejects spawn a distinct `directional.wrongAngle` short burst and do not damage or score the enemy.
- [ ] Wrong-direction reject should not feel too punishing when it also breaks combo on an otherwise empty stroke.
- [ ] Solar Lance directional behavior: confirm whether directional enemies should reject wrong-angle Solar Lance or whether Solar Lance should be a special override.

### P0 — Last Save and Distance Feedback

- [ ] Last Save: visual should feel like "barely saved Earth", not only extra score.
- [ ] Last Save: Earth-centered pulse should be strong but should not cover the next threat.
- [ ] Distance multiplier labels should be readable during motion.
- [ ] Danger/Last Save band rewards should feel clearly stronger than outer/mid kills.
- [ ] Last Save should be testable naturally and with DEV `?qaPreset=lastSave`.

### P0 — Solar Lance QA

- [ ] Public production build: charge gauge naturally and trigger Solar Lance on live GitHub Pages.
- [x] Local DEV build: verify `?qaGauge=100` still helps QA without affecting production.
- [ ] Solar Lance long line should fire only on intended straight/earth-linked gesture.
- [ ] Solar Lance should not be stolen by normal live slash hits while charging the gesture.
- [ ] Solar Lance widened effect should feel powerful without deleting too much of the screen.
- [ ] Solar Lance should remain readable with 260px-class beam VFX.

### P0 — Wave and Boss Feel

- [ ] 7-second wave gauge should be readable and not distract from enemy motion.
- [ ] Wave boundary every 7 seconds should feel like progression, not abrupt difficulty spikes.
- [ ] Advanced variants: fire/ice/crystal/shield/electric/graviton/dark/armored enemies should read as distinct threats on phone.
- [ ] Ice split: killing `ice_comet` should clearly spawn shard fragments without feeling unfair.
- [ ] Shield/armor: absorbed hits should visibly register as shield/armor damage, not as missed input.
- [ ] Graviton pull: non-ranked pull acceleration should feel readable; ranked currently gates pull off for replay safety.
- [x] Local automated guard: ranked `GameScene` movement keeps Graviton pull disabled while non-ranked movement still applies pull acceleration.
- [x] Boss should appear every 60 seconds at fixed speed.
- [x] Boss arrival should not stop normal small planets from spawning.
- [ ] First boss HP 50 should feel boss-like but not tedious.
- [ ] Boss image should read as a boss immediately and not blend into normal large planets.
- [ ] Boss non-lethal hits should feel clearly registered despite the long 50-hit scaffold.
- [ ] Boss phase-driven normal wave pressure should feel energetic without overloading Boss Rush or dense Daily runs.
- [ ] Verify boss warning and remaining-hit HUD on real device before treating the 50-hit boss as final-feel ready.
- [x] Verify Ringed Destroyer shard telegraph lanes point in the expected fan direction before shards spawn.

### P1 — Visual Noise and Performance

- [ ] Destruction VFX should not clutter the playfield when multiple enemies die together.
- [ ] Last Save + multi-cut + destruction should not stack into unreadable noise.
- [ ] Reject burst should be visually weaker than success burst.
- [ ] Mobile WebView performance should stay smooth during dense particle bursts.
- [ ] Top HUD area: enemies should not become unreadable behind score/cooldown UI.
- [ ] Confirm top-HUD safe spawn adjustment does not make enemy entry feel artificially constrained.
- [ ] Large 5-slot HUD should fit on real mobile browser/WebView with status/address bars.
- [ ] Bottom full-width Earth energy bar should remain readable without covering thumb input flow.
- [ ] Moving rescue/satellite objects should read as protect/avoid targets, not as enemy planets.

### P1 — Earth and Impact Feel

- [ ] Huge enemies should not visually overlap Earth too much before impact damage.
- [ ] Earth impact radius should still feel centered and fair after large enemy visual radius changes.
- [ ] Earth body size should remain slightly larger than early version, but not dominate the play area.

## Mode QA Matrix

### Story

- [ ] Verify Story detail shows 8 chapters, 32 stages, selected stage, tutorial preview, and unlock summary on phone.
- [x] Local automated guard: Story detail shows 8 chapters, 32 stages, selected stage, tutorial preview, unlock summary, and no raw stage id leak.
- [x] Local mobile-browser smoke: Story detail at 390x844 shows the selected stage, tutorial preview, unlock summary, stage buttons, start CTA, and no console warnings/errors after the layout spacing fix.
- [x] Verify Story stage selection starts the selected fixed seed and retry preserves the same stage.
- [x] Verify clearing a stage unlocks only the next valid stage.
- [x] Verify clearing `story-32` does not unlock invalid stage `33`.
- [x] Verify unknown Story seeds fail fast instead of evaluating `story-1`.
- [x] Verify Story result/records show localized stage labels instead of raw ids.
- [ ] Verify live Story tutorial callouts are readable and do not hide touch targets on phone.
- [x] Local mobile-browser smoke: Story gameplay tutorial callout is visible at 390x844, stays below the playfield/top HUD, and reports no console warnings/errors.
- [x] Decide later whether Story needs a modal pause/dismiss tutorial; current implementation is non-modal for the release slice, modal tutorial is a later UX option.

### Free Defense

- [ ] Verify Rookie/Defender/Elite/Master selection changes early density and boss pressure feel.
- [x] Verify Standard preset writes local records and increments today's free-play count.
- [x] Verify Skill Practice gives more supply objects and does not write progression.
- [x] Verify Boss Practice brings the first boss faster and does not write progression.
- [x] Verify today's free-play limit blocks standard starts but still allows practice presets.
- [x] Verify ad revive remains blocked until rewarded-ad telemetry and platform adapter work are ready in local automated tests.

### Boss Rush

- [x] Verify mode detail shows the full five-boss sequence and weak-point hint before start.
- [x] Verify Boss Rush starts with Ringed Destroyer and then advances through the sequence.
- [x] Verify results show boss count, defeated list, survival, energy, score, and local-unranked state.
- [x] Verify local records prioritize best defeated boss count.
- [ ] Verify Boss Rush weak-point tutorial callouts match ring/body/core phase transitions on phone.
- [x] Local automated guard: Boss Rush tutorial state maps Ringed Destroyer ring/body/core phases to localized objective copy.
- [x] Local mobile-browser smoke: Boss Rush QA preset at 390x844 shows the weak-point tutorial callout and boss overlay with no console warnings/errors.
- [x] Local automated guard: weak-point-locked wrong body hits call the dedicated blocked callout, and the HUD callout remains readable beyond the generic flash duration.
- [ ] Verify wrong body hits on weak-point-locked bosses clearly read as blocked, not as missed input on real device/WebView. Browser automation attempted this path, but canvas drag injection did not produce a clear wrong-body-hit capture.

## Implementation Backlog

### 1. Directional Enemy Frequency Tuning

Goal:
- Keep directional cut as a skill-testing mechanic without making every fast enemy feel annoying.

Recommended implementation:
- [x] Add a dedicated `directional_comet` enemy type and keep `fast_comet` normal.
- [x] Make directional enemies absent in the opening band and low-frequency in later waves.
- [x] Add tests for weighted enemy selection / deterministic seeded spawn.
- [x] Add anti-streak protection for directional/heavy enemies.
- [ ] Real-device QA: confirm directional enemy frequency feels fair.

Why first:
- Directional cut is the newest mechanic and has the highest chance of changing moment-to-moment difficulty.

### 2. Wave and Difficulty Shaping

Goal:
- Tune the new larger hitboxes, re-entry damage, combo timeout, VFX, and directional enemies into a stable first-release feel.

Tasks:
- [x] Add wave composition rules instead of uniform enemy selection.
- [x] Add 7-second wave bands for enemy mix and speed shaping.
- [x] Lower heavy density early via wave bands.
- [x] Add top HUD spawn exclusion / safe start-angle rule.
- [x] Add deterministic DEV presets for common QA waves.
- [x] Add wave HUD state/progress for 7-second waves.
- [x] Lower Solar Lance gauge cost from 80 to 72 for earlier first-use timing.

### 3. DEV-only QA Harness

Goal:
- Make hard-to-reproduce feel checks fast without leaking debug controls into production.

Tasks:
- [x] Add deterministic near-Earth Last Save preset in DEV only.
- [x] Add deterministic directional enemy preset in DEV only.
- [x] Add dense enemy mix preset in DEV only.
- [x] Add direct QA mode entry and DEV QA launcher for `Touch/HUD`, `Boss Weak`, `Special`, and `Blitz`.
- [x] Add local PASS/PEND recorder for remaining real-device carryover QA.
- [x] Prevent DEV QA runs from writing progression/unlocks/collection.
- [x] Mark DEV QA result screens as `progress off`.
- [x] Add production bundle string check proving `qaMode`, `qaPreset`, and `qaGauge` are not present in `dist`.
- [x] Add browser automation smoke for the QA recorder after installing the matching Playwright Chromium build.

### 4. Skill System Expansion Toward 5 Slots

Goal:
- Move from current Solar Lance-first implementation toward the planned multi-skill HUD and gameplay.

Tasks:
- [x] Keep cooldown display in the top strip with 5 compact slots.
- [x] Replace compact strip with large top 5-slot HUD.
- [x] Implement next skill candidate `gravity_slow`.
- [x] Add input gesture, cooldown, gauge cost, VFX, tests, and HUD state for `gravity_slow`.
- [x] Fix Gravity Slow live reserve so open spiral-like gestures do not steal normal slash.
- [x] Hide gauge progress on inactive future HUD slots.
- [x] Promote Nova Pulse as the canonical 5th release skill.
- [x] Decide canonical release skill list: Solar Lance, Orbital Cut, Gravity Slow, Delta Shield, Nova Pulse.

### 5. Asset Replacement Pass

Goal:
- Replace placeholder circles after gameplay readability is stable.

Tasks:
- [x] Centralize procedural enemy drawing in `EnemyVisual` so asset replacement has one boundary.
- [x] Replace meteor/comet/asteroid placeholders with SVG sprite assets.
- [x] Add unique asset mapping for all 8 normal enemy tiers and the first boss.
- [x] Integrate user-provided first boss image as `eclipse_core`.
- [x] Add generated SVG assets for `shard_meteor`, `iron_planet`, and `ancient_planet`.
- [x] Add type-colored crack/sparkle overlay tokens for stronger hit readability.
- [x] Keep `enemy.radiusPx` as slash hit bounds while sprites scale to that radius.
- [x] Keep directional guide overlay readable on final assets.
- [x] Add visual-only enemy motion layers: self rotation, subtle breathing, comet travel trail/glow, and hit overlay sparks.
- [ ] Re-test visual size and hit feel after asset swap.

### 6. Result, Ranking, and Backend Readiness

Goal:
- Prepare release-product loops after core game feel is stable.

Tasks:
- [x] Add run summary detail for score, max combo, Last Save count, Solar Lance count, Gravity Slow count, kills, energy, seed, and survival time.
- [x] Keep ranking/server validation boundary ready through `RunSession`, `BackendAdapter`, `RankingSystem`, and `Telemetry` stubs.
- [x] Draft Supabase tables and server verification notes before public ranking writes.
- [x] Keep Apps in Toss and Google Play adapters separate from product logic via release-boundary scan.
- [x] Public ranking strategy selected: hybrid, Supabase verified ranking primary, Apps in Toss leaderboard bridge-ready.
- [x] Dormant Supabase schema and RLS/service-role separation contract exists in local SQL/historical notes.
- [x] Reverify current remote dormant Supabase schema/RLS state before using it as release evidence: current remote has only `orbitslash_runs` and `orbitslash_scores`; latest local telemetry/rejection tables are not applied.
- [x] Implement local Edge/server ranked run validation before public ranking copy or UI.
- [x] Add local ranked semantic replay validation.
- [x] Add local and Edge source/segment geometry validation for slash, Solar Lance, directional, and boss weak-point hit claims.
- [x] Add local and Edge damage/HP progression replay before accepting killEvents.
- [ ] Remote apply/deploy ranked Edge Function.
- [x] Local Edge draft rejects ranked score inserts when `core_user_id` is missing.
- [ ] Verify remote ranked runs/scores bind to internal `core_user_id` before public leaderboard launch.
- [x] Verify public leaderboard row UI remains hidden until explicit public flag plus identity-bound verified rows.
- [x] Add server-side gameplay telemetry route local draft behind explicit remote-enable flag and connect local gameplay flushes through `BackendAdapter.trackEvent`.
- [x] Confirm raw Toss userKey / raw platform identity fields are blocked from client release boundary and Edge payloads.

### 7. Platform and Release Readiness

Goal:
- Turn the playable build into a release candidate.

Tasks:
- [x] Add local release checklist and release-boundary preflight.
- [x] Add injected Apps in Toss / Google Play adapter shells for login, ads, IAP, haptics, storage, and analytics.
- [x] Apps in Toss pre-release gate with official-doc re-check.
- [x] Google Play-first game release prep draft for rating/classification, data safety, target audience, and store-copy positioning.
- [ ] Real-device browser/WebView QA.
- [ ] Touch latency/performance check.
- [x] Privacy/data safety and platform adapter draft review.

### 8. Boss Scaffold

Goal:
- Add a first procedural boss loop before final boss assets and weak-point systems.

Tasks:
- [x] Add `eclipse_core` boss enemy data.
- [x] Spawn boss every 60 seconds independently from normal waves.
- [x] Keep normal planet spawning while boss is present.
- [x] Keep boss speed fixed outside wave speed scaling.
- [x] Add tests for boss schedule and speed.
- [x] Retune first boss scaffold to `hp=50`, `radiusPx=340`, and user-provided image.
- [x] Add boss arrival warning/banner.
- [x] Add boss HP bar or remaining-hit indicator.
- [x] Add real boss weak points / multi-part boss behavior.
- [x] Add phase-aware weak-point/pattern readability art layer.
- [ ] Replace final boss bitmap/VFX assets when the final art set is provided or approved.

## Recommended Next Implementation

1. Open the current local app and record Owner feedback as reproducible behavior.
2. Sharing/scanner/toolchain cleanup is complete; do not repeat it.
3. Implement the highest-priority gameplay/UI feedback slice; avoid broad rewrites.
4. Prepare local ranked/feature contracts as needed by the selected next feature.

Reference: `ai/plans/implementation-plan.md` §0. Actual cloud/native integration and release
remain follow-up work. Automated local preflight passing is not release approval.
