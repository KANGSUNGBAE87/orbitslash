---
date: 2026-06-30
actor: codex
topic: skill-release-hit-history
---

# Skill Release Hit-History Fix

Actor: codex

## User Request

Apply the rule: skill activation should depend on whether the final gesture shape satisfies the skill condition, not on whether the stroke already cut an enemy.

## Root Cause

`GameScene.resolveInput` only called `trySolarLance` / `tryGravitySlow` when `strokeHadHit` was false. The live reserve helpers also rejected skill reservation when `strokeHadHit` was true.

In dense waves, a stroke almost always touches an enemy before the final gesture is complete. That made Solar Lance and Gravity Slow appear broken.

## Changes

- `src/game/GameScene.ts`
  - Removed `!this.strokeHadHit` gating from release-time Solar Lance and Gravity Slow checks.
- `src/game/SolarLanceReserve.ts`
  - Removed `strokeHadHit` from reserve options and reserve criteria.
- `src/game/GravitySlowReserve.ts`
  - Removed `strokeHadHit` from reserve options and reserve criteria.
- `src/game/GameSceneSkillRelease.test.ts`
  - Added regression tests proving Solar Lance and Gravity Slow are attempted even when `strokeHadHit` is already true.
- `src/game/SolarLanceReserve.test.ts`
  - Updated reserve tests around final line shape criteria.
- `src/game/GravitySlowReserve.test.ts`
  - Updated reserve tests around gauge and final circle criteria.
- `ai/reviews/review.md`
  - Updated current verification and backlog state.

## Verification

RED:
- `npm test -- src/game/SolarLanceReserve.test.ts src/game/GravitySlowReserve.test.ts src/game/GameSceneSkillRelease.test.ts`
- Failed because reserve returned false with `strokeHadHit=true` and `trySolarLance` / `tryGravitySlow` were not called.

GREEN:
- Targeted tests: 3 files / 7 tests passed.
- `npm test`: 36 files / 180 tests passed.
- `npm run build`: passed.
- `npm run preflight:release-boundary`: passed.
- Local dev server smoke: `http://127.0.0.1:5182/?seed=1234&qaPreset=dense&qaGauge=100` returned HTTP 200.

## Remaining QA

- Real-device check: draw Solar Lance through dense enemies and confirm it still fires on release.
- Real-device check: draw Gravity Slow circle while grazing enemies and confirm it still fires on release.
- Confirm whether Solar Lance should override directional enemies or still respect directional accuracy.

## Knowledge Promotion

No cross-project reusable knowledge promoted. This is project-specific input/game-feel behavior.
