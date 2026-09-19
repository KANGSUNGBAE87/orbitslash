---
date: 2026-07-06
actor: codex
topic: premium-art-vfx
---

# Premium Art / VFX Pass

## User Request

Use subagents, read the existing design plan and samples, then upgrade final art,
final boss image/VFX, remaining asset quality, buttons, background, and assets so
the game reads as a final-release product rather than an MVP.

## Subagent Inputs

- `context-brief`: confirmed the SSOT direction: 2.5D/3D-feel, deep navy cosmic
  background, cyan/blue Earth and shield, orange/red danger, purple gravity,
  gold CTA, beveled UI, layered rendering, and no text baked into art assets.
- `code-mapper`: mapped the render/edit surface to `AppShell`, `Hud`,
  `EnemyVisual`, `EarthVisual`, `GameScene`, `SlashTrail`, `LaserVfx`,
  `DestructionBurst`, `HitBurst`, and `TextureAssets`.
- `reviewer`: marked the visual release candidate as blocked before this pass
  because of flat outline buttons, sparse gameplay background, primitive VFX,
  inconsistent boss assets, and placeholder-like special objects.

## Decisions

- Reuse the provided high-quality `eclipse-core.png` as the visual source for
  the boss roster, then generate color-graded PNG variants for Ringed Destroyer,
  Lava Titan, Ice Colossus, and Dark Planet.
- Keep existing Earth and normal enemy PNGs; they already match the direction
  better than the old SVG placeholders.
- Improve visual density through layered Pixi rendering rather than one static
  background image, preserving the design-plan layer contract.
- Keep gameplay judgment and hitboxes unchanged. This pass is visual only.

## Files Changed

- `scripts/generate-premium-boss-assets.py`: deterministic PIL-based generator
  for premium boss PNG variants.
- `public/assets/enemies/ringed-destroyer.png`
- `public/assets/enemies/lava-titan.png`
- `public/assets/enemies/ice-colossus.png`
- `public/assets/enemies/dark-planet.png`
- `src/render/EnemyVisual.ts`: boss asset mapping now uses generated PNGs;
  fallback drawing gained 3D rim light, shading, cracks, and boss rings.
- `src/render/AppShell.ts`: premium cosmic backdrops, gold START CTA,
  beveled buttons, richer mode cards, image refresh on `showHome`/`showResult`,
  and denser home/result ambience.
- `src/render/Hud.ts`: skill slots upgraded to 3D lens cards with layered glow,
  clearer ready state, improved wave and Earth energy bevels.
- `src/game/GameScene.ts`: gameplay background upgraded from black+stars to
  nebula, orbit guides, richer star field, boss aura, and stronger special
  object shells.
- `src/render/SlashTrail.ts`: added broader glow and endpoint spark.
- `src/render/LaserVfx.ts`: Solar Lance now has layered beam core/glow and side
  sparks.
- `src/render/DestructionBurst.ts`: added core flash and shock rings.
- `src/render/HitBurst.ts`: added impact flash and rays.
- `src/render/EnemyVisual.test.ts`: updated boss asset expectations.

## Verification

- `npm test -- src/render/EnemyVisual.test.ts src/render/AppShell.test.ts src/render/Hud.test.ts src/render/DestructionBurst.test.ts src/render/HitBurst.test.ts src/render/TextureAssets.test.ts`
- `npm test`
- `npm run typecheck`
- `npm run build`
- `git diff --check`
- `npm run preflight:release-boundary`
- Playwright mobile smoke at `390x844`, `http://127.0.0.1:5198/?seed=1234&qaPreset=dense&qaGauge=100`
  - Canvas count: 1
  - Home and gameplay screenshots saved:
    - `/tmp/orbitslash-premium-home-3.png`
    - `/tmp/orbitslash-premium-game-2.png`
  - No page errors.
  - No request failures.
  - Only WebGL `ReadPixels` performance warnings from screenshot capture.

## Remaining Risks / QA

- Real-device QA still needed for mobile WebView chrome, touch feel, HUD
  readability, boss weak-point readability, and VFX clutter during dense waves.
- Special objects are still procedural shapes, not authored image sprites.
  They are improved but should receive final art assets later.
- Boss variants are color-graded from one source image. Good for current release
  quality, but future unique boss silhouettes can still improve identity.

## Knowledge Promotion

Project-local only for now. No cross-project durable rule added.
