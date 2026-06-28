# Handoff Brief — Orbit Slash Phase 1 → Codex

- Date: 2026-06-28
- From: claude
- To: codex (cold start 가능하게 자기완결적으로 작성)
- Status: Phase 1 핵심 플레이 루프 **구현 완료 + 정적 검증 통과**, **E2E/기기 QA 미완**, **git 커밋 0개(전부 untracked)**.

## 0. 먼저 읽을 것 (SSOT)
1. `ai/plans/product-plan.md` v1.0 approved — 게임 규칙 SSOT.
2. `ai/plans/design-plan.md` v1.2 approved — 시각 SSOT (지구 크기 §2 중요).
3. `ai/plans/implementation-plan.md` v0.2 approved — 모듈 경계/인터페이스/작업순서.
4. `ai/plans/design-system.md` v0.1 draft — 색/토큰/컴포넌트 스펙(미적용 다수).
5. 세션 로그: `ai/session-logs/2026-06-28-*.md` (특히 `phase1-implementation-claude.md`).
6. `design_sample/` 19장 = 에셋팩+화면목업 (아트 기준, 현재 미사용 — 플레이스홀더 도형 사용 중).

## 1. 목표 / 현재 범위
Apps in Toss WebView 게임. Stack: **Vite + TypeScript + PixiJS v8 (^8.6.6) + vitest**.
Phase 1 = 핵심 플레이 루프: 작은 지구 / 나선 접근 운석 / 손가락 슬래시 / 선분-원 충돌 /
Earth Energy / Last Save / 콤보 / 기본 점수 / Solar Lance(지구 관통 직선, pointer-up 스냅샷).

## 2. 검증 상태
- ✅ `npx tsc --noEmit` 0 에러 / `npm test` **70 passed** / `npm run build` 성공(gzip ~94KB).
- ✅ `npm run dev` + Preview 스크린샷: 작은 지구·나선 운석·HUD·게이지 렌더, 콘솔 에러 0.
  지구 피격 시 에너지 감소 확인(충돌+에너지 파이프라인 동작).
- ❌ **미검증(중요)**: 실제 슬래시 → 운석 파괴 → 점수/콤보/Last Save/Solar Lance 발동
  E2E. 헤드리스 한계로 합성 포인터 미실행. **다음 단계 1순위.**
- 슬래시 판정 로직 자체(resolveSlash/ScoringSystem/gesture-helpers/Rng/WaveGenerator)는
  vitest 유닛테스트로 커버됨.

## 3. 실행 / 검증 명령
```bash
npm install
npm run dev        # 로컬 플레이(포인터로 슬래시)
npm test           # vitest 70개
npx tsc --noEmit   # 타입체크
npm run build && npm run preview
```

## 4. 아키텍처 핵심 (재작업 방지 — 반드시 유지)
- **순수 로직 vs 렌더 분리**: `CollisionSystem`/`ScoringSystem`/`WaveGenerator`/`Rng`/
  `gesture-helpers`/`Enemy(stepEnemy/enemyXY)`/`coords`는 **PixiJS import 금지**(테스트·서버 재현용).
  렌더는 `Earth`/`GameScene`/`render/*`.
- **GameScene이 유일한 조립처**: 시스템끼리 직접 참조 X. 고정 update 순서(§4.1):
  input(pointer 이벤트) → spawn → movement → 지구충돌 → scoring(이벤트) → render.
- **데이터 단일 통로 = RemoteConfig**: 모든 밸런스는 `src/data/*.json`, 코드 매직넘버 금지.
  RemoteConfig.get*() 경유. (지금 로컬 JSON, 나중 원격 fetch로 교체 — `ready()`가 비동기 지점.)
- **결정성/시드**: `WaveGenerator`가 `IRng` 주입받음. Phase1 = `createRng(Date.now())`.
  랭킹 부착 시 `createRng(hashSeed(date,difficulty,seasonId))`로 **시드 생성만 교체**, 본체 불변.
- **Instant Judgment, Delayed Effect**: 슬래시/Solar Lance 판정은 **pointer-up 스냅샷 1회**
  (`GameScene.resolveInput`). VFX(SlashTrail/LaserVfx)는 시각 전용, 판정 불변. (product-plan §28-3/4)

## 5. 파일 맵 (`src/`)
```
main.ts                  진입점
game/
  GameApp.ts             PixiJS Application + RAF(dt clamp 50ms) + 반응형 scale(1080x1920)
  GameScene.ts           ★오케스트레이터. 시스템 조립/입력/충돌/렌더/게임오버/재시작
  coords.ts              BASE 1080x1920, 지구 상수, distanceBand, orbitToXY
  layers.ts              L0~L13 zIndex
  types.ts               공용 타입 (SpawnSpec, EnemyState, *Config, OrbitProfile ...)
  Rng.ts (+test)         mulberry32 시드 RNG
  WaveGenerator.ts(+test) 시드 기반 SpawnSpec 생성 (orbits/난이도 적용)
  OrbitSpawner.ts        SpawnSpec → Enemy 상태 → ObjectManager
  ObjectManager.ts       활성 적 컬렉션 + prune
  Enemy.ts               createEnemyState/stepEnemy(나선)/enemyXY (순수)
  GestureSystem.ts       pointer 누적 + classify (slash/line; circle/triangle/spiral 지표는 계산만)
  gesture-helpers.ts(+test) straightness/totalTurn/polygonEnclosesPoint/countSharpVertices
  CollisionSystem.ts(+test) segmentIntersectsCircle/distanceBand/multiCutTier/resolveSlash
  ScoringSystem.ts(+test) scoreFor/onHit(콤보+=N, MultiCut보너스, 게이지)/onMiss/snapshot
  EnergySystem.ts        Earth Energy 피해/회복/visualState(§11.3)
  SkillSystem.ts         Solar Lance 판정(직선/길이/게이지/쿨타임/지구관통) + tick/cooldown
  Earth.ts               지구 렌더 + setVisualState + ref()
  RemoteConfig.ts        data/*.json 단일 통로
  RankingSystem.ts/Telemetry.ts/BossSystem.ts  [STUB]/[LATER]
data/  enemies / scoring / difficulty / orbits / skills .json
render/ SlashTrail / LaserVfx / Hud / ResultOverlay  (PixiJS)
i18n/  index.ts + ko.json + en.json   (ko 기본, t() 경유, 하드코딩 금지)
platform/ PlatformAdapter + WebStubAdapter [STUB]
ui/ hud-labels.ts
```

## 6. 데이터 모델 + 확정된 밸런스 결정
- `enemies.json` (Phase1 4종 non-directional): small/basic/fast/heavy. **`score`가 점수 SSOT**.
- `scoring.json`: distanceMultiplier, accuracyMultiplier, comboMultiplier,
  `comboGainPerSlashCap`(=null 무제한 레버), `multiCutBonus`, `gaugeGain`.
- `difficulty.json`: rookie/defender/elite/master {earthEnergy, gravitySwell, **approachSpeedMul**} + zones.
- `orbits.json`: 10 프로파일 {angularMul(곡률), dir(±회전방향)}. **접근속도는 여기 없음**(난이도 변수로 분리).
- `skills.json`: solar_lance 활성(gaugeCost 80/cooldown 12s/straightness 0.88/길이 0.6/관통 0.6R/끝점 1.5R 바깥),
  나머지 3종 _phase later, `_debug{instantFillGauge,infiniteGauge}`.

Owner 확정 결정(반영됨):
1. **Multi Cut↔콤보**: 콤보 += 처치 마릿수(N) + Multi Cut 별도 flat 보너스. cap 레버 기본 null.
2. **점수 SSOT**: enemies.json.score 단일출처.
3. **Solar Lance P1 게이지**: 일반+1/큰소행성+2/콤보+2/LastSave+8 + 디버그 토글.
4. **지구 크기**: 게임 화면 1/3 축소 — body 100px/shield 140/LastSave링 174 (design §2 v1.2).
5. **궤도**: 곡률+회전방향만 10종 다양화. **접근속도=난이도별 approachSpeedMul 분리**(난이도↑시 상승).

## 7. 하드룰 (어기지 말 것 — product-plan §28)
게임플레이 Canvas만(DOM 금지) / 스킬은 지구 연결 제스처 / Solar Lance 손뗀 순간만 판정 /
연출 중 지나간 대상 안 맞음 / 랭킹전 광고 부활 금지(재도전권만) / 랭킹 생존1위·점수2위 /
canonical 스킬 **정확히 4종**(orbital_cut/solar_lance/gravity_slow/delta_shield, 목업 다른 버튼명은 아트뿐) /
지구 작게 유지 / 아이템 강화 없음 / 밸런스 Remote Config / 억울한 판정 금지 / 적 기본 나선 접근.

## 8. 다음 작업 (우선순위)
1. **[1순위] 코어 루프 E2E 검증**: 슬래시→파괴→점수/콤보/거리배율/Last Save, Solar Lance 발동
   (게이지 차면 직선 긋기 → 골드 빔 + 일렬 관통). dev에서 직접 플레이 또는 합성 포인터.
   버그 있으면 GameScene.resolveInput/GestureSystem 배선부터 점검.
2. **git 초기 커밋**: Phase 1 한 덩어리. (현재 커밋 0개. .gitignore 확인 — node_modules/dist 제외됨.)
3. **Phase 2 손맛 강화** (product-plan §27-2): 폭발/파괴 이펙트(L10), 거리배율 시각 피드백,
   방향베기 Metal Asteroid(enemies.json에 directional 키 + GestureSystem 방향 판정 + accuracy "directional").
4. 곁다리: 운석 상대크기(지구 100 < heavy_asteroid 116 — radiusPx 축소 검토, Owner 옵션 미결),
   디자인 D1~D4(폰트/스킬아이콘/60s색/React Bits), design_sample 에셋 교체(플레이스홀더→스프라이트, plan §10-7).

## 9. 리스크 / 주의
- E2E 미검증 상태 — Phase 2 전에 1번 끝낼 것.
- 운석 radiusPx가 지구보다 큼(시각 어색). 밸런스/시각 조정 대상.
- graphify 재빌드는 LLM API key 없어 스킵됨(셋업부터). cmm auto_index는 동작.
- 빈 슬래시·지구 피격 = 콤보 끊김 정책 적용 중(Remote Config로 조정 가능).
- Phase1 난이도 Rookie 단일(난이도 선택 UI는 Phase 5).

## 10. 백엔드/플랫폼 (deferred, 인터페이스만)
랭킹 서버/Run Token/고정시드/기록검증 = 서버측(Phase 6). Supabase 공유 `dr.kang-mini-project`,
테이블 prefix `orbitslash_`(orbitslash_runs/scores). RLS on, 시크릿 클라 노출 금지.
AI UX disabled for this stage. 플랫폼 어댑터(login/ads/iap/storage/haptics) WebStub noop.
