# 2026-07-04 P0/P1/P2 Implementation

Actor: codex

## User Request

성배님 asked to create P0/P1/P2 checklists and keep implementing until the checklist is complete, using subagents with Claude leading.

## Subagents

- Claude CLI auth was checked with `claude auth status --text`; direct status reported logged in.
- Claude CLI led the first planning pass and recommended a conservative checklist path.
- `code-mapper` subagent mapped current implementation files, collision risks, and local architecture seams.
- `game-logic-reviewer` subagent reviewed boss, special-object, and mode-design risks.
- Final integration followed Claude's checklist structure, but adopted the game-logic reviewer's stronger special-object and boss weak-point recommendations where they better matched the current game direction.

## Decisions

- P0 is now the shared combat and documentation lock: Nova Pulse as fifth skill, active Earth/gameplay sizing documented, protected-object behavior clarified, Delta Shield HUD surfaced, and public ranking claims blocked until server validation exists.
- P1 completes the first playable boss/mode slice: weak-point positional resolver, weak-point overlay, boss phase pattern metadata, Boss Rush sequence contract, and 60s Blitz six-band pacing.
- P2 stays as local product contracts rather than full backend/platform release: Story Stage 1-3 contracts, Daily modifier registry, ranked server-stub contract, and release-boundary guard notes.
- Special objects now avoid the "slice everything is always good" problem: satellites and capsules reward survival/expiry, while cutting protect/avoid objects applies the configured penalty path.

## Implemented

- Added `ai/plans/p0-p2-implementation-checklist.md` and marked all implementation-scope P0/P1/P2 items complete.
- Added protected-object expiration rewards and cut penalties in `SpecialObjectSystem` and `SpecialObjectRuntime`.
- Added Delta Shield persistent HUD state with remaining absorbs and time.
- Increased wave gauge thickness for mobile readability.
- Added boss weak-point hit resolution, phase pattern metadata, boss weak-point overlay drawing, and correct bossWeak accuracy assignment.
- Added DEV-only `qaPreset=boss` to make first-boss weak points immediately visible for browser/real-device QA.
- Added Blitz runtime bands and spawn interval multiplier support.
- Added Story Stage 1-3 and Daily modifier contracts.
- Added DEV-only `qaPreset=special` plus non-text special-object symbols so protect/avoid objects are visually distinguishable.
- Added DEV-only `qaMode` direct entry so real-device QA can open a mode without going through mode select.
- Added DEV-only in-app QA launcher for Blitz, Boss Weak, and Special real-device smoke paths.
- Added production-bundle QA token leakage scan to release-boundary preflight.
- Added ranked server-stub start contract so local ranked cannot be mistaken for public validated ranking.
- Updated canonical product/design/implementation/review documents to reflect the current five-skill, boss, mode, and platform state.

## Verification

- `npm test`: passed, 52 test files / 248 tests.
- `npm run build`: passed.
- `npm run preflight:release-boundary`: passed, including production bundle QA-token leakage scan.
- `git diff --check`: passed.
- Mobile browser visual smoke at `http://127.0.0.1:5187/`: DEV QA launcher, Blitz, Boss Weak, and Special buttons launch the matching QA mode/preset and render with no console warnings/errors.
- Production bundle string check: no `qaMode`, `qaPreset`, or `qaGauge` strings found in `dist`.

## Remaining QA

- Real-device touch feel and HUD safe-area QA after this pass.
- Boss weak-point readability on real phone using `?qaMode=bossRush&qaPreset=boss&qaGauge=100`.
- Special object avoid/protect readability on real phone using `?qaMode=freeDefense&qaPreset=special&qaGauge=100`.
- 60s Blitz pacing feel using `?qaMode=blitz60&qaPreset=dense&qaGauge=100`.

## Remaining Risks

- Public ranking is still a local/server-stub boundary, not a live Supabase validated leaderboard.
- Boss pattern visuals are a vertical slice, not the final boss-pattern art pass.
- Story/Daily mode contracts exist, but final content tuning and unlock/reward economy still need a separate balance pass.
- The worktree already contained many dirty/untracked files from prior implementation sessions; no staging or commit was performed in this pass.

## Knowledge Promotion

- No cross-project knowledge promotion needed. Project-local checklist and session log are the durable handoff artifacts for this pass.
