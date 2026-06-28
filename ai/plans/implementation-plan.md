---
version: 0.2
status: approved
updated: 2026-06-28
canonical: true
---

# Orbit Slash — Implementation Plan (구현 기획문 v0.1)

> Phase 1 (핵심 플레이 루프) 집중 구현 설계. product-plan §27 6단계 로드맵과
> 모드/랭킹이 **무리한 재작업 없이 나중에 붙도록** 모듈 경계·시드·서버 검증 인터페이스를
> 미리 확정한다. 이 문서는 **설계/아키텍처/인터페이스 스케치**만 담는다 — 실제 프로젝트
> 스캐폴딩·npm/vite 실행·소스 파일 생성은 하지 않는다.
>
> SSOT: 게임 규칙 = `ai/plans/product-plan.md`, 시각 규칙 = `ai/plans/design-plan.md`.
> 충돌 시 두 SSOT가 우선하고, 본 문서는 그 구현 방법만 기술한다.

## Change Log

- 2026-06-28 (claude): Phase 1 구현 기획문 v0.1 최초 작성. 모듈 경계, 데이터 주도
  밸런스, 핵심 인터페이스 스케치, 게임 루프, 테스트 전략, Apps in Toss WebView/백엔드/
  i18n 준비, Phase 1 작업 순서, 리스크/오픈 이슈 정리.
- 2026-06-28 (claude): v0.2 — Owner 결정 3건 반영, status draft→approved.
  (1) Multi Cut↔콤보 = **콤보 += N(처치 마릿수)** + Multi Cut 별도 flat 보너스,
      `comboGainPerSlashCap` 레버(기본 null=무제한, 폭주 시 클램프). 밸런스는 텔레메트리
      기반 주간 패치로 조정.
  (2) 점수 SSOT = **enemies.json.score 단일출처**, scoring.json은 배율·보너스만.
  (3) Solar Lance Phase1 게이지원 = §10.1 중 P1 존재분(일반+1/큰소행성+2/콤보+2/
      LastSave+8) + 개발용 디버그 충전 토글. 방향베기/보스/구조대 게이지는 기능 구현 시 부착.
  오픈이슈 #3/#5/#6 RESOLVED.

---

## 0. 범위 및 원칙

### 0.1 Phase 1 목표 (반드시 동작)
product-plan §27.1 + §30:

- 중앙 **작은** 지구 (design §2.2: body 280~330px, shield 390~460px, center ~540,900).
  목업의 과대 지구를 **절대 따르지 않음** (design §2, §12, product-plan §28 미준수 금지).
- 나선형 궤도 접근 적 (product-plan §15.1 수학).
- 손가락 슬래시 입력 → `points[] = [{x,y,t}]` → 슬래시 trail 렌더.
- 선분-원 충돌 판정 (`segmentIntersectsCircle`), Multi Cut.
- Earth Energy (시작 100, 피해 표, 0이면 게임오버).
- Last Save (거리 배율).
- 콤보.
- 기본 점수 (기본 × 거리 × 정확도 × 콤보).
- Solar Lance 지구 관통 직선 제스처 (직선성 검사).
- Instant Judgment / Delayed Effect (손 뗀 순간 판정, 이펙트는 시각 전용).

### 0.2 미래 부착 가능성 원칙 (재작업 방지)
- `WaveGenerator`는 처음부터 **결정적 시드 RNG**를 주입받는다 → 랭킹 고정 시드(§21)가
  나중에 동일 인터페이스로 붙는다.
- `ScoringSystem`은 `WaveGenerator`/렌더와 **분리** → 서버 재현·검증(§21.3) 준비.
- `RemoteConfig`는 지금 로컬 JSON 반환 스텁, 나중에 원격으로 교체 (§23.5).
- `RankingSystem`/`Telemetry`/플랫폼 어댑터(login/ads/IAP/storage/haptics)는
  **인터페이스만** 두고 스텁.

### 0.3 product-plan §28 하드룰 준수 (구현 가드)
1. 게임플레이 = Canvas/WebGL(PixiJS), **DOM 아님**.
2. 스킬은 지구와 연결된 제스처로만 발동.
3. Solar Lance는 손 뗀 순간만 판정.
4. 레이저 연출 중 지나간 구조대는 안 맞음 (판정 스냅샷 ≠ 연출 타임라인).
14. 적은 기본 나선 궤도 접근.
15. 억울한 판정 금지 (pointer-up 시점 스냅샷 판정).

### 0.4 스킬 이름 충돌 (가드)
canonical 스킬 = **정확히 4종**: Orbital Cut, Solar Lance, Gravity Slow, Delta Shield
(product-plan §8). 목업/design_sample의 Laser Strike, Plasma Burst, Missile Barrage,
Frost Bomb, Black Hole, Repair Drone 등은 **아트 시안일 뿐** — 코드/데이터의 스킬 ID는
4종으로 고정. `skills.json`의 ID는 `orbital_cut | solar_lance | gravity_slow | delta_shield`.

---

## 1. 모듈/파일 구조

product-plan §23.2 구조 위에 확장. **Phase 1**(이번 구현) vs **STUB**(인터페이스만) vs
**LATER**(나중 Phase) 표시.

```text
/src
  main.ts                      [P1] Vite 진입점, PixiJS Application 부트스트랩, 리사이즈
  /game
    GameApp.ts                 [P1] 앱 수명주기: PixiJS init, 씬 전환, RAF 루프 소유
    GameScene.ts               [P1] 한 판 플레이 씬: 시스템 조립 + 고정 update 순서
    Earth.ts                   [P1] 지구 스프라이트 + shield/Last Save 링 + 상태 연출(§11.3)
    OrbitSpawner.ts            [P1] WaveGenerator가 뱉은 스폰 명세 → ObjectManager에 적 생성
    ObjectManager.ts           [P1] 활성 오브젝트 컬렉션 + 오브젝트 풀링(pooling)
    Enemy.ts                   [P1] 적 엔티티(상태: angle/radius/hp/type), 나선 이동 적용
    GestureSystem.ts           [P1] 포인터 이벤트 → points[] → 제스처 분류(slash/line; circle/triangle/spiral는 STUB hook)
    CollisionSystem.ts         [P1] segmentIntersectsCircle, Multi Cut, Last Save 밴드 판정
    ScoringSystem.ts           [P1] 점수 공식(기본×거리×정확도×콤보) + 콤보 상태
    SkillSystem.ts             [P1: Solar Lance만] 게이지/쿨타임 골격 + Solar Lance 직선 판정. 나머지 3종 STUB
    WaveGenerator.ts           [P1] 결정적 시드 RNG로 스폰 명세 생성 (랭킹 고정시드 부착 지점)
    Rng.ts                     [P1] 시드 RNG(mulberry32/xorshift) — 결정성 단위테스트 대상
    EnergySystem.ts            [P1] Earth Energy 100, 피해 적용, 게임오버 신호
    RankingSystem.ts           [STUB] 제출/조회 인터페이스만, 로컬 noop
    BossSystem.ts              [LATER] Phase 4~. 빈 인터페이스
    Telemetry.ts               [STUB] track(event, props) noop
    RemoteConfig.ts            [P1 stub] get(key) → 로컬 /data JSON 반환 (원격 교체 대비)
    layers.ts                  [P1] L0~L13 zIndex 상수 (design §10)
    coords.ts                  [P1] BASE 1080x1920, scale 계산, R/거리밴드 헬퍼 (§4.2, design §2.3)
    types.ts                   [P1] 공용 타입(Point, GestureResult, SpawnSpec, HitResult 등)
  /platform
    PlatformAdapter.ts         [STUB] login/ads/iap/storage/haptics 인터페이스
    WebStubAdapter.ts          [P1 stub] 로컬 개발용 noop 구현 (Apps in Toss/Play는 LATER)
  /data
    enemies.json               [P1] 적 타입별 밸런스 (시작반경/접근속도/회전속도/크기/hp/피해/점수)
    scoring.json               [P1] 거리/정확도/콤보 배율, 기본 점수
    difficulty.json            [P1] 난이도별 Earth Energy, Gravity Swell 충돌반경 배율
    skills.json                [P1 부분] 4종 스킬 메타 (Phase1은 solar_lance만 실사용)
    bosses.json                [LATER] Phase 4
  /i18n
    index.ts                   [P1] t(key) 로케일 라우터, ko 기본 + en
    ko.json                    [P1] 한국어 문자열
    en.json                    [P1] 영어 문자열
  /ui                          (React/HTML 래퍼 — 메뉴/결과/HUD 텍스트만, 게임필드 아님)
    StartScreen.tsx            [P1 최소] 시작 버튼만 (모드 카드는 LATER)
    ResultScreen.tsx           [P1 최소] 점수/생존시간 표시
    HudOverlay.tsx             [P1] 텍스트/숫자 HUD (design §6: 텍스트는 HTML/Canvas, 이미지에 굽지 않음)
    RankingScreen.tsx          [LATER] Phase 6
    ModeSelectScreen.tsx       [LATER] Phase 5
```

### 1.1 모듈 경계 핵심 결정
- **렌더 vs 로직 분리**: `CollisionSystem`/`ScoringSystem`/`WaveGenerator`/`Rng`는
  PixiJS를 import하지 않는 **순수 로직**(테스트·서버 재현 가능). 렌더는 `Earth`/`Enemy`/
  `GameScene`이 담당.
- **시스템 조립은 GameScene 한 곳**: 시스템은 서로 직접 참조하지 않고 GameScene이
  고정 순서로 호출하며 데이터를 넘긴다(§4 게임 루프). 결합도↓, 모드 추가 시 GameScene
  변형/상속으로 확장.
- **데이터 진입은 RemoteConfig 단일 통로**: 모든 시스템은 JSON을 직접 읽지 않고
  `RemoteConfig.get()`로 받는다 → 원격 교체가 한 지점.

---

## 2. 데이터 주도 밸런스 (하드코딩 금지)

product-plan §28-11: 밸런스 값은 전부 `/data/*.json`. 코드에 매직넘버 금지.
Phase 1 키 목록(초안 — 실제 값은 product-plan 표에서 채움):

### 2.1 `enemies.json` (Phase 1 키)
```jsonc
{
  "small_meteor":   { "startRadius": 900, "approachSpeed": 70, "angularSpeed": 0.6, "radiusPx": 26, "hp": 1, "damage": 3,  "score": 50,  "directional": false },
  "basic_meteor":   { "startRadius": 920, "approachSpeed": 60, "angularSpeed": 0.5, "radiusPx": 34, "hp": 1, "damage": 5,  "score": 100, "directional": false },
  "fast_comet":     { "startRadius": 950, "approachSpeed": 95, "angularSpeed": 0.7, "radiusPx": 30, "hp": 1, "damage": 8,  "score": 130, "directional": false },
  "heavy_asteroid": { "startRadius": 880, "approachSpeed": 40, "angularSpeed": 0.35,"radiusPx": 58, "hp": 3, "damage": 12, "score": 180, "directional": false }
}
```
> Phase 1은 non-directional 일반 적 4종으로 충분. Fire/Ice/Metal/Planet/특수적은
> Phase 2~3에서 키 추가(분열·폭발·방향베기 플래그). 스키마는 동일 형태 유지.

### 2.2 `scoring.json` (Phase 1 키)
```jsonc
{
  // 기본 점수는 enemies.json.score가 단일출처(SSOT). scoring.json은 배율·보너스·게이지만.
  "distanceMultiplier": { "outer": 1.0, "mid": 1.4, "danger": 2.2, "lastSave": 3.5 },
  "accuracyMultiplier": { "normal": 1.0, "directional": 1.2, "weakCenter": 1.5, "bossWeak": 2.0 },
  "comboMultiplier": [
    { "min": 1,  "mult": 1.0 },
    { "min": 5,  "mult": 1.2 },
    { "min": 10, "mult": 1.5 },
    { "min": 20, "mult": 2.0 },
    { "min": 30, "mult": 2.5 }
  ],

  // 콤보: 한 슬래시로 N마리 파괴 → 콤보 += N (Owner 결정). cap=null=무제한,
  // 폭주 텔레메트리 보이면 5 등으로 클램프(아키텍처 불변, 데이터 레버).
  "comboGainPerSlashCap": null,

  // Multi Cut 별도 flat 보너스 (콤보와 독립). product-plan §6.3 tier.
  "multiCutBonus": { "double": 50, "triple": 120, "mega": 400, "orbital_master": 1000 },

  // 스킬 게이지 획득 (product-plan §10.1). Phase 1에 존재하는 소스만 활성.
  "gaugeGain": {
    "small_meteor": 1, "basic_meteor": 1, "fast_comet": 1, "heavy_asteroid": 2, // 일반/큰소행성
    "comboKill": 2,                                                              // 콤보 처치
    "lastSave": 8,                                                               // Last Save 성공
    // ↓ Phase 2~ 기능 구현 시 활성 (지금은 미사용 키로 보존)
    "directionalCut": 3, "bossWeakPoint": 10, "rescueArrive": 5
  }
}
```
> Multi Cut 보너스 값은 초안 — 텔레메트리(전체 점수 중 콤보/멀티컷 비중) 보고 주간
> 패치로 조정. `multiCutTier`(§3.3) 결과로 보너스 1회 가산.

### 2.3 `difficulty.json` (Phase 1 키)
```jsonc
{
  "rookie":   { "earthEnergy": 100, "gravitySwell": 1.00 },
  "defender": { "earthEnergy": 90,  "gravitySwell": 1.08 },
  "elite":    { "earthEnergy": 75,  "gravitySwell": 1.16 },
  "master":   { "earthEnergy": 60,  "gravitySwell": 1.25 }
}
```
> 거리밴드 경계(4.0R/3.0R/2.0R/1.3R/1.2R, product-plan §4.2)도 difficulty.json 또는
> 별도 `zones` 키로 데이터화 → Remote Config 조정 가능.

### 2.4 `skills.json` (Phase 1: solar_lance만 실사용)
```jsonc
{
  "solar_lance": { "gaugeCost": 80, "cooldownSec": 12, "minLengthRatio": 0.60, "straightnessMin": 0.88, "lineToEarthMaxR": 0.6, "endpointOutsideR": 1.5 },
  "orbital_cut":   { "gaugeCost": 100, "cooldownSec": 18, "_phase": "later" },
  "gravity_slow":  { "gaugeCost": 100, "cooldownSec": 25, "_phase": "later" },
  "delta_shield":  { "gaugeCost": 100, "cooldownSec": 30, "_phase": "later" },

  // Phase 1 게이지 충전: scoring.json.gaugeGain의 P1 소스(일반+1/큰소행성+2/콤보+2/
  // LastSave+8)로 채움 + 개발용 디버그 토글(제스처 판정 테스트). 빌드 플래그로만 노출.
  "_debug": { "instantFillGauge": false, "infiniteGauge": false }
}
```

---

## 3. 핵심 인터페이스/타입 스케치 (TypeScript 시그니처)

> 시그니처만. 구현 본문은 Phase 1 작업에서 TDD로 채운다.

### 3.1 공용 타입 (`types.ts`)
```ts
export interface Point { x: number; y: number; t: number; } // t = ms timestamp
export interface Segment { a: Point; b: Point; }
export interface Vec2 { x: number; y: number; }

export type DistanceBand = "outer" | "mid" | "danger" | "lastSave" | "impact";
export type GestureKind = "slash" | "line" | "circle" | "triangle" | "spiral" | "none";

export interface SpawnSpec {       // WaveGenerator → OrbitSpawner (렌더 무관, 서버 재현 가능)
  enemyType: string;               // enemies.json 키
  spawnAtMs: number;               // 판 시작 기준 등장 시각
  startAngleRad: number;           // 결정적 RNG로 생성
  startRadius: number;
}

export interface EnemyState {
  id: number; type: string;
  angle: number; radius: number;   // 나선 궤도 상태 (§15.1)
  angularSpeed: number; approachSpeed: number;
  radiusPx: number; hp: number; damage: number; score: number;
  alive: boolean;
}
```

### 3.2 GestureSystem
```ts
export interface GestureResult {
  kind: GestureKind;
  points: Point[];
  // 분류 지표 (순수 함수, 테스트 대상)
  straightness: number;            // 시작-끝거리 / 경로총길이 (1.0=직선)
  totalTurnRad: number;            // 누적 회전각 (circle/spiral 판정)
  enclosesEarth: boolean;          // 경로 폴리곤이 지구중심 포함 (circle/triangle)
  vertexCount: number;             // 큰 꺾임 수 (triangle 판정)
  startEndGapRatio: number;        // 시작-끝 거리 / 경로총길이 (닫힘 판정)
}

export interface IGestureSystem {
  onPointerDown(p: Point): void;
  onPointerMove(p: Point): void;
  onPointerUp(p: Point): GestureResult;     // 손 뗀 순간 = 판정 트리거 (§2.3 Instant Judgment)
  classify(points: Point[], earth: { cx: number; cy: number; r: number }): GestureResult;
}

// 순수 분류 헬퍼 (vitest 대상, PixiJS 무관)
export function straightness(points: Point[]): number;
export function totalTurn(points: Point[]): number;
export function polygonEnclosesPoint(points: Point[], cx: number, cy: number): boolean;
export function countSharpVertices(points: Point[], minAngleRad: number): number;
```
> Phase 1은 `slash`(임의 긋기)와 `line`(Solar Lance 직선)만 실분류. circle/triangle/
> spiral은 지표(`totalTurnRad`/`enclosesEarth`/`vertexCount`)를 **이미 계산**해 두고
> SkillSystem이 나중 Phase에서 임계값으로 매칭만 추가하면 되게 한다.

### 3.3 CollisionSystem
```ts
export interface HitResult {
  enemyId: number;
  band: DistanceBand;              // 베인 시점 적의 거리밴드 → 거리배율
  accuracy: "normal" | "directional" | "weakCenter" | "bossWeak";
}

// 핵심 순수 함수 (vitest 대상)
export function segmentIntersectsCircle(seg: Segment, cx: number, cy: number, r: number): boolean;
export function distanceBand(radius: number, R: number, zones: ZoneTable): DistanceBand;

export interface ICollisionSystem {
  // 슬래시 폴리라인(여러 선분) vs 활성 적 → 베인 적 목록 (Multi Cut)
  resolveSlash(points: Point[], enemies: EnemyState[], earthR: number): HitResult[];
  multiCutTier(count: number): "double" | "triple" | "mega" | "orbital_master" | "none";
}
```

### 3.4 ScoringSystem
```ts
export interface ScoreInput {
  baseScore: number;               // enemies.json.score
  band: DistanceBand;              // 거리배율
  accuracy: HitResult["accuracy"]; // 정확도배율
  combo: number;                   // 콤보배율
  specialBonus?: number;
}

export interface IScoringSystem {
  // 순수: 결정적, 렌더/시간 의존 없음 → 서버 재계산으로 검증 가능 (§21.3)
  scoreFor(input: ScoreInput, cfg: ScoringConfig): number;
  // onHit(hits): 한 슬래시의 HitResult[]. 콤보 += hits.length (cap=comboGainPerSlashCap),
  // Multi Cut tier 보너스 1회 가산, 게이지 += Σ gaugeGain. baseScore는 enemies.json.score.
  onHit(hits: HitResult[]): { gained: number; combo: number; multiCut: number; gauge: number; lastSave: boolean };
  onMiss(): void;                  // 콤보 끊김(0으로)
  reset(): void;
  snapshot(): ScoringSnapshot;     // 서버 제출용 (점수/최대콤보/LastSave횟수/정확도)
}
```

### 3.5 WaveGenerator (결정적 시드 — 랭킹 부착 지점)
```ts
export interface IRng { next(): number; nextInt(maxExclusive: number): number; }
export function createRng(seed: number): IRng;            // mulberry32; 결정성 테스트 대상

export interface WaveConfig { difficulty: string; durationMs?: number; }

export interface IWaveGenerator {
  // RNG를 주입받음 → 같은 seed = 같은 SpawnSpec 시퀀스 (§21.2 seed=hash(date+difficulty+seasonId))
  constructorLike(rng: IRng, cfg: WaveConfig, enemies: EnemyTable, difficulty: DifficultyTable): void;
  next(elapsedMs: number): SpawnSpec[];  // 경과시간까지 등장해야 할 스폰 명세 (렌더 무관)
  reset(rng: IRng): void;
}
```
> **부착 방식**: Phase 1은 `createRng(Date.now())`(랜덤). 랭킹 부착 시
> `createRng(hashSeed(date, difficulty, seasonId))`로 **시드 생성만 교체**, WaveGenerator
> 본체 불변. 서버는 동일 seed+config로 SpawnSpec을 재생성해 클라 기록 검증.

### 3.6 RemoteConfig (스텁 → 원격)
```ts
export interface IRemoteConfig {
  get<T = unknown>(key: string): T;        // 지금: 로컬 /data JSON, 나중: 원격 fetch
  getEnemies(): EnemyTable;
  getScoring(): ScoringConfig;
  getDifficulty(): DifficultyTable;
  getSkills(): SkillTable;
  ready(): Promise<void>;                  // 원격 도입 시 비동기 로드 지점 (지금 즉시 resolve)
}
```

### 3.7 Telemetry / RankingSystem (스텁)
```ts
export interface ITelemetry { track(event: string, props?: Record<string, unknown>): void; } // noop

export interface RunSubmission {            // 서버 검증 인터페이스 (§21.3) — 지금 미구현
  runToken: string; seed: number; difficulty: string;
  survivalMs: number; score: number; kills: number; maxCombo: number;
  lastSaveCount: number; remainingEnergy: number;
}
export interface IRankingSystem {
  beginRun(difficulty: string): Promise<{ runToken: string; seed: number }>; // 스텁: 로컬 seed
  submit(run: RunSubmission): Promise<void>;                                  // 스텁: noop
}
```

### 3.8 SkillSystem (Phase 1: Solar Lance)
```ts
export interface ISkillSystem {
  tick(dtMs: number): void;                       // 쿨타임 감소
  tryActivate(g: GestureResult, ctx: SkillContext): SkillActivation | null;
  // Solar Lance: 손 뗀 순간 직선 스냅샷 판정 (§9.2, §28-3/4)
}
export interface SkillActivation {
  skillId: "solar_lance";
  judgedHits: HitResult[];        // pointer-up 시점에 확정된 대상만 (이후 연출은 시각 전용)
  vfxLine: Segment;               // 연출용 — 판정에 영향 없음
}
```

---

## 4. 게임 루프

### 4.1 RAF + deltaTime + 고정 update 순서
product-plan §23.4. GameApp가 `requestAnimationFrame` 소유, `dt`(ms, 상한 클램프로
탭 백그라운드 점프 방지) 계산 후 GameScene.update(dt) 호출. **고정 순서**:

```text
1. input    GestureSystem 누적/판정 (pointer-up이면 판정 트리거)
2. spawn    WaveGenerator.next(elapsed) → OrbitSpawner → ObjectManager (풀에서 꺼냄)
3. movement Enemy 나선 갱신: angle += angularSpeed*dt; radius -= approachSpeed*dt;
            x=earthX+cos(angle)*radius; y=earthY+sin(angle)*radius (§15.1)
4. collision  슬래시/스킬 판정 → HitResult[]; 지구 충돌(radius ≤ R*swell*1.2)→ EnergySystem
5. scoring  ScoringSystem.onHit/onMiss, 콤보·LastSave·게이지 갱신
6. render   PixiJS: 적/지구/슬래시trail/이펙트 위치·scale·alpha 갱신, zIndex=layers
```
> dt 클램프(예: 50ms)로 저프레임에서도 판정 안정. 물리 단순(원/선분)이라 가변 dt 허용.

### 4.2 오브젝트 풀링
`ObjectManager`가 Enemy/슬래시trail/폭발 파티클을 **풀**로 관리 (product-plan §23.3).
파괴된 적은 destroy 대신 풀로 반환, 재사용. 동시 오브젝트 상한은 design §12 표
(S1 5~8 ... S8 16~24) 참조 — Phase 1은 단일 난이도라 상한만 풀 크기로 둠.

### 4.3 레이어 순서 (design §10, `layers.ts`)
```text
L0 배경우주  L1 별/네뷸라  L2 궤도가이드  L3 적trail  L4 적  L5 아군(LATER)
L6 shield외곽  L7 지구  L8 shield전경  L9 슬래시trail/스킬VFX  L10 폭발
L11 HUD패널  L12 텍스트(HTML/Canvas)  L13 튜토/경고 오버레이
```
PixiJS `sortableChildren` + 컨테이너별 고정 zIndex 상수. 텍스트는 이미지에 굽지 않음
(design §6).

---

## 5. 테스트 전략 (HYBRID 강도 — Owner 선호)

순수 로직 = vitest TDD, UI = Vite live preview 검증.

### 5.1 vitest 단위 테스트 (순수 로직, PixiJS 무관)
- `segmentIntersectsCircle`: 교차/접점/비교차, 선분 양 끝점이 원 안/밖 케이스.
- `distanceBand`: 경계값(4.0R/3.0R/2.0R/1.3R/1.2R) 정확한 밴드 매핑.
- ScoringSystem 공식: 기본×거리×정확도×콤보 — 표 기반 케이스, 콤보 구간 경계(4→5,9→10,19→20,29→30).
- 콤보 끊김/유지(LastSave 유지) 로직.
- `Rng` 결정성: 같은 seed → 동일 시퀀스 (스냅샷); 다른 seed → 다른 시퀀스.
- `WaveGenerator` 결정성: 같은 seed+config → 동일 `SpawnSpec[]` (서버 재현 보장 핵심).
- GestureSystem 분류 지표:
  - `straightness`: 완전 직선=1.0 근접, 지그재그=낮음, Solar Lance 임계 0.88 경계.
  - `totalTurn`/`polygonEnclosesPoint`: 원이 지구 둘러쌈(circle), 안 둘러쌈.
  - `countSharpVertices`: 삼각형=3, 직선=0 (Delta Shield 부착 대비).
  - spiral 각도 누적: 180도+ 회전 감지 (Gravity Slow 부착 대비).
- EnergySystem: 피해 누적, 0 도달 게임오버 신호 정확히 한 번.

### 5.2 live preview 검증 (UI/렌더)
- `vite preview`/dev 서버에서 실제 슬래시 손맛, 나선 접근 시각, 지구 **크기 규칙**
  (body ≤330px, design §2.2) 육안 확인.
- HUD 텍스트 ko/en 토글, safe-area, 60fps 체감.
- 마일스톤에서 gstack `review`/`qa` + `verification-before-completion` 적용.

### 5.3 검증 명령 (예시 — 실제 스캐폴딩 후)
```bash
npm run test           # vitest 순수 로직
npm run test -- --coverage
npm run dev            # live preview 손맛/시각 확인
npm run build && npm run preview
npx tsc --noEmit       # 타입 체크
```

---

## 6. Apps in Toss WebView 노트

- **성능**: 60fps 목표 / 저사양 30fps 바닥 (product-plan §23.3). Object Pooling 필수,
  Sprite Atlas, 파티클 제한, 무거운 필터 최소화, 입력/충돌 경량(원·선분).
- **DOM 최소화**: 게임필드는 PixiJS만. React/HTML은 메뉴·결과·HUD 텍스트 래퍼에만 (§28-1).
- **safe-area**: design §3 top/bottom 40~80, 내부 좌표 1080x1920 고정 + `scale =
  min(sw/1080, sh/1920)` 반응형. 하단 스킬 startY ≥ 1540 (design §12).
- **플랫폼 어댑터 경계(스텁)**: `PlatformAdapter`로 login/ads/IAP/storage/haptics 추상화.
  Phase 1은 `WebStubAdapter`(noop). Apps in Toss SDK / Google Play 구현은 LATER —
  product/domain 로직이 플랫폼 SDK를 직접 import 하지 않음 (CLAUDE.md app platform 규칙).

---

## 7. 백엔드 준비 (인터페이스만, 구현 deferred)

- 랭킹 서버 + **Run Token** + 고정 시드 + 기록 검증은 **서버 측**(§21.3) — Phase 6.
  지금은 §3.7 `IRankingSystem` 인터페이스만 두고 로컬 스텁.
- **검증 가능 설계가 핵심**: `WaveGenerator`(시드 결정성) + `ScoringSystem`(순수 재계산)
  분리 덕에 서버가 동일 seed/config로 스폰·점수를 재현해 클라 기록을 대조할 수 있음.
- **Supabase**: 공유 프로젝트 `dr.kang-mini-project`(`jwnuxxxthzkeiiuqopir`), `public`
  스키마, 테이블 접두사 `orbitslash_` (예: `orbitslash_runs`, `orbitslash_scores`).
  사용자/계정 매핑은 공유 `core_`/`identity_`/`authmap_` 사용, Toss 신원 raw 저장 금지,
  RLS 기본 on, 서비스롤/시크릿 클라 노출 금지 (CLAUDE.md). 스키마/마이그레이션은
  Owner 명시 승인 시 작성·검토.
- **AI**: 현재 사용자 대면 AI 기능 없음 → **AI UX disabled for this stage** (기록). AI
  어댑터/서버 프록시 경로는 backend-ready 스텁으로만 남김 (CLAUDE.md AI readiness 규칙).
- **시크릿 금지**: 서비스롤 키/DB 비번/AI 키 클라이언트 노출 금지. 공개 env는
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`만.

---

## 8. i18n ko/en 스캐폴드 (처음부터)

- `/i18n/index.ts` `t(key)` 라우터, 기본 `ko`, `en` 선택 가능 (첫 버전부터, CLAUDE.md).
- 사용자 대면 문자열 하드코딩 금지: HUD, 결과, 콤보/LastSave 라벨(`LAST SAVE!`/`지구
  직전 방어!`), Multi Cut 표기(Double/Triple/Mega/Orbital Master), 에러/빈 상태/온보딩
  전부 로케일 경유.
- 게임필드 텍스트도 키 기반 (Canvas Text 렌더 시에도 `t()` 통해 문자열 취득).

---

## 9. Phase 1 작업 순서 (작게, 리뷰 가능 단위) + 검증

> 각 단계는 독립 리뷰/머지 가능 단위. 순수 로직은 테스트 먼저(TDD).

1. **부트스트랩**: Vite+TS+PixiJS 프로젝트, `main.ts`/`GameApp` RAF 빈 루프, 1080x1920
   반응형 캔버스, 검은 우주 배경. 검증: `npm run dev`로 캔버스 표시.
2. **좌표·레이어·지구**: `coords.ts`/`layers.ts`, `Earth` 렌더 (body ~300px, shield
   ~420px, center 540,900). 검증: 지구 크기 규칙(≤330px) 육안 + 화면 비율.
3. **데이터 + RemoteConfig 스텁**: `/data/*.json` 4종, `RemoteConfig.get*()` 로컬 반환.
   검증: 시스템이 매직넘버 없이 JSON 값 사용.
4. **Rng + WaveGenerator (TDD)**: 시드 결정성 테스트 먼저 → 구현. 검증: vitest 결정성 통과.
5. **OrbitSpawner + Enemy 나선 이동**: SpawnSpec→적 생성, §15.1 이동, ObjectManager 풀링.
   검증: 적이 바깥에서 나선으로 지구 접근하는 live preview.
6. **GestureSystem (TDD 지표) + 슬래시 trail**: points[] 누적, straightness/turn/enclose/
   vertex 순수 함수 테스트 → pointer 이벤트 배선 + L9 trail 렌더. 검증: 단위테스트 +
   긋기 잔상 육안.
7. **CollisionSystem (TDD)**: `segmentIntersectsCircle`/`distanceBand`/Multi Cut 테스트
   먼저 → 슬래시 vs 적 판정 배선. 검증: 적이 베여 사라짐 + Multi Cut 카운트.
8. **EnergySystem + 게임오버**: 지구 충돌 피해, Earth Energy 100→0, 게임오버 신호 +
   지구 상태 연출(§11.3). 검증: 적 도달 시 에너지 감소, 0이면 ResultScreen.
9. **ScoringSystem + 콤보 + Last Save (TDD)**: 공식·콤보·거리배율(LastSave x3.5) 테스트
   먼저 → 배선, HUD 점수 표시. 검증: 단위테스트 + 거리별 점수 차이 체감.
10. **SkillSystem: Solar Lance**: 게이지/쿨타임 골격 + 직선 제스처 판정(직선성 0.88,
    길이 60%, 지구 관통) + **pointer-up 스냅샷 판정** + 레이저 VFX(시각 전용). 검증:
    직선 그어 일렬 적 관통, 연출 중 늦게 지나간 적 안 맞음(§28-4).
11. **i18n + HUD 마감**: ko/en 토글, 라벨 키화, HUD 텍스트(HTML/Canvas). 검증: 언어
    토글 시 문자열 변경.
12. **마일스톤 검증**: gstack `review` → `qa`(live preview) → `verification-before-
    completion`. 검증 명령 §5.3 일괄 실행, Graphify/UA 갱신 판단.

---

## 10. 리스크 & 오픈 이슈 (Owner 확인 필요)

1. **렌더 엔진 확정**: product-plan §0은 "PixiJS 또는 Phaser", 본 작업 지시는 PixiJS.
   PixiJS로 확정 진행 가정. 다른 선택이면 알려주세요. (가정 — 검증 필요)
2. **Phase 1 난이도 단일화**: 1차는 Rookie 단일로 구현하고 난이도 선택 UI는 Phase 5에
   붙이는 게 효율적. difficulty.json은 4종 다 두되 실사용 1종. 동의 여부?
3. ✅ **RESOLVED — 점수 SSOT**: `enemies.json.score` 단일출처. scoring.json은 배율·
   Multi Cut 보너스·게이지만. (§2.2 반영)
4. **거리밴드 경계 데이터 위치**: §4.2 밴드 경계(R 배수)를 difficulty.json에 넣을지
   별도 zones 키로 분리할지. Remote Config 조정 대상이므로 데이터화는 확정, 파일 위치만 결정 필요.
5. ✅ **RESOLVED — Solar Lance Phase1 게이지**: §10.1 중 P1 존재 소스(일반+1/큰소행성
   +2/콤보+2/LastSave+8) + 개발용 디버그 충전 토글. 방향베기/보스/구조대 게이지는 기능
   구현 시 부착. (§2.2 gaugeGain, §2.4 _debug 반영)
6. ✅ **RESOLVED — Multi Cut↔콤보**: 콤보 += N(처치 마릿수) + Multi Cut 별도 flat
   보너스. `comboGainPerSlashCap` 레버(기본 null). 인플레는 텔레메트리 기반 주간 패치로
   조정(아키텍처 불변). (§2.2, §3.4 반영)
7. **design_sample 에셋 사용 여부**: Phase 1을 플레이스홀더 도형(원/스프라이트)으로
   갈지, design_sample 에셋을 바로 쓸지. (권장: Phase 1은 플레이스홀더로 손맛/판정 확정
   후 에셋 교체 — 판정과 아트 분리)
8. **Supabase 스키마 착수 시점**: orbitslash_runs/scores 마이그레이션을 지금 작성만
   해둘지(서버 검증 인터페이스 확정용) Phase 6까지 미룰지. (권장: 인터페이스 타입만
   확정, SQL은 Phase 6에 Owner 승인 후)
