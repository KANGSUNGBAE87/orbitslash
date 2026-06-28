# Session Log — Orbit Slash 디자인 기획문 + 샘플 등록

- Date: 2026-06-28
- Actor: claude
- Stage: design spec

## User Request
디자인 기획문 v1.1 전달 + `design_sample/` 폴더(19장 PNG: 에셋 묶음 + 화면 목업)
전부 확인해서 기억. 3D 느낌 최대한 살리고, 나중에 스킬·슬래시 액션 구현 예정.

## Done
- design_sample 19장 전부 시각 확인 (Read image).
  - `03_21` 배치 10장 = 자산팩/UI 키트 (지구 상태, 운석, 방향 베기 운석, 아군,
    보스, 스킬 VFX, HUD 키트, 배경 카드, 제스처 모션 가이드).
  - `03_26` 배치 9장 = 화면 목업 (홈 + Story S1~S8 게임플레이).
- `ai/plans/design-plan.md` 생성 (v1.1, approved). 기획문 전문 + §13 샘플 카탈로그
  (이미지별 내용) + 충돌 기록.

## Key Decisions / Constraints
- **지구 크기 규칙(최우선)**: 홈은 크게 OK, 게임 화면은 body 280~330px(≤화면높이 1/6),
  shield 390~460px, 절대 500px+ 금지(보스전도). 목업이 크게 그려졌지만 그대로 따르지 말 것.
- base 좌표계 1080x1920, 세로 9:16, 반응형 scale.
- 텍스트/숫자는 이미지에 굽지 말고 코드 렌더 (다국어·실시간·해상도).
- 게임 화면을 한 장 배경 이미지로 만들지 말 것 → L0~L13 레이어 구조.
- 3D-feel = 2.5D 스프라이트 + glow + additive blend + 깊이감 scale, 실제 3D 엔진 불필요.

## Conflicts Flagged (목업 ↔ canonical)
1. 스킬 버튼명: 목업에 Laser/Plasma/Missile/Frost Bomb/Black Hole/Drone 등 다양 →
   **canonical 스킬 = product-plan §8의 4종** (Orbital Cut, Solar Lance, Gravity Slow,
   Delta Shield). 목업 "Orbital Slash" = "Orbital Cut". 확장은 Owner 승인 시만.
2. 게임 화면 지구 크기: 목업이 큼 → design-plan §2 축소 규칙 우선.

## Files Changed
- `ai/plans/design-plan.md` 생성.

## Risks / Notes
- 에셋 PNG 19장은 ChatGPT 생성물. 실제 게임 사용 시 스프라이트 분리/아틀라스/최적화 필요.
- design_sample은 `.graphifyignore`에 바이너리 제외 검토(용량 ~40MB). 소스 스캔 불필요.

## Next Steps
1. design-preflight (팔레트 토큰화 + React Bits 적합성) — 아트 방향 이미 강함, 검증 위주.
2. 디자인 토큰(색/타이포/스페이싱) + 재사용 HUD/스킬버튼 컴포넌트 스펙.
3. implementation-plan.md 1단계: 핵심 플레이 루프 (지구 작게 + 소용돌이 + 슬래시 + 충돌 + 에너지 + 점수).
4. 스킬/슬래시 제스처 구현은 sample (10) 모션 가이드 참조. Owner 명시적 구현 지시 대기.

## Promote to 지식저장소?
- 아직 불필요. 프로젝트-local 유지.
