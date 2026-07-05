# /ui — 메뉴/결과/HUD 래퍼 (게임필드 아님)

게임플레이는 PixiJS Canvas/WebGL (product-plan §28-1). 이 폴더는 메뉴·결과·HUD
**텍스트** 래퍼 전용이다. 텍스트·숫자는 이미지에 굽지 않고 HTML/CSS 또는 Canvas Text로
렌더한다 (design §6).

## Current State

UI는 React 없이 Vite + TypeScript + PixiJS로 유지한다. `src/render/AppShell.ts`
owns home, mode select/detail, records, settings, collection, DEV QA, and
result surfaces. `src/render/Hud.ts` owns the in-game HUD.

사용자 대면 문자열은 전부 `src/i18n` `t(key)`를 경유한다. 하드코딩 금지.

## Implemented Screens

- Home / mode grid / mode detail.
- Result with mode-specific stats and ranking submission state.
- Records with local and public-leaderboard boundary state.
- Collection with stored boss/special/title progress.
- Settings with locale switching.
- DEV QA launcher/recorder.
- In-game HUD with score, time, Threat, wave gauge, skill slots, boss hints,
  tutorial callouts, and bottom Earth Energy.

## Remaining UI Work

- Real-device/WebView readability QA.
- Final art/content replacement once approved assets are provided.
- Remote/live leaderboard presentation after identity-bound public rows are
  verified.
