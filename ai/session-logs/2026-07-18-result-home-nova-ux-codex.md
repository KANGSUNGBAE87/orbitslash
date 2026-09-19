# 2026-07-18 Result, Home, Nova UX implementation

- Actor: codex
- User request: 앞서 논의한 결과창 정리, Home 시작 의미 명확화, Nova Pulse 사용법/피드백을 서브에이전트와 모두 구현.
- Stage: implementation -> review -> QA

## Decisions

- Result는 긴 문단 대신 통계, 상세, 해금 카드, primary/secondary CTA로 분리한다.
- Home primary는 onboarding SSOT에 따라 `첫 훈련 시작`, `훈련 계속하기`, `모드 선택`으로 표시하고 같은 상태의 동작을 실행한다.
- Nova Pulse는 `지구 표면 가까이에서 시작해 / 바깥쪽으로 빠르고 곧게 플릭`으로 안내한다.
- Nova 실패 안내는 다른 스킬 판정이 모두 실패한 candidate gesture에만 표시하고 일반 베기 kill/miss/combo 처리는 유지한다.
- Nova cost/cooldown/판정 파라미터는 `resolveNovaPulseDefinition`을 게임, HUD, 결과 해금 카드에서 공유한다. invalid config는 `64 gauge / 18 seconds`로 fail-safe 처리한다.
- 배포, 원격 DB, Edge 변경은 이번 범위에 포함하지 않는다.

## Files changed

- Result/Home: `src/render/AppShell.ts`, `src/render/layout/ResultLayout.ts`, `src/render/view-models/ResultViewModel.ts`, `src/render/view-models/HomeViewModel.ts`, `src/game/GameApp.ts`
- Nova: `src/game/SkillSystem.ts`, `src/game/GameScene.ts`, `src/game/TutorialHudState.ts`, `src/render/SkillGestureIcon.ts`, `src/render/Hud.ts`
- Localization/tests: `src/i18n/ko.json`, `src/i18n/en.json`, 대응 `*.test.ts`
- Plans: `docs/superpowers/specs/2026-07-18-result-home-nova-ux-design.md`, `docs/superpowers/plans/2026-07-18-result-home-nova-ux.md`, `ai/plans/implementation-plan.md`

## Verification

- TDD: 각 하위 작업에서 RED 확인 후 GREEN. Nova gameplay guidance는 예상 실패 13건 후 통과.
- `npm test -- --run`: 131 files, 822 tests passed.
- `npm run build`: TypeScript + Vite production build passed.
- `git diff --check`: passed.
- Subagent review: integrated spec PASS, quality PASS. Nova config SSOT 재검토 APPROVED.
- Browser QA: Home과 dense Result/Nova unlock을 360x800, 390x844, 430x932에서 확인. panel/CTA viewport 이탈과 card overlap 없음.

## Remaining risks / next

- Nova gesture threshold는 실제 터치 기기에서 감도/오인식 튜닝이 필요하다.
- 현재 워크트리에는 이번 작업 전부터 다른 미커밋 변경이 많다. stage/commit하지 않았다.
- Knowledge-store promotion: 없음. 프로젝트별 UX 구현 증거로 로컬 로그에만 유지.
