export interface ComboTimedItem {
  hitAtMs: number;
}

export function groupByComboTimeout<T extends ComboTimedItem>(items: T[], timeoutMs: number): T[][] {
  if (items.length === 0) return [];

  const groups: T[][] = [];
  let current: T[] = [];
  let previousHitAtMs: number | null = null;

  for (const item of items) {
    if (previousHitAtMs != null && item.hitAtMs - previousHitAtMs >= timeoutMs) {
      groups.push(current);
      current = [];
    }
    current.push(item);
    previousHitAtMs = item.hitAtMs;
  }

  if (current.length > 0) groups.push(current);
  return groups;
}
