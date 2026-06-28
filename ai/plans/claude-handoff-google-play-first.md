---
status: handoff
updated: 2026-06-28
actor: codex
---

# Claude Handoff — Google Play First

Owner instruction for the next Claude run, expected around 2026-06-29 07:00 KST:

> Google Play release is first. Keep Apps in Toss compatibility, but do not let
> Apps in Toss become the first-release target.

## Bottom Line

Codex reviewed the current implementation direction and considers it suitable
for the intended hybrid platform strategy:

```text
Shared game core: PixiJS/WebGL, game logic, scenes, assets
Google Play shell: Android WebView/Capacitor + Google Billing + AdMob
Apps in Toss shell: Apps in Toss WebView SDK + Toss Login/Ads/IAP + granite config
Platform services: AuthAdapter, AdsAdapter, PaymentAdapter, BackendAdapter
```

The current repo is not yet fully wired for this shell split. It is at a good
intermediate point: the shared game core is started, pure gameplay logic has
tests, and platform boundaries are sketched. Continue from here; do not restart
or replace the architecture.

## What Is Already Good

- Runtime stack is lightweight and appropriate: Vite + TypeScript + PixiJS.
- `src/game/` is the shared game core. Collision, scoring, RNG, and wave
  generation are separated from Pixi rendering, which supports testing and
  future server-side ranking verification.
- `src/platform/PlatformAdapter.ts` already establishes the right SDK boundary.
  Product/game logic should not import Apps in Toss SDKs, Google Play Billing,
  AdMob, Google login, or Supabase directly.
- `AGENTS.md` already says game/game-like apps should use Google Play as the
  first release target while preserving Apps in Toss compatibility.
- Current verification passed during Codex review:
  - `npm run typecheck`
  - `npm test` with 5 test files and 70 passing tests

## Must Correct Before Continuing

The project documents still contain some Apps in Toss-first wording. Align these
before or during the next planning/update pass:

- `ai/plans/product-plan.md` currently says the platform is "Apps in Toss mini
  app / WebView based web game" near the top. Reword it to:
  "Google Play-first WebView game, Apps in Toss-compatible."
- `package.json` description also says "Apps in Toss WebView mini-game." Reword
  it to a neutral or Google Play-first description.
- Keep Apps in Toss requirements in the plan as compatibility constraints, not
  as the first launch target.

## Current Implementation Status

This is not playable yet. It is a skeleton plus tested pure logic.

Implemented or started:

- PixiJS app bootstrap and responsive 1080x1920 coordinate scaling.
- Placeholder game scene with space background and rotating Earth.
- Pure systems and tests for:
  - RNG
  - wave generation
  - gesture helper math
  - collision/multi-cut
  - scoring
- Local/stub platform adapter.
- i18n files for Korean and English.
- Canonical plans under `ai/plans/`.

Still unwired:

- Actual game loop composition inside `GameScene`.
- Enemy spawn to visible sprite/object rendering.
- Pointer input to `GestureSystem`.
- Slash trail rendering.
- Collision result to object death, scoring, energy, HUD, and game over.
- Solar Lance activation and VFX.
- Google Play shell, Apps in Toss shell, and concrete platform adapters.

## Recommended Next Claude Task

First close the Phase 1 playable loop. Do not jump to store packaging or visual
polish yet.

Recommended order:

1. Reconfirm Google Play-first wording in product/package/platform docs.
2. Wire `GameScene`:
   `WaveGenerator -> OrbitSpawner -> ObjectManager -> Enemy movement -> GestureSystem -> CollisionSystem -> ScoringSystem -> EnergySystem`.
3. Render simple enemy placeholders and slash trail in PixiJS.
4. Add HUD text for score, combo, time, energy, and Last Save.
5. Keep all user-facing text behind the i18n layer.
6. Run `npm run typecheck`, `npm test`, and a browser preview.
7. Only after the core loop works, add target-specific shell work:
   - `src/platform/google/` for Google Play/Android shell implementation.
   - `src/platform/toss/` for Apps in Toss implementation.
   - target-specific build scripts/config.

## Platform Guardrails

- One shared product codebase.
- Do not fork gameplay/core logic by platform.
- Platform SDKs live only behind adapters.
- Google Play build must use Google Play Billing for digital goods, AdMob for
  ads, and appropriate Google/Android auth where needed.
- Apps in Toss build must use Toss Login, Apps in Toss ads, Apps in Toss IAP, and
  Apps in Toss WebView/runtime rules.
- Supabase remains the default backend path, but concrete SQL/remote apply is
  deferred until explicitly requested.
- AI UX remains disabled for this stage unless Owner asks for a user-facing AI
  feature. Keep any AI provider key server-only.

## Do Not Do Next

- Do not rebuild the project from scratch.
- Do not switch from PixiJS to Phaser unless there is a concrete blocker.
- Do not implement Apps in Toss as the first release shell.
- Do not add Google Billing, AdMob, Toss SDK, or Supabase directly into game
  logic.
- Do not spend the next pass on high-end design-sample asset polish before the
  playable loop exists.
