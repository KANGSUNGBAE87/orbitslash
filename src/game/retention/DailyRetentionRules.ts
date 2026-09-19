export interface DailyRetentionState {
  firstClearAwards: string[];
  clearDayKeys: string[];
}

export function applyDailyClear(state: DailyRetentionState, dayKey: string): DailyRetentionState {
  const cleared = addUnique(state.clearDayKeys, dayKey);
  return {
    clearDayKeys: cleared,
    firstClearAwards: state.firstClearAwards.includes(dayKey) ? state.firstClearAwards : [...state.firstClearAwards, dayKey],
  };
}

export function dailyBoard(clearDayKeys: readonly string[], currentDayKey: string): boolean[] {
  const current = parseDayKey(currentDayKey);
  const cleared = new Set(clearDayKeys);
  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() - (6 - offset)));
    return cleared.has(formatDayKey(day));
  });
}

function addUnique(items: readonly string[], value: string): string[] {
  return items.includes(value) ? [...items] : [...items, value];
}

function parseDayKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}
