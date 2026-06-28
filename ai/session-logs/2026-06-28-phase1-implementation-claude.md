# Session Log — Phase 1 핵심 플레이 루프 구현

- Date: 2026-06-28
- Actor: claude
- Stage: implementation (Phase 1)

## User Request
B) Claude 서브에이전트(상황별 모델)로 구현 시작.

## Method
- Subagent A (opus): 토대 + 순수로직 TDD. 완료·검증(70 vitest, tsc 0, build OK, dev 부팅).
- Subagent B (opus): 통합/렌더 배선 — **세션 한도로 중단(파일 변경 0, 읽기만)**.
- → B 스코프를 메인 세션(claude)이 직접 구현.

## Done (Subagent B 스코프 = 메인이 구현)
신규 렌더 클래스:
- `src/render/SlashTrail.ts` — L9 시안 슬래시 trail(라이브+페이드).
- `src/render/LaserVfx.ts` — Solar Lance 골드 빔(시각 전용, 판정 불변).
- `src/render/Hud.ts` — PixiJS Text HUD(에너지/점수/시간/콤보/게이지 버튼/배너), i18n 경유.
- `src/render/ResultOverlay.ts` — 최소 Game Over(점수/생존/최대콤보) + 탭 재시작.

수정:
- `src/game/GameScene.ts` — 전면 재작성. 시스템 조립 + §4.1 고정 update 순서
  (input 이벤트 → spawn → movement → 지구충돌 → scoring 이벤트 → render). 적 스프라이트
  풀, 포인터 입력(stage hitArea, getLocalPosition→1080x1920), pointer-up 스냅샷 판정,
  Solar Lance 우선판정+게이지/쿨타임, Multi Cut/Last Save 배너, 게임오버/재시작.
- `src/game/SkillSystem.ts` — Solar Lance 지구관통 검사 완성(lineToEarthMaxR/endpointOutsideR),
  pointToSegmentDistance, cooldownRemaining.
- `src/game/Earth.ts` — setVisualState(§11.3 shield 색/경고 펄스), ref().
- `src/i18n/{ko,en}.json` — result.time/result.restart 추가.

## Verification (실제 실행)
- `npx tsc --noEmit` → 0 에러.
- `npm test` → 70 passed (5 files). (순수로직 회귀 유지)
- `npm run build` → 성공 (gzip ~94KB).
- `npm run dev` + Claude Preview 스크린샷 → 작은 지구/나선 운석/HUD/게이지/별 렌더,
  에너지 60/100(운석 지구피격으로 감소 = 충돌+에너지 파이프라인 동작), **콘솔 에러 0**.
- ⏳ 실제 터치 슬래시 손맛/멀티컷/Solar Lance 발동은 Owner 기기 QA 필요(헤드리스 한계).
  슬래시 판정 로직 자체는 resolveSlash/ScoringSystem 유닛테스트로 커버됨.

## Notes / Risks
- 적 스프라이트 = 플레이스홀더 도형(회색 암석+오렌지 림). design_sample 에셋 교체는 이후(plan §10-7).
- 빈 슬래시 = 콤보 끊김 정책 적용(Remote Config 조정 가능). 지구 피격도 콤보 끊김.
- Phase1 난이도 Rookie 단일(오픈이슈 #2). 게이지 max 100, Solar Lance cost 80.
- graphify 재빌드는 LLM API key 없어 스킵(셋업 단계와 동일). cmm auto_index는 동작.

## Next Steps
1. Owner 기기에서 슬래시 손맛/Last Save/Solar Lance E2E 체감 QA.
2. Phase 2(손맛 강화: 폭발 이펙트/거리배율 시각화/방향베기) 또는 에셋 교체.
3. 남은 디자인 이슈 D1~D4(폰트/아이콘/60s색/React Bits) 결정.
4. (선택) gstack review/qa 마일스톤.

## 후속 변경 (same-day append)

### 지구 크기 1/3 축소 (Owner 지시)
- coords.ts: body 300→100px, shield 420→140, Last Save 링 520→174 (중심 540,900 유지).
- design-plan.md §2.2/§2.3 v1.2 갱신 + Change Log (코드-문서 동기화).
- distanceBand/impact/LastSave는 R 배수 기반이라 자동 축소. 검증: tsc 0/70 테스트/Preview/콘솔 0.
- 부작용 메모: 운석 radiusPx 미변경이라 지구(100) < heavy_asteroid(116) — 상대크기 역전. Owner에 옵션 제시(유지 vs 운석도 축소), 미결.

### 궤도 다양화 (Owner 요청: ~10 랜덤 궤도)
- 문제: angular/approachSpeed가 적 타입별 고정 → 같은 타입은 곡률 동일(시작각만 랜덤)="다 같은 궤도".
- 해결: `src/data/orbits.json` 10개 OrbitProfile{angularMul, approachMul, dir±}. WaveGenerator가
  시드 RNG로 스폰마다 1개 배정 → SpawnSpec에 최종 angularSpeed(부호=회전방향)/approachSpeed 담음.
  Enemy.createEnemyState가 spec 값 사용. dir ±1로 시계/반시계 혼합, angularMul 0.5~2.0 곡률 다양.
- 시드 기반이라 랭킹 재현성(§21) 유지. types.SpawnSpec += angularSpeed/approachSpeed, OrbitProfile 추가.
  RemoteConfig.getOrbits() 추가. WaveGenerator 생성자 orbits 주입(테스트 4곳 갱신).
- 검증: tsc 0, 70 테스트(결정성 유지), build OK, Preview 운석 분산 확인, 콘솔 0.

### 접근속도 분리 (Owner 지시)
- 궤도 프로파일은 **곡률(angularMul) + 회전방향(dir)만**. approachMul 제거.
- 접근속도는 **난이도별 변수**로 분리: difficulty.json에 `approachSpeedMul`
  (rookie 1.0 / defender 1.2 / elite 1.45 / master 1.75 — 난이도 상승 시 증가). DifficultyDef 타입 추가.
- WaveGenerator.makeSpec: approachSpeed = def.approachSpeed × 난이도 approachSpeedMul;
  angularSpeed = def.angularSpeed × profile.angularMul × dir.
- orbits.json = 10종(곡률 0.5~2.0 × dir ±). 검증: tsc 0, 70 테스트, build OK, Preview, 콘솔 0.
- 향후: 런 내 시간 기반 접근속도 ramp도 이 변수에 곱하면 됨(별도 작업).

## Promote to 지식저장소?
- 아직 불필요. 프로젝트-local 유지.
