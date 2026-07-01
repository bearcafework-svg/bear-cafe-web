/** Matches bdfd-api DEFAULT_CAP and redeem-code minimum. */
export const DEFAULT_POINTS_CAP = 750;

/**
 * Resolves the display cap for strawberry points.
 * DB rows may have max_cap = 0 (schema default) or a stale value below current points.
 */
export function resolveMaxCap(
  storedCap: number | null | undefined,
  points: number,
): number {
  const base =
    storedCap != null && storedCap > 0 ? storedCap : DEFAULT_POINTS_CAP;
  return Math.max(base, DEFAULT_POINTS_CAP, points);
}
