interface NumberParamBounds {
  min: number;
  max: number;
  integer?: boolean;
}

export function readDevNumberParam(search: string, key: string, bounds: NumberParamBounds): number | undefined {
  const raw = new URLSearchParams(search).get(key);
  if (raw == null || raw.trim() === "") return undefined;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;

  const bounded = Math.max(bounds.min, Math.min(bounds.max, parsed));
  return bounds.integer ? Math.floor(bounded) : bounded;
}

export function readDevStringParam<const T extends readonly string[]>(search: string, key: string, allowed: T): T[number] | undefined {
  const raw = new URLSearchParams(search).get(key);
  if (raw == null) return undefined;
  return allowed.includes(raw) ? raw : undefined;
}
