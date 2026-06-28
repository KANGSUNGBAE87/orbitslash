# /ui — 메뉴/결과/HUD 래퍼 (게임필드 아님)

게임플레이는 PixiJS Canvas/WebGL (product-plan §28-1). 이 폴더는 메뉴·결과·HUD
**텍스트** 래퍼 전용이다. 텍스트·숫자는 이미지에 굽지 않고 HTML/CSS 또는 Canvas Text로
렌더한다 (design §6).

## Phase 1 상태

Phase 1 UI는 최소다. React는 아직 추가하지 않았다 (스택은 Vite+TS+PixiJS). HUD 오버레이
배선은 Subagent B 담당이다. 사용자 대면 문자열은 전부 `src/i18n` `t(key)`를 경유한다 —
하드코딩 금지.

## TODO(Phase1-B)

- HudOverlay: 점수/생존시간/에너지/Threat/콤보/Last Save 라벨 (i18n 키 사용).
- StartScreen: 시작 버튼.
- ResultScreen: 점수/생존시간 표시.
- 구현 방식(React 도입 여부)은 B가 HUD 배선 시 결정. 도입 시 package.json에
  react/react-dom + @vitejs/plugin-react 추가.

## TODO(LATER)

- RankingScreen (Phase 6), ModeSelectScreen (Phase 5).
