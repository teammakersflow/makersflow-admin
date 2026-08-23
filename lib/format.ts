/**
 * Date formatting helpers.
 *
 * WHY THESE EXIST
 * ---------------
 * Several date columns are nullable in the database (`created_at DateTime?`),
 * and the API can also return a value that isn't a usable date. Formatting
 * those directly is wrong in two specific ways:
 *
 *   new Date(null).toLocaleDateString("en-IN")       -> "1/1/1970"
 *   new Date(undefined).toLocaleDateString("en-IN")  -> "Invalid Date"
 *
 * The 1970 case is the dangerous one: it looks like real data, so a payment
 * with no timestamp silently displays as 1 January 1970 rather than as
 * "unknown". These helpers render an em dash instead, so a missing date is
 * obviously missing.
 *
 * Always use these instead of `new Date(x).toLocaleDateString(...)`.
 */

const LOCALE = "en-IN";

function parse(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(value as any);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "17/08/2026" — or "—" when the date is missing/invalid. */
export function formatDate(value: unknown, fallback = "—"): string {
  const d = parse(value);
  return d ? d.toLocaleDateString(LOCALE) : fallback;
}

/** "6:04 pm" — or "—" when the date is missing/invalid. */
export function formatTime(value: unknown, fallback = "—"): string {
  const d = parse(value);
  return d
    ? d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })
    : fallback;
}

/** "17/08/2026, 6:04 pm" — or "—" when missing/invalid. */
export function formatDateTime(value: unknown, fallback = "—"): string {
  const d = parse(value);
  return d ? d.toLocaleString(LOCALE) : fallback;
}

/** "17 Aug 2026" — or "—" when missing/invalid. */
export function formatDateLong(value: unknown, fallback = "—"): string {
  const d = parse(value);
  return d
    ? d.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" })
    : fallback;
}

/** True when the value is a real date starting with `prefix` (e.g. "2026-08"). */
export function dateStartsWith(value: unknown, prefix: string): boolean {
  if (!prefix) return true;
  const d = parse(value);
  if (!d) return false;
  return d.toISOString().startsWith(prefix);
}
