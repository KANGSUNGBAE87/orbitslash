---
version: 1.1
status: approved
updated: 2026-06-28
canonical: true
---

# Orbit Slash — Design Plan (디자인 구현 기획문 v1.1)

> Owner 전달 디자인 기획문 + `design_sample/` 레퍼런스 19장 카탈로그. 시각 SSOT.
> 핵심: **이미지의 3D-feel·네온 UI·색감·HUD는 최대한 비슷하게, 단 실제 게임 화면의
> 지구는 훨씬 작게 (화면 높이 약 1/6 이하).**

## Change Log

- 2026-06-28 (claude): 디자인 기획문 v1.1 등록 + design_sample 19장 시각 확인·카탈로그화.
- 2026-06-28 (claude): v1.2 — Owner 지시로 게임 화면 지구 크기 기존 1/3 축소
  (body 300→100, shield 420→140, Last Save 링 520→174). §2.2/§2.3 갱신. 코드 coords.ts 동기화.
  운석 radiusPx는 미변경(상대적으로 커짐 — 필요 시 후속 조정).

---

## 0. 핵심 한 줄

> 홈 화면은 레퍼런스처럼 크고 화려한 지구 중심 브랜딩 화면. 실제 게임 화면은 같은
> 3D-feel 스타일 유지하되 지구를 화면 높이 1/6 이하로 줄이고 운석·구조대·보스·스킬
> 이펙트가 움직일 넓은 플레이 공간 확보. 색감·UI 느낌은 따라가되 플레이 지구 크기만 줄임.

---

## 1. 전체 비주얼 방향

### 1.1 스타일
**2.5D / 3D-feel 모바일 아케이드 UI** (2D 플랫 금지).
키워드: premium 3D-feel mobile arcade, glossy sci-fi UI, neon cosmic defense,
deep navy space bg, cyan electric blue energy, orange red meteor danger,
low-poly stylized Earth, beveled futuristic HUD panels, glowing circular skill
buttons, cinematic but readable.

### 1.2 색상 규칙
| 요소 | 색상 |
|------|------|
| 배경 | 딥 네이비, 블랙 퍼플, 어두운 우주 |
| 지구/방어막 | 시안, 일렉트릭 블루, 화이트 |
| 적 운석/위험 | 오렌지, 레드, 용암색 |
| 얼음 계열 | 아이스 블루, 화이트 블루 |
| 중력/블랙홀 | 퍼플, 바이올렛 |
| 아군/구조대 | 블루, 화이트, 그린 |
| 주요 CTA 버튼 | 골드, 오렌지 |
| 랭킹/고급 보상 | 골드, 퍼플 |

### 1.3 그래픽 톤
지구=로우폴리 3D 구체(대륙 단순 초록, 바다 깊은 블루). 방어막=시안 글로우 링+얇은
육각 그리드. 운석=울퉁불퉁 3D 암석+오렌지 용암 균열. UI=광택 메탈 패널+네온 테두리.
버튼=납작X, 살짝 돌출 3D. 스킬 버튼=원형 캡슐/렌즈. 배경=우주지만 과복잡 금지.

---

## 2. ⭐ 지구 크기 규칙 (가장 중요)

레퍼런스 스테이지 목업은 아트 방향은 좋지만 **지구가 너무 크다. 그대로 따라하지 말 것.**

### 2.1 홈 화면 (커도 됨, 브랜딩)
```text
지름: 화면 가로 55~65% / 세로 28~35%
1080x1920 기준 약 580~700px (centerY 650~720, body 620, shield 760)
```

### 2.2 게임 화면 (작아야 함) — v1.2 Owner 축소
```text
v1.2 (2026-06-28 Owner 지시): 기존 대비 1/3 축소 적용.
1080x1920 기준 body 100px, shield 140px (기존 body 280~330 → 100).
이유: 운석·구조대·보스·스킬 이펙트 플레이 공간 더 넓게.
절대 500px 이상 금지 (보스전에서도). 원래 1/6 가이드보다 더 작음(약 1/19).
```

### 2.3 플레이 화면 기준 좌표 (1080x1920) — v1.2
```text
Earth center X = 540
Earth center Y = 860~940 (구현 기본 900)
Earth body diameter = 100   (v1.2, 기존 300의 1/3)
Earth shield diameter = 140  (v1.2, 기존 420)
Last Save ring diameter = 174 (v1.2, 기존 520)
Outer orbit radius = 700~850
```
| 화면 | 지구 중심 Y |
|------|--:|
| 일반 스테이지 | 870~920 |
| 보스 스테이지 | 1000~1080 |
| 최종 보스 | 1020~1100 |
| 튜토리얼 | 820~880 |
보스가 위쪽에 크게 등장하면 지구를 아래로 내림.

---

## 3. 기본 해상도

세로 9:16, base 1080x1920. safe area top/bottom 40~80.
```ts
const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;
const scale = Math.min(screenWidth / BASE_WIDTH, screenHeight / BASE_HEIGHT);
```
반응형 구현, 내부 좌표계는 1080x1920 기준.

---

## 4. 홈 화면

레이아웃 (1080x1920):
```text
Y 0~150      상단 HUD (좌 에너지+ / 중 시즌·타이머 / 우 Threat·이벤트)
Y 160~360    Orbit Slash 로고 (메탈릭 3D)
Y 380~950    대형 지구 + 우주 배경 + 운석/위성
Y 980~1120   START 버튼 (골드, x180 y980 w720 h130, 3D 베벨, press scale)
Y 1160~1650  6개 모드 카드 (3열x2행, card 300x170 gap 30, startX 60 startY 1160)
Y 1700~1840  Settings / Collection
```
모드 카드 색상: Story=블루, Free Defense=그린, Ranked=퍼플, Boss Rush=레드,
60s Blitz=시안, Daily=골드. 각 카드: 아이콘+모드명+상태문구+진행도/보상.
하단 Settings(좌)/Collection(우). 강화 없지만 스킨/칭호/이펙트 위해 Collection 유지.

---

## 5. 게임 플레이 화면 공통

레이아웃 (1080x1920):
```text
Y 0~160      상단 HUD
Y 160~260    스테이지명/보스명/미션 요약
Y 260~1420   실제 플레이 필드
Y 1420~1560  경고/콤보/실드바/튜토리얼 메시지
Y 1560~1840  스킬 버튼 영역
Y 1840~1920  하단 안전영역 / Pause
```
플레이 필드 궤도:
```text
Earth center = (540, 900)
Orbit lane 1/2/3/4 radius = 260 / 420 / 580 / 760
Spawn radius = 850~980
```
지구 주변 링 시각 강도:
| 링 | 강도 |
|------|------|
| Earth shield | 강함 |
| Last Save zone | 평소 약함, 위험 시 강함 |
| Orbit guide | 매우 약함 |
| Skill ring | 게이지 찼을 때만 강함 |

---

## 6. HUD

상단: 좌 Earth Energy / 중 Score 또는 Timer / 우 Threat Gauge.
- 좌: 번개·방패 아이콘 + `120/120` + MAX/남은 시간
- 중: 스토리 `SCORE 1,250` / 랭킹 `TIME 01:24.52` / 보스 `BOSS Ringed Destroyer`
- 우: 해골·위험 마크 + 세그먼트 바(오렌지→레드) + `THREAT 78%`

**텍스트 구현 원칙**: 배경 패널·아이콘·버튼 프레임은 이미지/스프라이트 OK. **실제
텍스트·숫자는 HTML/CSS 또는 Canvas Text로 렌더** (이미지에 굽지 말 것 — 왜곡·다국어·
실시간·해상도 대응).

---

## 7. 스킬 버튼

위치 하단 고정 Y 1580~1760. 보통 4~5개.
크기: 기본 지름 130~150, 강조 170~190 (중앙 강조 시 크게).
스타일: 원형 3D 렌즈 + 내부 아이콘 + 네온 테두리 + 쿨타임 숫자 + 원형 게이지
프로그레스 + 사용가능 pulse glow + 불가 시 dim.

스킬 색상: Orbital Cut=시안/블루, Solar Lance=골드/오렌지, Gravity Slow=퍼플,
Delta Shield=시안/화이트, Missile/Plasma=오렌지/레드, Repair/Rescue=그린.

> ⚠️ **스킬 이름 충돌 주의**: 목업 이미지엔 Laser Strike, Plasma Burst, Missile
> Barrage, Frost Bomb, Black Hole, Hyper/Repair Drone 등 다양한 버튼명이 보임.
> **canonical 스킬 = product-plan §8의 4종** (Orbital Cut, Solar Lance, Gravity
> Slow, Delta Shield). 목업의 추가 버튼명은 아트 시안일 뿐, 실제 스킬셋은 4종 기준.
> 목업의 "Orbital Slash" = plan의 "Orbital Cut". 확장은 Owner 승인 시에만.

---

## 8. 스테이지별 화면 (Story 1~8)

분위기 유지, **지구 크기는 반드시 작게**. (각 스테이지 목업 → design_sample 카탈로그 §16 참조)

- **S1 First Impact** (centerY 850, body 320): 기본 슬래시 튜토. 깔끔, 운석 적음,
  손가락 가이드, 시안 슬래시 경로. "Swipe to slash incoming meteors". 3 스킬.
- **S2 Orbital Defense** (centerY 900, body 300): 소용돌이 궤도+콤보. 여러 나선
  운석 라인, COMBO 박스, Multi Cut. 4 스킬.
- **S3 Friendly Signals** (centerY 900, body 300): 베면 안 되는 아군. Rescue
  Shuttle/Capsule, Energy Capsule, Mission Panel. 아군=시안/블루/화이트/그린,
  적=오렌지/레드 색 분리 필수. 5 스킬.
- **S4 Element Storm** (centerY 900, body 300): 좌 화염/우 얼음. Fire/Ice 대비 강하게,
  얼음 파괴 시 분열. 화려해도 지구 키우지 말 것. 5 스킬.
- **S5 Precision Cut** (centerY 920, body 300): 방향 베기. 금속 운석에 오렌지
  절단선+양끝 화살표 (metal asteroid 지름 90~130, 일반보다 크게). 오발 시 튕김,
  성공 시 스파크+분리. "Slash in the direction of the lines". 3~4 스킬.
- **S6 Planet Threat** (centerY 1050, body 290): 첫 보스. Ringed Destroyer 상단
  거대(450~600), Boss HP Bar, 약점=오렌지 코어, 고리 조각 발사. Solar Lance 강조(골드). 5 스킬.
- **S7 Gravity Crisis** (centerY 1020, body 290): 퍼플 중력 소용돌이 상단, 궤도 휘어짐,
  가장자리 렌즈 왜곡. Gravity Slow 강조. **visual distortion ≠ collision distortion**
  (보이는 건 화려, 판정은 원/선분 단순). 5 스킬.
- **S8 Final Orbit** (centerY 1080, body 280~300): 최종전. Dark Core 보스 상단
  (500~650), 지구서 방어 레이저 사방 발사, 다방향 탄막. 퍼플/블랙 위협 vs 시안 방어
  대비 강하게. 모든 스킬. 충분한 빈 공간 확보.

---

## 9. 기타 모드 화면

- **Ranked League**: 타이틀 + 난이도 4탭 (Rookie 블루 / Defender 그린·시안 /
  Elite 퍼플 / Master 골드·레드) + 랭킹 리스트(코드 텍스트).
- **Free Defense**: 차분한 블루/그린. 난이도·스킬·보스 연습, 광고 부활 안내.
- **Boss Rush**: 보스 5종 거대 3D-feel 카드.
- **60s Blitz**: 중앙 큰 60초 타이머 링 + 빠른 운석 배경 + Start Challenge + 오늘 최고점. 시안+오렌지.
- **Daily Challenge**: 오늘 규칙/보상/남은 시간/시작. 골드/퍼플.

---

## 10. 구현 레이어 구조

```text
L0 Background space      L1 Far stars/nebula     L2 Orbit guide lines
L3 Enemy trails          L4 Enemies              L5 Friendly objects
L6 Earth shield outer    L7 Earth                L8 Earth shield foreground
L9 Slash trail/skill VFX L10 Damage/explosion    L11 HUD panels
L12 Text                 L13 Tutorial/warning overlays
```
원칙: 텍스트 이미지에 굽지 않기 / HUD 패널 재사용 컴포넌트 / 운석·지구·스킬 스프라이트
분리 / **게임 화면을 한 장 배경 이미지로 만들지 말 것**.

---

## 11. 3D 느낌 구현 (실제 3D 엔진 없이)

- **2.5D Sprite**: 지구·운석=3D 렌더 느낌 PNG/WebP, UI=베벨 3D 패널, 이펙트=글로우
  PNG+additive blending, 이동=PixiJS/WebGL rotate/scale/alpha/blur.
- **운석 깊이감**: 궤도 위치별 scale — 멀리 0.5~0.7 / 가까이 1.0~1.4 / Last Save 1.2~1.6.
- **지구 깊이감**: 스프라이트 아주 느린 rotate + 대륙 하이라이트 천천히 shift +
  shield ring 별도 회전 + hex grid 미세 pulse.
- **UI 깊이감**: outer/inner glow, beveled frame, subtle drop shadow, button press
  scale, light sweep, active pulse.

---

## 12. 피해야 할 것

- **지구 과대 금지**: 게임 화면 지름 최대 330px (보스전도 320px).
- **운석 과다 금지** (동시 오브젝트):
  | 상황 | 수 |
  |------|--:|
  | S1 | 5~8 | S2 | 8~14 | S3 | 10~16 | S4 | 12~20 |
  | S5 | 8~14 | S6 Boss | 8~16+Boss | S7 | 12~18 | S8 | 16~24+Boss |
- **HUD가 플레이 가리면 안 됨**: 하단 스킬 `startY >= 1540`.
- **이펙트가 판정/아군·적 구분 가리면 안 됨**.

---

## 13. design_sample 레퍼런스 카탈로그

폴더: `design_sample/` — 19장. 2묶음. **자산팩(에셋 묶음) + 화면 목업.** 스타일·색감·
HUD·에셋 형태의 시각 기준. 단 목업의 게임 지구 크기는 §2 규칙으로 축소 적용.

### 13.1 자산팩 (`03_21` 배치, 10장)
1. **(1) UI 화면 목업 그리드** — 홈/모드선택/스테이지맵/플레이/Victory·Game Over 다이얼로그 썸네일.
2. **(2) 지구 상태 + 링/바/버튼 + 에셋 행** — 지구 4상태(건강 블루→균열→레드 위험),
   글로우 링, threat 세그먼트 바, 스킬 렌즈 버튼, 로켓/위성/캡슐/암석/젬.
3. **(3) 운석 에셋** — 소→대 암석, 화염 운석(오렌지 trail), 얼음 혜성(블루 trail), 크리스탈 파편, 얼음-지구 파편.
4. **(4) 방향 베기 운석 + 특수적** — 절단선 |/—/// 금속 운석 + 크리스탈, 실드락(블루),
   일렉트릭(레드/블루), 중력(퍼플), 독성(그린), 블랙홀, 장갑 코어, 장갑 지구파편.
5. **(5) 아군 오브젝트** — 위성, 에너지/구조 캡슐, 구조선(Rescue Shuttle), 우주선, 방어 터렛.
6. **(6) 보스/대형 적 에셋** — Graviton(퍼플 고리), Lava Titan, Ice Colossus, 블루 코어, 블랙홀 코어 + 발사체.
7. **(7) 스킬 VFX** — Orbital Cut 링, Solar 버스트, Solar Lance, 폭발, 중력 소용돌이,
   Delta Shield 삼각형, 슬래시 trail(블루/오렌지), 화염/크리스탈 산란, 타게팅 레티클.
8. **(8) HUD 키트** — 바, 게이지, 원형 아이콘 버튼, 계급 배지, 트로피, 티켓, 보물상자, 패널/프레임.
9. **(9) 스테이지 배경 카드** — 8장 세로 테마 카드 (스테이지/모드 배경 후보).
10. **(10) 제스처 모션 가이드** — 슬래시, Orbital Cut 원, Solar Lance 직선, Gravity
    Slow 소용돌이, Delta Shield 삼각형 + 손 커서 + 스킬 아이콘 버튼. **제스처 구현 직접 참조.**

### 13.2 화면 목업 (`03_26` 배치, 9장)
1. **(1) 홈 화면** — ORBIT SLASH 메탈릭 로고, 대형 지구+시안 방어막, 에너지 120/120,
   SEASON 3, THREAT 78%, 골드 START, 6 모드 카드(Story 48/180, Free Defense Endless
   Waves, Ranked Platinum II, Boss Rush, 60s Blitz, Daily), Starter Pack, Settings/Collection. **지구 큼=홈은 OK.**
2. **(2) S1 First Impact** — 대형 지구+블루 슬래시 호+손, score 1250, threat 42%,
   "Swipe around the planet to slash incoming meteors", 3 스킬(Orbital Slash/Defense
   Field/Plasma Strike). **지구 큼 → §2로 축소 필요.**
3. **(3) S2 Orbital Defense** — 나선 운석 라인, COMBO x18, 위성, 4 스킬(Laser Strike/Shield Boost/Time Slow/Missile Barrage).
4. **(4) S3 Friendly Signals** — 구조선/에너지 캡슐/위성, Mission 패널(Protect rescue
   shuttle/Protect all capsules 4/5/Defeat all meteors 12/25), 5 스킬, shield 100%.
5. **(5) S4 Element Storm** — 좌 화염/우 얼음, COMBO 68, Planet Shield 8750/10000, 5 스킬(Laser/Black Hole/Orbit Slash ∞/Shield/Frost Bomb).
6. **(6) S5 Precision Cut** — 오렌지 절단선+화살표 금속 운석, score+best, 별 진행도,
   "SLASH IN THE DIRECTION OF THE LINES", 3 스킬, 하단 HP/TIME 01:24/ENEMIES 12/18.
7. **(7) S6 Planet Threat** — Ringed Destroyer 보스 상단(용암 고리), HP 8.45M/12M x12,
   지구 하단, 5 스킬(Orbital Shield/Plasma Burst/**Solar Lance 골드 강조**/Gravity Well/Hyper Drone).
8. **(8) S7 Gravity Crisis** — 퍼플 중력 소용돌이 상단, 휜 궤도, COMBO 23 x2.3, Starter
   Pack, shield 9820/10000, "DANGER! GRAVITY INSTABILITY", 5 스킬(Laser Cannon/Rocket
   Barrage/**Gravity Slow 강조**/Repair Drone/Orbital Strike), Auto Defense/x2 Speed 토글.
9. **(9) S8 Final Orbit** — Dark Core 보스 상단(퍼플 포탈), HP 12.45M/15M x12, 지구서
   블루 방어 레이저 사방 발사, 하단 우주선, 5 스킬(Shield/Missile/Black Hole/Laser/Meteor).

> 목업 ↔ 기획 차이 (기록): ① 게임 화면 지구 크기 → §2로 축소 (목업이 큼). ②
> 스킬 버튼명 다양 → canonical 4종 기준(§7 경고). 목업은 시각 톤·HUD·에셋·연출 기준,
> 게임 규칙/스케일은 product-plan + 본 문서 §2/§7 우선.

---

## 14. 디자인 작업 순서 (권장)

1. design-preflight (colors.io/Coolors 팔레트 확정 + React Bits 적합성) — 이미 강한
   아트 방향 존재하므로 검증·토큰화 위주.
2. 색/타이포/스페이싱 디자인 토큰 정의 (위 색상 규칙 기반).
3. 재사용 HUD/버튼/스킬버튼/패널 컴포넌트 스펙.
4. 지구·운석·스킬 VFX 스프라이트 파이프라인 (design_sample 에셋 활용/대체).
5. 제스처 입력 비주얼 (슬래시 trail, 스킬 모션 가이드 — sample (10) 참조).
6. ui-ux-pro-max로 design-verification (convergence=검증, divergence=후보만).
