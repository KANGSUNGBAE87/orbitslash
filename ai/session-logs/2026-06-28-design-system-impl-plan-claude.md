# Session Log — 디자인 시스템 + 구현 기획문 (서브에이전트)

- Date: 2026-06-28
- Actor: claude
- Stage: design-system + implementation planning

## User Request
1,2,3 순서대로 진행: design-preflight(팔레트 토큰화) → 디자인 토큰/컴포넌트 스펙 →
implementation-plan 1단계. 서브에이전트 활용, 상황별 적정 모델 선택.

## Method (서브에이전트 병렬)
- 디자인(1+2): general-purpose / **sonnet** — 아트 방향 강함, 토큰화·스펙=중간 무게.
- implementation-plan(3): general-purpose / **opus** — 모듈 경계·시드/서버 확장점=최고 난도.
- 병렬 실행 (둘 다 디스크 canonical 파일만 읽음, stage-1 코어루프는 디자인 토큰 비의존).

## Done / Files Created
- `ai/plans/design-system.md` (v0.1 draft, canonical, 1076줄):
  3계층 색토큰(primitive→semantic→component, CSS 변수), 타이포/스페이싱/radius/glow/
  motion 토큰, 15개 컴포넌트 스펙(HUD바·에너지/점수/Threat·원형3D 스킬버튼 4상태·
  모드카드 6변형·START·미션패널·보스HP바·콤보박스·LastSave배너·Victory/GameOver·Settings/Collection).
  핵심 hex: navy-900 #080e24 / cyan-400 #22d3ee(shield) / orange-500 #f97316(danger) /
  purple-500 #7c3aed(gravity) / gold-400 #f59e0b(CTA). 대비 ≥4.5:1 검증.
- `ai/plans/implementation-plan.md` (v0.1 draft, canonical, 509줄):
  Phase 1 핵심 루프 집중 + 6단계 확장 구조. 순수로직(Collision/Scoring/WaveGenerator/Rng)
  vs 렌더 분리, GameScene 단일 조립, RemoteConfig 단일 데이터 통로. IRng 주입으로
  랭킹 시드 부착점 확보. 12단계 작업 순서, vitest TDD(순수로직)+live preview(UI).

## Key Decisions
- 팔레트: colors.io 타임아웃, Coolors hex 미노출 → design-plan §1.2 방향에서 hex 도출·잠금.
- React Bits: 메뉴 화면만 3후보(모드카드 tilt+glow / 결과 CountUp / CTA gradient border).
  PixiJS Canvas 게임플레이엔 미사용. polish 패스로 defer 가능.
- 모듈 경계: 순수 로직 PixiJS import 금지 → 테스트+서버 재현 양립.
- 시드: WaveGenerator가 IRng 주입받음. P1=random seed, 랭킹 시 seed 생성만 교체.

## Conflicts/Guards 반영
- canonical 스킬 4종(orbital_cut|solar_lance|gravity_slow|delta_shield)만. 목업 추가 버튼명 아트 전용.
- 지구 크기 규칙(body ≤330px, 목업 미추종). Instant Judgment/Delayed Effect(pointer-up 스냅샷).
- AI UX disabled for this stage. Supabase prefix orbitslash_, 서버검증 deferred 인터페이스만.

## Owner 확인 필요 (오픈 이슈)
디자인:
- D1 폰트 라이선스: Google Fonts(Exo 2/Rajdhani/Orbitron) OK? vs 상용.
- D2 스킬 아이콘: 커스텀 공급 vs design_sample VFX 유도.
- D3 60s Blitz 카드색 시안이 Orbital Cut/shield와 겹침 → ice-500 #7dd3fc 권장.
- D4 React Bits 설치: polish vs 첫 UI 스프린트.
구현:
- I3 점수 SSOT 중복(enemies.json vs scoring.json) → enemies.json.score 단일출처 권장.
- I6 Multi Cut↔콤보: N마리=콤보+N vs +1 미명시(점수 직결) → 명시 요청, 가정 안 둠.
- I5 Solar Lance 게이지 충전 소스 Phase2 의존 → P1은 처치+1 + 디버그 토글.
- 기타: PixiJS 확정(I1), P1 Rookie 단일(I2), 거리밴드 경계 데이터위치(I4), 플레이스홀더 도형(I7), Supabase SQL은 Phase6 승인 후(I8).

## Verification
- 4개 canonical plan 파일 디스크 확인됨 (product/design/design-system/implementation).
- 코드 미생성(설계 단계). 빌드/테스트 해당 없음.

## Next Steps
1. Owner가 오픈 이슈(특히 I6 Multi Cut 콤보, I3 점수 SSOT, D1 폰트) 결정.
2. 결정 후 implementation-plan status draft→approved 승급.
3. Phase 1 구현 착수 (Owner 명시적 구현 지시 시): 부트스트랩→지구→데이터→Rng/WaveGenerator(TDD)...
   구현은 Codex 핸드오프 또는 Claude 서브에이전트 — Owner가 경로 지정.

## Subagents
- a300421d7750ab362 (design, sonnet) — SendMessage로 이어가기 가능.
- ac857bb88eac78a9c (impl-plan, opus) — SendMessage로 이어가기 가능.

## Owner 결정 반영 (same-day append)
Owner가 오픈이슈 3건 추천값 승인 ("그렇게해, 나중에 필요하면 밸런스패치"):
1. Multi Cut↔콤보 = 콤보 += N + Multi Cut 별도 flat 보너스 + `comboGainPerSlashCap`
   레버(기본 null). 인플레는 텔레메트리 기반 주간 패치로.
2. 점수 SSOT = enemies.json.score 단일출처, scoring.json은 배율·보너스·게이지만.
3. Solar Lance P1 게이지 = §10.1 P1존재분(일반+1/큰소행성+2/콤보+2/LastSave+8) + 디버그 토글.

→ `implementation-plan.md` v0.1→**v0.2, status draft→approved**. §2.2 scoring.json
(comboGainPerSlashCap/multiCutBonus/gaugeGain), §2.4 _debug, §3.4 onHit 시그니처,
§10 오픈이슈 #3/#5/#6 RESOLVED 반영. Change Log 갱신.

남은 오픈이슈(비차단): #1 PixiJS 확정(가정), #2 P1 Rookie 단일, #4 거리밴드 데이터 위치,
#7 플레이스홀더→에셋 교체, #8 Supabase SQL Phase6, 디자인 D1 폰트/D2 아이콘/D3 60s색/D4 React Bits.

## Promote to 지식저장소?
- 아직 불필요. 프로젝트-local 유지.
