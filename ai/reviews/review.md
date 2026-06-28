---
version: 0.1
status: active
updated: 2026-06-28
canonical: true
---

# Orbit Slash — QA and Implementation Backlog

This is the canonical current QA/readiness backlog. It tracks deferred manual QA and the implementation queue after the current local gameplay changes.

## Change Log

- 2026-06-28 (codex): Created backlog after combo timeout, same-stroke rehit, directional cut, destruction VFX, distance multiplier feedback, and Last Save feedback local implementation.
- 2026-06-28 (codex): Updated after wave shaping, low-frequency directional enemy, Gravity Slow, 5-slot HUD readiness, backend/ranking draft, release boundary scan, and platform notes. DEV-only QA harness remains deferred as QA work.
- 2026-06-28 (codex): Updated after Gravity Slow reserve fix, inactive HUD slot gauge fix, directional/heavy anti-streak, top HUD spawn safety, DEV QA presets, SVG enemy sprite pass, hybrid ranking decision, and remote dormant Supabase schema apply.

## Current State

- Local implementation is ahead of `origin/main`.
- Latest local changes were committed and deployed to GitHub Pages.
- Automated verification passed for the latest local state:
  - `npm test`: 28 files / 154 tests passed.
  - `npm run typecheck`: passed.
  - `npm run build`: passed.
  - `npm run preflight:release-boundary`: passed.
  - Production bundle string check: no `qaPreset` / `qaGauge` strings found in `dist`.
  - Local Chrome mobile smoke: canvas loaded at `412x915` CSS / `824x1830` backing pixels, all five enemy SVG assets returned 200, no console/page errors.
  - GitHub Pages live smoke: canvas loaded at `412x915` CSS / `824x1830` backing pixels, enemy SVG asset returned 200, no console/page errors.
- DEV-only QA presets are available for local device checks:
  - `?qaPreset=directional&qaGauge=100`
  - `?qaPreset=lastSave&qaGauge=100`
  - `?qaPreset=dense&qaGauge=100`

## QA Backlog

### P0 — Real Device Touch Feel

- [ ] General slash: immediate contact hit should feel instant while dragging.
- [ ] Heavy asteroid re-entry: same stroke should damage once on entry, wait until exit margin, then damage again on re-entry.
- [ ] Heavy asteroid non-lethal hit: shake should be obvious enough that "hit but HP remains" is understood.
- [ ] Combo timeout `650ms`: long drag should not keep combo alive forever, but natural quick chains should still feel rewarding.
- [ ] Gravity Slow first-try success: closed circle should trigger at least 8/10 attempts on phone.
- [ ] Gravity Slow false positives: half-circle/open spiral should trigger at most 1/10 attempts.
- [ ] Normal slash vs short tap: tap or tiny movement should not accidentally damage enemies.

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

### P1 — Visual Noise and Performance

- [ ] Destruction VFX should not clutter the playfield when multiple enemies die together.
- [ ] Last Save + multi-cut + destruction should not stack into unreadable noise.
- [ ] Reject burst should be visually weaker than success burst.
- [ ] Mobile WebView performance should stay smooth during dense particle bursts.
- [ ] Top HUD area: enemies should not become unreadable behind score/cooldown UI.
- [ ] Confirm top-HUD safe spawn adjustment does not make enemy entry feel artificially constrained.

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
- [x] Add early/mid/late elapsed-time bands for enemy mix.
- [x] Lower heavy density early via wave bands.
- [x] Add top HUD spawn exclusion / safe start-angle rule.
- [x] Add deterministic DEV presets for common QA waves.

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

## Recommended Next Implementation

Start with **real-device product QA + server ranking implementation**, not more client feature work.

Default recommendation:
- Run one physical-device pass against the latest local build or next deployment.
- If feel is acceptable, tune wave weights and then choose the ranking strategy.

Reason:
- The implementation queue is now mostly in place; the highest risk is touch feel, readability, and platform release assumptions.
