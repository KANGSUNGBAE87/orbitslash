---
date: 2026-07-01
actor: codex
topic: appshell-visual-assets
---

# AppShell Visual Assets

## User Request

- User pointed out that after the Phase 0-4 app shell work, the local app looked like layout only, with no images applied.
- User explicitly requested implementation using subagents.

## Decisions

- Treat the issue as a visual integration pass, not a GitHub deploy issue.
- Keep gameplay sprite assets as the source visuals and reuse the existing enemy/Earth PNGs in the home, mode-select, and result shell screens.
- Add preload before `GameApp` construction so the first shell frame can use image textures instead of empty/fallback sprites.
- Add a shared texture broker so failed asset loads do not retry every frame.

## Files Changed

- `src/render/AppShell.ts`: added image-backed home hero, mode-card thumbnails, result ambience, visual-layer labels, and subtle shell animation.
- `src/render/AppShell.test.ts`: added structure and animation regression tests for shell visual layers.
- `src/render/TextureAssets.ts`: added shared texture cache/loading/failure-state broker.
- `src/render/TextureAssets.test.ts`: added cache and failed-load retry tests.
- `src/render/AppVisualAssets.ts`: added app-shell preload asset manifest.
- `src/main.ts`: preloads app visual assets before booting `GameApp`.
- `src/render/EnemyVisual.ts`: moved enemy texture loading through the shared broker and kept PNG mappings.
- `src/render/EarthVisual.ts`: moved Earth texture loading through the shared broker.
- `src/game/GameApp.ts`: ticks AppShell visual animation.

## Subagents

- `ui-fixer`: implemented the first AppShell visual pass in `AppShell.ts` and `AppShell.test.ts`.
- `code-mapper`: reviewed texture loading paths and identified AppShell as intentionally image-less before this pass, plus the repeated failed-load retry risk.

## Verification

- `npm test -- src/render/AppShell.test.ts`
- `npm test -- src/render/TextureAssets.test.ts`
- `npm test -- src/render/EnemyVisual.test.ts src/render/EarthVisual.test.ts src/render/EnemyMotion.test.ts`
- `npm test -- src/game/GameSceneRunConfig.test.ts src/game/GameScenePhase3.test.ts src/game/GameScenePointerInput.test.ts src/game/GameSceneSkillRelease.test.ts`
- `npm test`
- `npm run build`
- `npm run preflight:release-boundary`
- `git diff --check`
- Browser smoke on `http://127.0.0.1:5192/?seed=1234&qaPreset=dense&qaGauge=100`: home and mode-select images rendered, no console warnings/errors observed.

## Remaining Risks / QA

- Real-device QA still needed for safe-area, touch browser chrome, and small viewport readability.
- Home hero/title spacing should be judged on phone aspect ratios; it is now image-backed but may need final art-direction tuning.
- Result screen visual was structurally tested but not forced through a live game-over browser flow in this pass.
- PNG assets are still untracked in the worktree; staging/deploy scope must include them when GitHub deployment is requested.

## Knowledge Promotion

- No cross-project reusable rule promoted. Project-local session log is sufficient.
