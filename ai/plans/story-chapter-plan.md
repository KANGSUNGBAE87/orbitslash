---
version: 0.1
status: active
updated: 2026-07-05
canonical: false
---

# Orbit Slash — Story Chapter Plan

This plan records the implemented Story data contract for the release-slice story mode.

## Structure

- 8 chapters.
- 4 stages per chapter.
- 32 total Story stages.
- Stage ids use `story-N`.
- Seeds use `1000 + N`, so `story-32` maps to seed `1032`.
- Every stage has `labelKey`, `tutorialKey`, `chapterId`, `stageNumber`, `objective`, and `objectiveParams`.

## Chapters

| Chapter | Key | Stages | Focus |
| --- | --- | --- | --- |
| 1 | `story.chapter1` | `story-1` ~ `story-4` | First Impact: basic slash, Last Save, protection, combo |
| 2 | `story.chapter2` | `story-5` ~ `story-8` | Orbital Defense: first boss threat and wider orbit control |
| 3 | `story.chapter3` | `story-9` ~ `story-12` | Friendly Signals: Last Save, speed, protection, boss alert |
| 4 | `story.chapter4` | `story-13` ~ `story-16` | Element Storm: precision combo, danger defense, boss threat |
| 5 | `story.chapter5` | `story-17` ~ `story-20` | Precision Cut: rescue priority, combo pressure, gravity crisis |
| 6 | `story.chapter6` | `story-21` ~ `story-24` | Planet Threat: boss pursuit, orbital mastery, protection mix |
| 7 | `story.chapter7` | `story-25` ~ `story-28` | Gravity Crisis: energy pressure and escort judgment |
| 8 | `story.chapter8` | `story-29` ~ `story-32` | Final Orbit: final protection, combo, threat, mixed rules |

## Runtime Contract

- `buildRunConfig("story", { storyStageId })` selects the canonical stage seed.
- Unknown Story seeds do not silently fall back to `story-1`.
- Story progress unlocks the current cleared stage and the next stage.
- Clearing `story-32` does not unlock invalid stage `33`.
- AppShell Story detail shows total chapter/stage count, selected stage, tutorial preview, and unlock summary.
- `GameApp` forwards selected `storyStageId` into the active run config, so the
  selected stage seed reaches the actual gameplay scene.
- `GameScene` renders the selected stage's localized tutorial as an in-game,
  non-modal HUD callout.

## Remaining Product Work

- Decide later whether Story needs a modal pause/dismiss tutorial. Current
  implementation is a non-blocking live callout so it does not change touch
  timing, seed, objective, or unlock rules.
- Add authored wave/boss overrides per late Story chapter when boss-pattern tuning stabilizes.
- Replace raw stage-control buttons with a fuller chapter/stage selection screen if Story becomes the primary first-run path.
