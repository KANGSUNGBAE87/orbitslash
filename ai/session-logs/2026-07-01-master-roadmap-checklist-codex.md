# 2026-07-01 Master Roadmap Checklist

Actor: codex

## User Request

Use subagents with different models to review the existing product plan and
implementation plan, then create a checklist of everything Codex should
implement.

## Subagent Review Summary

- Hubble (`gpt-5.4`): Reviewed product roadmap and six-mode scope. Conclusion:
  current product is still a single combat scene, so shared mode contracts must
  come before mode-specific implementation.
- Banach (`gpt-5.3-codex-spark`): Reviewed current implementation shape.
  Conclusion: combat core is partly mode-ready, but `ModeId`, `RunConfig`,
  seed policy, run-end reasons, and app state machine are missing.
- Kepler (`gpt-5.4-mini`): Reviewed durable docs and QA artifacts. Conclusion:
  `product-plan.md` is the product SSOT, `review.md` is current QA/readiness
  evidence, `implementation-plan.md` is Phase 1 architecture only, and
  `release-checklist.md` contains stale verification numbers.

## Decisions Made

- Created `ai/plans/master-roadmap.md` as the canonical implementation
  checklist tying together product scope, current implementation, QA backlog,
  release readiness, and the six-mode goal.
- Immediate implementation order is:
  1. Phase 0: SSOT and shared mode contracts.
  2. Phase 1: Mode-ready combat core with `RunConfig`.
  3. Phase 2: real-device core QA closure.
  4. Phase 3: common content systems.
  5. Phase 4+: app shell, six modes, backend/ranking, platform release.
- Updated `ai/plans/README.md` so the master roadmap is discoverable as a
  canonical planning artifact.

## Files Changed

- `ai/plans/master-roadmap.md`
- `ai/plans/README.md`
- `ai/session-logs/2026-07-01-master-roadmap-checklist-codex.md`

## Verification

- Read-only subagent analysis completed and integrated.
- Documentation-only change; no test suite was run for gameplay code.

## Remaining Risks

- The worktree already had many uncommitted gameplay and asset changes before
  this roadmap pass. Staging and commits should stay scoped.
- The release checklist still needs a separate refresh before release-facing
  decisions.
- The six-mode roadmap now exists, but code implementation has not started for
  `ModeId`, `RunConfig`, app shell, or new modes.

## Next Steps

- Implement Phase 0 contracts first: `ModeId`, `ModeDefinition`, `RunRules`,
  `SeedPolicy`, `ObjectiveType`, `RevivePolicy`, mode result contract, and
  config layering.
- Then refactor the current play scene to start from `RunConfig` instead of
  hardcoded Rookie assumptions.
- Refresh release checklist after the next verified implementation slice.

## Knowledge Promotion

No cross-project knowledge promotion needed. This is project-specific roadmap
state and remains in the Orbit Slash project artifacts.
