# 2026-07-18 Independent skill charge and Guided Story runtime

- Actor: codex
- User request: 서브에이전트를 활용해 스킬별 충전/쿨타임, 충전 시각화, Guided Story 유성·에너지 문제와 앞서 논의한 UX를 모두 구현.
- Stage: implementation -> review -> QA

## Decisions

- 스킬 5종은 `SkillChargeBank`의 슬롯별 충전을 사용한다. 전투 보상은 각 슬롯에 독립
  누적되고 성공한 스킬의 충전과 쿨타임만 초기화한다.
- HUD 바깥 청록 링은 충전율/퍼센트, 안쪽 주황 링은 활성 쿨타임만 표시한다.
- Ranked client와 generated Edge core도 동일한 슬롯별 충전 계약을 사용한다. 동일 ms
  이벤트는 전역 `eventSequence`와 timestamp 순서를 함께 검증한다.
- Guided Story 목표는 별도 cohort와 좌/우 slot ID로 관리한다. 1HP 목표만 scripted spawn,
  impact는 무피해 재생성, Solar 목표는 Solar 피해만 허용한다.
- Solar miss/partial은 해당 스킬 충전·쿨타임을 환불하고 누락 slot만 보충한다. 완료 직전
  Boss/Special을 다시 지연해 scripted step 종료 직후 backlog가 튀어나오지 않게 한다.
- 배포, 원격 DB apply, commit/stage는 수행하지 않는다.

## Files changed

- Charge/cooldown: `src/game/SkillChargeBank.ts`, `src/game/SkillCooldownSlots.ts`,
  `src/game/SkillSystem.ts`, `src/game/GameScene.ts`와 대응 테스트.
- Guided runtime: `src/game/GameSceneGuidedRuntime.test.ts`,
  `src/game/GameSceneTutorialHud.test.ts`, `src/game/BossSystem.ts`,
  `src/game/SpecialObjectRuntime.ts`와 대응 테스트.
- HUD/i18n: `src/render/Hud.ts`, `src/i18n/ko.json`, `src/i18n/en.json`와 대응 테스트.
- Ranked parity: `shared/ranked-core/score.ts`, replay trace/session/validator,
  generated `supabase/functions/_shared/` 및 Edge 경계 테스트.
- Plans: `docs/superpowers/plans/2026-07-18-independent-skill-charge-and-guided-meteor.md`,
  `ai/plans/implementation-plan.md`, `ai/plans/design-plan.md`.

## Verification

- TDD: guided 최종 품질 결함 3개도 부정 테스트 RED 후 GREEN 확인.
- Focused: 6 files / 53 tests passed.
- `npm test -- --run`: 135 files / 941 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: 853 modules, production build passed.
- `node scripts/generate-ranked-edge-core.mjs --check`: passed.
- `git diff --check`: passed.
- Subagent reviews: client charge, HUD, Ranked spec/quality PASS. Guided Story는 두 차례
  품질 지적을 수정한 뒤 최종 QUALITY PASS, 중요 결함 0.
- Browser QA: 360x800, 390x844, 430x932에서 충전 링/퍼센트와 HUD 무겹침 확인.
  390x844 Guided Story에서 목표 유성 즉시 노출, 에너지 `100/100`, wave HUD 숨김 확인.
  로컬 WebStub의 예상 경고 `No available adapters.` 외 JavaScript error 없음.

## Remaining risks / next

- 실제 터치 기기에서 Nova/Solar 제스처 감도와 긴 세션 pacing을 추가 확인해야 한다.
- 원격 Ranked, native shell, 스토어/실기기 증거는 이번 로컬 구현 범위 밖이며 release
  complete가 아니다.
- 기존 dirty worktree를 보존했고 stage/commit하지 않았다.
- Knowledge-store promotion: 없음. 프로젝트별 구현 증거로 로컬 로그에 유지.
