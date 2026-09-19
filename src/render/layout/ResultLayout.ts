export interface ResultRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ResultLayoutInput {
  detailRows: number;
  unlockCards: number;
  /** Unlock cards rendered as full-width guides instead of compact grid pills. */
  featuredUnlockCards?: number;
  /** Bottom inset already converted to the 1080x1920 logical coordinate space. */
  safeBottom: number;
  /** Minimum logical height for each action row. The caller owns CSS-to-logical conversion. */
  touchHeight?: number;
  /** Root logical-to-CSS scale. Used only to preserve the 48 CSS px touch minimum. */
  rootFitScale?: number;
}

export interface ResultLayout {
  panel: ResultRect;
  header: ResultRect;
  statGrid: ResultRect;
  detailCard?: ResultRect;
  unlockCard?: ResultRect;
  unlockAction?: ResultRect;
  actions: ResultRect;
}

const PANEL: ResultRect = { x: 110, y: 410, w: 860, h: 1260 };
const PANEL_PADDING_X = 28;
const PANEL_PADDING_TOP = 30;
const PANEL_PADDING_BOTTOM = 30;
const SECTION_GAP = 18;
const DEFAULT_ACTION_HEIGHT = 88;
const FEATURED_UNLOCK_HEIGHT = 192;

export function resultLayout(input: ResultLayoutInput): ResultLayout {
  const detailRows = normalizedCount(input.detailRows);
  const unlockCards = normalizedCount(input.unlockCards);
  const featuredUnlockCards = Math.min(unlockCards, normalizedCount(input.featuredUnlockCards ?? 0));
  const compactUnlockCards = unlockCards - featuredUnlockCards;
  const safeBottom = normalizedInset(input.safeBottom);
  const rootFitScale = normalizedRootFitScale(input.rootFitScale);
  const actionHeight = Math.max(
    DEFAULT_ACTION_HEIGHT,
    normalizedTouchHeight(input.touchHeight),
    Math.ceil(48 / rootFitScale),
  );
  const contentX = PANEL.x + PANEL_PADDING_X;
  const contentWidth = PANEL.w - PANEL_PADDING_X * 2;

  const header: ResultRect = { x: contentX, y: PANEL.y + PANEL_PADDING_TOP, w: contentWidth, h: 128 };
  const statGrid: ResultRect = {
    x: contentX,
    y: header.y + header.h + SECTION_GAP,
    w: contentWidth,
    h: 240,
  };

  let cursorY = statGrid.y + statGrid.h;
  const detailCard = detailRows > 0
    ? {
        x: contentX,
        y: cursorY + SECTION_GAP,
        w: contentWidth,
        h: 72 + detailRows * 28,
      }
    : undefined;
  if (detailCard) cursorY = detailCard.y + detailCard.h;

  const unlockRows = Math.ceil(compactUnlockCards / 2);
  const unlockCard = unlockCards > 0
    ? {
        x: contentX,
        y: cursorY + SECTION_GAP,
        w: contentWidth,
        h: 52 + featuredUnlockCards * FEATURED_UNLOCK_HEIGHT + unlockRows * 48,
      }
    : undefined;
  if (unlockCard) cursorY = unlockCard.y + unlockCard.h;

  const unlockAction = unlockCard
    ? {
        x: contentX + 120,
        y: cursorY + SECTION_GAP,
        w: contentWidth - 240,
        h: actionHeight,
      }
    : undefined;

  const actions: ResultRect = {
    x: contentX,
    y: PANEL.y + PANEL.h - PANEL_PADDING_BOTTOM - safeBottom - actionHeight,
    w: contentWidth,
    h: actionHeight,
  };

  const lastStackRect = unlockAction ?? unlockCard ?? detailCard ?? statGrid;
  const stackShift = Math.max(0, lastStackRect.y + lastStackRect.h + SECTION_GAP - actions.y);
  const panel = {
    ...PANEL,
    y: PANEL.y - stackShift,
    h: PANEL.h + stackShift,
  };

  return {
    panel,
    header: shiftUp(header, stackShift),
    statGrid: shiftUp(statGrid, stackShift),
    detailCard: detailCard ? shiftUp(detailCard, stackShift) : undefined,
    unlockCard: unlockCard ? shiftUp(unlockCard, stackShift) : undefined,
    unlockAction: unlockAction ? shiftUp(unlockAction, stackShift) : undefined,
    actions,
  };
}

export function rectsOverlap(left: ResultRect, right: ResultRect): boolean {
  return !(
    left.x + left.w <= right.x
    || right.x + right.w <= left.x
    || left.y + left.h <= right.y
    || right.y + right.h <= left.y
  );
}

function normalizedCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizedInset(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizedTouchHeight(value: number | undefined): number {
  return value != null && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizedRootFitScale(value: number | undefined): number {
  return value != null && Number.isFinite(value) && value > 0 ? value : 1;
}

function shiftUp(rect: ResultRect, amount: number): ResultRect {
  return amount > 0 ? { ...rect, y: rect.y - amount } : rect;
}
