---
version: 0.1
status: active
updated: 2026-06-29
canonical: true
---

# Orbit Slash — QA and Implementation Backlog

This is the canonical current QA/readiness backlog. It tracks deferred manual QA and the implementation queue after the current local gameplay changes.

## Change Log

- 2026-06-28 (codex): Created backlog after combo timeout, same-stroke rehit, directional cut, destruction VFX, distance multiplier feedback, and Last Save feedback local implementation.
- 2026-06-28 (codex): Updated after wave shaping, low-frequency directional enemy, Gravity Slow, 5-slot HUD readiness, backend/ranking draft, release boundary scan, and platform notes. DEV-only QA harness remains deferred as QA work.
- 2026-06-28 (codex): Updated after Gravity Slow reserve fix, inactive HUD slot gauge fix, directional/heavy anti-streak, top HUD spawn safety, DEV QA presets, SVG enemy sprite pass, hybrid ranking decision, and remote dormant Supabase schema apply.
- 2026-06-28 (codex): Updated after 8-tier enemy data, 10-second wave gauge, 60-second fixed-speed boss scaffold, stronger Solar Lance, large top 5-slot HUD, and high-HP crack/hit overlay implementation.
- 2026-06-28 (codex): Updated after subagent review fixes for deterministic boss scheduling, large-enemy top-HUD spawn safety, i18n seconds labels, and explicit Solar Lance/HUD/boss tests.
- 2026-06-28 (codex): Updated after enemy asset pass, user-provided `eclipse_core` boss image integration, boss HP `50`, boss radius `340`, unique 9-enemy asset mapping, and type-colored crack/sparkle hit overlays.
- 2026-06-29 (codex): Updated after live slash kills now commit score/gauge immediately during continuous dragging, so Solar Lance can charge without waiting for pointer release.

## Current State

- Latest gameplay batch includes 8-tier assets, `hp=50` boss scaffold, large 5-slot HUD, and live slash immediate kill rewards.
- Automated verification passed for the latest local state:
  - `npm test`: 32 files / 169 tests passed.
  - `npm run build`: passed.
  - `npm run preflight:release-boundary`: passed.
  - Production bundle string check: no `qaPreset` / `qaGauge` strings found in `dist`.
  - Local Chrome mobile smoke: not rerun after this latest gameplay batch.
  - GitHub Pages live smoke: not rerun after this latest gameplay batch.
- DEV-only QA presets are available for local device checks:
  - `?qaPreset=directional&qaGauge=100`
  - `?qaPreset=lastSave&qaGauge=100`
  - `?qaPreset=dense&qaGauge=100`

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
- [ ] Local DEV build: verify `?qaGauge=100` still helps QA without affecting production.
- [ ] Solar Lance long line should fire only on intended straight/earth-linked gesture.
- [ ] Solar Lance should not be stolen by normal live slash hits while charging the gesture.
- [ ] Solar Lance widened effect should feel powerful without deleting too much of the screen.
- [ ] Solar Lance should remain readable with 260px-class beam VFX.

### P0 — Wave and Boss Feel

- [ ] 10-second wave gauge should be readable and not distract from enemy motion.
- [ ] Wave boundary every 10 seconds should feel like progression, not abrupt difficulty spikes.
- [ ] Boss should appear every 60 seconds at fixed speed.
- [ ] Boss arrival should not stop normal small planets from spawning.
- [ ] First boss HP 50 should feel boss-like but not tedious.
- [ ] Boss image should read as a boss immediately and not blend into normal large planets.
- [ ] Boss non-lethal hits should feel clearly registered despite the long 50-hit scaffold.
- [ ] Add/verify boss HP bar or remaining-hit indicator before treating the 50-hit boss as final-feel ready.

### P1 — Visual Noise and Performance

- [ ] Destruction VFX should not clutter the playfield when multiple enemies die together.
- [ ] Last Save + multi-cut + destruction should not stack into unreadable noise.
- [ ] Reject burst should be visually weaker than success burst.
- [ ] Mobile WebView performance should stay smooth during dense particle bursts.
- [ ] Top HUD area: enemies should not become unreadable behind score/cooldown UI.
- [ ] Confirm top-HUD safe spawn adjustment does not make enemy entry feel artificially constrained.
- [ ] Large 5-slot HUD should fit on real mobile browser/WebView with status/address bars.

### P1 — Earth and Impact Feel

- [ ] Huge enemies should not visually overlap Earth too much before impact damage.
- [ ] Earth impact radius should still feel centered and fair after large enemy visual radius changes.
- [ ] Earth body size should remain slightly larger than early version, but not dominate the play area.

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
- [x] Add 10-second wave bands for enemy mix and speed shaping.
- [x] Lower heavy density early via wave bands.
- [x] Add top HUD spawn exclusion / safe start-angle rule.
- [x] Add deterministic DEV presets for common QA waves.
- [x] Add wave HUD state/progress for 10-second waves.

### 3. DEV-only QA Harness

Goal:
- Make hard-to-reproduce feel checks fast without leaking debug controls into production.

Tasks:
- [x] Add deterministic near-Earth Last Save preset in DEV only.
- [x] Add deterministic directional enemy preset in DEV only.
- [x] Add dense enemy mix preset in DEV only.
- [ ] Add production build string/behavior check proving QA params are ignored outside DEV.

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
- [x] Keep a 5th `reserve_slot` placeholder instead of inventing an unapproved skill.
- [ ] Decide canonical final 5-skill list.

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
- [x] Remote dormant Supabase schema applied and hardened.
- [ ] Implement Edge/server ranked run validation before public ranking copy or UI.

### 7. Platform and Release Readiness

Goal:
- Turn the playable build into a release candidate.

Tasks:
- [x] Add local release checklist and release-boundary preflight.
- [ ] Apps in Toss pre-release gate with official-doc re-check.
- [ ] Google Play-first game release prep if rating/classification requires it.
- [ ] Real-device browser/WebView QA.
- [ ] Touch latency/performance check.
- [ ] Privacy/data safety and platform adapter review.

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
- [ ] Add boss arrival warning/banner.
- [ ] Add boss HP bar or remaining-hit indicator.
- [ ] Add real boss weak points / multi-part boss behavior.
- [ ] Add final boss weak-point/pattern art assets.

## Recommended Next Implementation

Start with **real-device gameplay QA on the new local build**, then tune values before server/ranking work.

Default recommendation:
- Run one physical-device pass against the latest local build.
- Focus on new enemy image readability, `hp=50/radius=340` boss feel, boss non-lethal hit feedback, 10-second wave gauge, Solar Lance access, and large top 5-slot HUD.
- Next implementation should add boss arrival warning + boss HP/remaining-hit UI, then proceed to 7-second wave/Solar Lance charge tuning.

Reason:
- The implementation queue is now mostly in place; the highest risk is touch feel, readability, and platform release assumptions.
