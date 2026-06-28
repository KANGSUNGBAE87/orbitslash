// 레이어 zIndex 상수 (design §10, implementation-plan §4.3).
// PixiJS sortableChildren + 컨테이너별 고정 zIndex. 텍스트는 이미지에 굽지 않음.

export const LAYER = {
  BACKGROUND_SPACE: 0, // L0 배경우주
  STARS_NEBULA: 1, // L1 별/네뷸라
  ORBIT_GUIDE: 2, // L2 궤도 가이드
  ENEMY_TRAILS: 3, // L3 적 trail
  ENEMIES: 4, // L4 적
  FRIENDLY: 5, // L5 아군 (LATER)
  EARTH_SHIELD_OUTER: 6, // L6 shield 외곽
  EARTH: 7, // L7 지구
  EARTH_SHIELD_FOREGROUND: 8, // L8 shield 전경
  SLASH_VFX: 9, // L9 슬래시 trail / 스킬 VFX
  EXPLOSION: 10, // L10 폭발/데미지
  HUD_PANELS: 11, // L11 HUD 패널
  TEXT: 12, // L12 텍스트 (HTML/Canvas)
  OVERLAY: 13, // L13 튜토/경고 오버레이
} as const;

export type LayerKey = keyof typeof LAYER;
