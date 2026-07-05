---
date: 2026-06-29
actor: codex
topic: enemy-motion-liveliness
---

# Enemy Motion Liveliness Session

Actor: codex

## User Request

Implement enemy liveliness items 1-5 using subagents, generating images if needed:
- self rotation
- subtle breathing
- trail/glow motion
- movement-direction orientation
- stronger hit feedback

## Subagent Input

- `code-mapper` confirmed the safest integration path is `GameScene.update` -> `drawEnemySprite` / `drawEnemyOverlay`, with visual-only changes kept away from gameplay hit radius.
- `game-logic-reviewer` identified hitbox mismatch, directional guide readability, boss readability, and mobile overdraw as the main risks.
- `reviewer` blocked the first pass because trail/glow did not follow hit-shake position/scale and because non-lethal hits spawned full `DestructionBurst` allocations on every chip hit.

## Decisions

- Did not generate new images in this pass. Existing image assets are sufficient; the floating feeling came from missing code-side motion layers.
- Added a pure motion helper so tuning can be tested without Pixi rendering.
- Kept breathing small (`<= 2%` normal, `< 1%` boss) to avoid visible hitbox mismatch.
- Rotated only enemy image/fallback layers. Directional guide overlay remains unrotated and tied to slash rules.
- Kept non-lethal feedback overlay-only after review to reduce mobile allocation and overdraw risk.

## Files Changed

- `src/render/EnemyMotion.ts`
  - Added `enemyTravelAngleRad` and `enemySpriteMotion`.
  - Comet sprites align to movement vector with a slight wobble.
  - Non-comet sprites self-spin with deterministic enemy-id phase.
  - Motion returns visual scale, trail alpha/length, and glow alpha.
- `src/render/EnemyMotion.test.ts`
  - Added tests for inward/tangent travel angle, comet alignment, asteroid spin, and bounded breathing.
- `src/game/GameScene.ts`
  - Added `enemyTrailLayer` on `LAYER.ENEMY_TRAILS`.
  - Draws comet trail/glow each frame and clears it every update.
  - Applies rotation only to image/fallback, not overlay.
  - Applies visual pulse to container scale while keeping gameplay hit radius unchanged.
  - Stronger hit feedback now uses overlay rings/sparks and existing shake.
- `ai/reviews/review.md`
  - Updated current state, verification count, and asset/motion checklist.

## Verification

- RED check: `npm test -- src/render/EnemyMotion.test.ts` failed before `EnemyMotion.ts` existed.
- GREEN/full verification:
  - `npm test`: 35 files / 177 tests passed.
  - `npm run build`: passed.
  - `npm run preflight:release-boundary`: passed.
  - Local in-app browser smoke at `http://127.0.0.1:5182/?seed=1234&qaPreset=dense&qaGauge=100`: one 390x844 canvas rendered, no console errors.
  - Screenshot: `/tmp/orbitslash-enemy-motion-mobile-fixed.png`.

## Remaining Risks / QA

- Real-device touch QA is still needed for perceived hitbox vs visual silhouette after motion.
- Directional enemy QA: confirm the guide line remains readable and aligned during sprite motion.
- Dense mobile performance QA: confirm trails plus hit sparks do not add touch latency.
- Boss readability still needs a boss arrival warning and HP/remaining-hit indicator.

## Next Steps

1. Add boss arrival warning/banner.
2. Add boss HP or remaining-hit UI.
3. Tune 7-second wave pacing and Solar Lance charge after one real-device pass.
4. Later: boss weak-point/pattern art and final 5th skill decision.

## Knowledge Promotion

No cross-project reusable knowledge promoted. This is project-specific game-feel tuning.
