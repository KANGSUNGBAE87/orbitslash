/** Pure policy helper. The release path always reads `process.version` directly. */
export function isAppsInTossNode24(version) {
  if (typeof version !== "string") return false;
  const match = version.match(/^v?(\d+)(?:\.\d+){0,2}(?:[-+][0-9A-Za-z.-]+)?$/);
  return Number(match?.[1]) === 24;
}
