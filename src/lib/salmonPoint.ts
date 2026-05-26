/**
 * Pure helper functions for salmon point calculations.
 * These mirror the DB trigger logic (fn_sync_salmon_point) so the UI
 * can preview results without a round-trip to the database.
 */

/**
 * Calculates the salmon point delta for a given bill amount.
 * Returns Math.floor(amount / 100), or 0 for null/undefined/NaN.
 *
 * Requirements: 3.1, 4.2, 4.3, 5.2, 5.3
 */
export function computeSalmonDelta(amount: number | null | undefined): number {
  const value = amount ?? 0;
  if (isNaN(value)) return 0;
  return Math.floor(value / 100);
}

/**
 * Applies a delta to the current salmon point total, clamping to 0.
 * Returns Math.max(0, currentSp + delta).
 *
 * Requirements: 6.2
 */
export function computeNewSalmonPoint(currentSp: number, delta: number): number {
  return Math.max(0, currentSp + delta);
}

/**
 * Parses an amount string and returns the salmon point preview.
 * Returns null if the string is empty, whitespace-only, NaN, or negative.
 * Returns Math.floor(parsed / 100) for valid non-negative values (including 0).
 *
 * Requirements: 8.1, 8.2, 8.3
 */
export function computeSalmonPreview(amountStr: string): number | null {
  if (amountStr.trim() === '') return null;
  const parsed = parseFloat(amountStr);
  if (isNaN(parsed)) return null;
  if (parsed < 0) return null;
  return Math.floor(parsed / 100);
}
