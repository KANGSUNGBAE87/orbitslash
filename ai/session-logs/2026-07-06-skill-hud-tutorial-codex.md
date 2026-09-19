---
Actor: codex
Date: 2026-07-06
Topic: skill HUD readability, gesture tutorial, combat gauge pacing
---

## User Request

- Use subagents and implement the latest feedback:
  - Overall text feels too small.
  - Skill cooldowns should be visibly per-skill.
  - Skill charge gain should be about 1.5x faster.
  - Tutorial should explain how to use skills.
  - Skill names should be clearer and placed above the gauge/status.
  - Skill circles should show gesture diagrams: straight arrow, circle, spiral, shield/triangle, outward flick.

## Decisions

- Kept skill costs unchanged; added `combatGaugeGainMultiplier: 1.5` so combat-based gauge gain is faster without changing special-object reward economy.
- Kept existing per-skill cooldown model and strengthened HUD presentation instead of changing cooldown storage.
- Moved skill names to the top of each skill card, removed 5-character truncation, and moved status text below the circle so gesture drawings can live inside the circle.
- Added opening skill tutorial copy for all enabled-skill runs, while boss active/warning tutorials still take priority.
- Enlarged key HUD/result text and adjusted result panels to prevent title/body/button overlap.

## Files Changed

- `src/render/Hud.ts`
- `src/render/Hud.test.ts`
- `src/render/AppShell.ts`
- `src/render/AppShell.test.ts`
- `src/render/ResultOverlay.ts`
- `src/game/ScoringSystem.ts`
- `src/game/ScoringSystem.test.ts`
- `src/game/RankedReplayValidator.ts`
- `src/game/RankedReplayValidator.test.ts`
- `src/game/TutorialHudState.ts`
- `src/game/TutorialHudState.test.ts`
- `src/game/GameScene.ts`
- `src/game/types.ts`
- `src/data/scoring.json`
- `src/i18n/ko.json`
- `src/i18n/en.json`
- `src/i18n/i18nParity.test.ts`

## Verification

- `npm test -- --run src/render/Hud.test.ts src/render/HudLayout.test.ts src/render/AppShell.test.ts src/game/ScoringSystem.test.ts src/game/RankedReplayValidator.test.ts src/game/TutorialHudState.test.ts src/game/GameSceneTutorialHud.test.ts src/game/SkillCooldownSlots.test.ts src/i18n/i18nParity.test.ts` passed.
- `npm run typecheck` passed.
- `npm test` passed: 78 files, 499 tests.
- `npm run build` passed.

## Browser Verification

- In-app browser was connected to `http://127.0.0.1:5195/?qaMode=bossRush&qaPreset=boss&qaGauge=100&seed=1234`.
- Reload/screenshot verification was blocked by browser security policy, so no browser screenshot was captured in this session.

## Subagent Input

- Code mapper confirmed implementation paths and that cooldowns are already stored per skill.
- Reviewer identified missing acceptance points: full skill names, gesture icons, result overlap guard, tutorial skill usage copy.
- Game-logic reviewer recommended combat gauge gain multiplier over skill cost reduction, and keeping special-object gauge rewards unchanged.

## Remaining Risks / Next Steps

- Real-device visual QA still needed for mobile readability after text enlargement.
- Ranked edge validator still does not independently compute exact skill-use upper bounds; local validator now follows the new multiplier.
- Tutorial copy is concise; later onboarding can add per-skill illustrated pages if the first-run panel feels crowded.
