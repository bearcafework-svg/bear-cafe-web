/** site_settings key for monthly makeup (re-checkin) quota. */
export const CHECKIN_MAX_MAKEUP_DAYS_KEY = "checkin_max_makeup_days";

/** Default when setting is missing or invalid. */
export const DEFAULT_CHECKIN_MAKEUP_MAX = 3;

const MIN_MAKEUP_MAX = 0;
const MAX_MAKEUP_MAX = 28;

/**
 * Parse site_settings value for checkin_max_makeup_days.
 * Accepts `{ "days": N }` or a bare number. Clamps to 0–28; falls back to 3.
 */
export function parseCheckinMakeupMax(value: unknown): number {
  if (value == null) return DEFAULT_CHECKIN_MAKEUP_MAX;
  let raw: unknown = value;
  if (typeof value === "object" && !Array.isArray(value)) {
    raw = (value as Record<string, unknown>).days;
    if (raw == null) return DEFAULT_CHECKIN_MAKEUP_MAX;
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_CHECKIN_MAKEUP_MAX;
  return Math.min(MAX_MAKEUP_MAX, Math.max(MIN_MAKEUP_MAX, Math.floor(n)));
}
