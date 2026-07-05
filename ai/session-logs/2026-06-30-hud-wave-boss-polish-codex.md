---
date: 2026-06-30
actor: codex
topic: hud-wave-boss-polish
---

# HUD, Wave, Boss Polish

Actor: codex

## User Request

Move time to the top center, make the wave bar thicker, show Earth energy as a very thick bottom full-width bar, and implement the remaining buckets 1-4 using subagents.

## Subagent Inputs

- `code-mapper` mapped the impact surface: `Hud.ts`, `WaveGenerator.ts`, `GameScene.ts`, `SkillCooldownSlots.ts`, `SkillSystem.ts`, `EnergySystem.ts`, and boss tests/data.
- `game-logic-reviewer` recommended prioritizing HUD hierarchy, boss warning/remaining-hit UI, 7-second waves, Solar Lance cost easing, and keeping the 5th skill as a placeholder instead of inventing an unapproved mechanic.

## Decisions

- Treat buckets 1-4 as:
  - game feel/tuning,
  - boss completion scaffold,
  - skill system polish,
  - UX/readability.
- Use 7-second wave cadence and align wave data bands to that cadence.
- Lower Solar Lance gauge cost from 80 to 72 as a conservative first-use timing buff.
- Keep the 5-slot HUD and `reserve_slot` placeholder; do not invent a fifth active skill yet.
- Add boss warning + remaining-hit HUD for the current `hp=50` scaffold.

## Changes

- `src/render/Hud.ts`
  - Moved time to top center.
  - Moved score to top-left.
  - Thickened the wave gauge.
  - Added bottom full-width Earth energy bar.
  - Added boss warning / boss remaining-hit bar and text.
  - Exported `hudLayoutMetrics()` for layout regression tests.
- `src/game/BossHudState.ts`
  - Added pure boss HUD state builder for pre-spawn warning and active boss HP/remaining-hit state.
- `src/game/GameScene.ts`
  - Feeds active boss state into HUD.
- `src/game/WaveGenerator.ts`
  - Changed default wave duration from 10 seconds to 7 seconds.
- `src/data/waves.json`
  - Rebased wave bands to 0/7/14/21/28/35/42/49/56/63 seconds.
- `src/data/skills.json`
  - Lowered `solar_lance.gaugeCost` to 72.
- `src/i18n/ko.json`, `src/i18n/en.json`
  - Added boss HUD strings.
- Tests
  - Added `src/game/BossHudState.test.ts`.
  - Extended HUD layout, wave cadence, wave data, and Solar Lance balance tests.
- `ai/reviews/review.md`
  - Updated current state, verification, QA backlog, and implementation backlog.

## Verification

RED:
- `npm test -- src/render/HudLayout.test.ts src/game/WaveGenerator.test.ts src/game/BossHudState.test.ts`
- Failed as expected before implementation because `hudLayoutMetrics` / `BossHudState` did not exist and wave timing/data were still 10 seconds.

GREEN:
- Targeted HUD/wave/boss tests: 3 files / 22 tests passed.
- Skill balance/release tests: 3 files / 6 tests passed.
- `npm test`: 37 files / 186 tests passed.
- `npm run build`: passed.
- `npm run preflight:release-boundary`: passed.
- Local dev server smoke: `http://127.0.0.1:5182/?seed=1234&qaPreset=dense&qaGauge=100` returned HTTP 200.
- In-app browser desktop smoke: one canvas rendered, no console errors.
- In-app browser 390x844 mobile smoke: one canvas rendered, no console errors; top time and bottom Earth energy bar were visible without overlap.

## Remaining QA

- Real device: confirm top-center time, top-left score, thick wave bar, and bottom energy bar are readable with actual browser chrome / WebView safe areas.
- Real device: confirm 7-second wave pacing feels faster without becoming noisy.
- Real device: confirm first Solar Lance usually becomes available early enough after cost 72.
- Real device: wait for 60-second boss and confirm warning / remaining-hit HUD is visible and useful.
- Real device: confirm boss non-lethal hit feedback is clear enough for `hp=50`.

## Next Steps

- If the new HUD/timing pass feels good, next implementation should be real boss weak points / multi-part behavior.
- If the game feels too compressed, tune wave spawn intervals before adding new mechanics.
- Decide the canonical fifth skill later; keep `reserve_slot` as placeholder for now.

## Knowledge Promotion

No cross-project reusable knowledge promoted. This is project-specific game-feel and HUD tuning.
