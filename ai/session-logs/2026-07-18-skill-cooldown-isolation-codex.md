---
Actor: codex
Date: 2026-07-18
Topic: skill cooldown HUD isolation and Nova Pulse usage
---

## User Request

- Make skill cooldowns reset independently instead of appearing to reset together.
- Explain exactly how to use the skill referred to as "Nova Lance."

## Root Cause and Decisions

- `SkillSystem` already stores and ticks cooldowns independently per skill.
- The HUD reused the shared skill-gauge ratio for every non-cooling slot ring, so spending the shared gauge made every ring and percentage drop together.
- Preserved the canonical product rule: one shared skill gauge, separate per-skill cooldowns.
- Added a per-slot cooldown progress ratio and made the circular ring display only that value.
- Replaced shared-gauge percentages inside each slot with the explicit localized state `게이지 부족` / `NEED GAUGE`.
- Confirmed the actual skill names are `Nova Pulse` and `Solar Lance`; there is no `Nova Lance` skill.

## Files Changed

- `src/game/SkillCooldownSlots.ts`
- `src/game/SkillCooldownSlots.test.ts`
- `src/render/Hud.ts`
- `src/render/Hud.test.ts`
- `src/i18n/ko.json`
- `src/i18n/en.json`

## Verification

- Red test: the independent cooldown-ring regression test failed before implementation because `cooldownProgressRatio` was missing.
- Focused tests passed: 5 files, 17 tests.
- Full tests passed: 128 files, 701 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `git diff --check` passed.
- Local dev server responded `HTTP 200` at `http://127.0.0.1:5173/`.

## Remaining Risks / Next Steps

- Automated tests verify cooldown/gauge state separation, but real touch input for Nova Pulse still needs device-level feel tuning if users miss the gesture frequently.
- No deployment or remote backend change was performed.

## Knowledge Promotion

- No cross-project promotion. This is an Orbit Slash-specific HUD correction.
