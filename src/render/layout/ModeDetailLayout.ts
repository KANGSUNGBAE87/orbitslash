import { computeRootFit, type SafeAreaInsets } from "../../game/coords";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ModeDetailLayout {
  body: Rect;
  difficultyControls: Rect;
  practiceControls: Rect;
  bossControls: Rect;
  start: Rect;
  secondaryActions: Rect;
  minimumCssTouchHeight: number;
  rootFitScale: number;
}

export interface ModeDetailViewport {
  width: number;
  height: number;
  safeArea?: SafeAreaInsets;
}

export function modeDetailLayout(viewport: ModeDetailViewport, modeId: "freeDefense"): ModeDetailLayout {
  void modeId;
  const rootFit = computeRootFit(viewport.width, viewport.height, viewport.safeArea);
  const touchHeight = Math.ceil(48 / rootFit.scale);
  const bottomMargin = 90;
  const controlGap = 20;
  const start = { x: 350, y: 1920 - bottomMargin - 20 - touchHeight * 2, w: 380, h: touchHeight };
  const secondaryActions = { x: 350, y: start.y + start.h + 20, w: 380, h: touchHeight };
  const bossControls = { x: 96, y: start.y - 16 - (touchHeight * 2 + 12), w: 888, h: touchHeight * 2 + 12 };
  const practiceControls = { x: 126, y: bossControls.y - controlGap - touchHeight, w: 828, h: touchHeight };
  const difficultyControls = { x: 92, y: practiceControls.y - controlGap - touchHeight, w: 896, h: touchHeight };
  const bodyHeight = Math.max(100, Math.min(170, difficultyControls.y - 454));
  const body = { x: 90, y: difficultyControls.y - bodyHeight - 24, w: 900, h: bodyHeight };
  return {
    body,
    difficultyControls,
    practiceControls,
    bossControls,
    start,
    secondaryActions,
    minimumCssTouchHeight: touchHeight * rootFit.scale,
    rootFitScale: rootFit.scale,
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
