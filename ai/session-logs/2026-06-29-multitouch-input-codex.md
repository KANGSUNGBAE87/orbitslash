# Session Log — Multitouch Input Guard

- Date: 2026-06-29
- Actor: codex
- Stage: implementation + qa

## User Request

멀티터치가 들어오면 선이 계속 그어져 있는 문제가 있어, 멀티터치를 막아 달라고 요청.

## Decision

- `GameScene`에서 한 번에 하나의 active pointer만 허용한다.
- 첫 번째 `pointerdown`이 시작되면 해당 `pointerId`만 `pointermove`, `pointerup`, `pointerupoutside`, `pointercancel`을 처리한다.
- 두 번째 손가락의 `pointerdown/move/up`은 현재 stroke를 건드리지 않는다.
- `pointercancel`은 live trail과 stroke 상태를 정리해서 선이 남는 상황을 줄인다.

## Files Changed

- `src/game/GameScene.ts`
- `src/game/GameScenePointerInput.test.ts`

## Verification

- TDD RED: `npm test -- src/game/GameScenePointerInput.test.ts` failed before implementation because a second pointer was accepted and non-active pointer move was processed.
- Targeted GREEN: `npm test -- src/game/GameScenePointerInput.test.ts` passed.
- Full regression: `npm test` passed, 33 files / 171 tests.
- Build: `npm run build` passed.
- Release boundary: `npm run preflight:release-boundary` passed.

## Remaining Risks

- Physical-device QA should confirm that browser/WebView multi-touch no longer leaves a stuck slash trail.
- Pinch/zoom behavior should remain disabled by the host page/browser settings during mobile QA.

## Promote to 지식저장소?

Not yet. Project-local input bugfix only.
