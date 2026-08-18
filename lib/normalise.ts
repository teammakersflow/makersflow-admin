/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * SINGLE SOURCE OF TRUTH for normalising API responses.
 *
 * Two problems have to be fixed on every row that comes back from the API,
 * and they must be fixed in ONE place — previously the logic lived in
 * lib/backend-api.ts only, so pages that called `apiFetch` directly (the
 * dashboard) skipped it entirely and crashed with
 * "created_at.slice is not a function".
 *
 * 1. DATES — the app does string work on them (`created_at.slice(0, 10)`,
 *    `localeCompare`, and `>=` against ISO strings). Anything that is not a
 *    string breaks that. Normalise to an ISO string, or null.
 *
 * 2. DECIMALS — Prisma serialises `Decimal` as a JSON STRING ("331200.00").
 *    `total += order.total_amount` then concatenates instead of adding,
 *    which produced a revenue figure of "0331200". Coerce to numbers.
 *
 * Every fetch helper in this app must pass its rows through `normalise()`.
 */

/** Decimal columns per endpoint, taken from prisma/schema.prisma. */
const DECIMAL_COLUMNS: Record<string, string[]> = {
  "/orders": ["total_amount", "discount_amount", "subtotal", "tax_amount"],
  "/payments": ["amount", "refund_amount"],
  "/products": ["price", "original_price", "gst_rate", "weight", "weight_kg"],
  "/courses": ["price", "gst_rate"],
  "/coupons": [
    "discount_value", "minimum_order_amount", "maximum_discount",
    "max_discount_amount", "min_order_amount",
  ],
  "/promo-codes": ["min_order_amount", "max_discount_amount"],
  "/course-purchases": ["amount_paid"],
  "/lesson-progress": ["current_time_secs", "watch_percentage", "time_spent_secs"],
};

/** Date columns per endpoint. */
const DATE_COLUMNS: Record<string, string[]> = {
  "/orders": ["created_at", "updated_at", "estimated_delivery"],
  "/payments": ["created_at", "updated_at", "refunded_at"],
  "/products": ["created_at", "updated_at"],
  "/courses": ["created_at", "updated_at"],
  "/categories": ["created_at"],
  "/coupons": ["created_at", "expiry_date"],
  "/users": ["created_at", "updated_at"],
  "/enrollments": ["enrolled_at", "completed_at", "expires_at", "created_at"],
  "/reviews": ["created_at", "updated_at"],
  "/notifications": ["created_at"],
  "/certificates": ["created_at", "issued_at"],
  "/modules": ["created_at"],
  "/lessons": ["created_at"],
  "/news": ["created_at", "updated_at"],
  "/announcements": ["created_at", "scheduled_at"],
  "/promotions": ["created_at", "expires_at"],
  "/promo-codes": ["created_at", "expiry_at"],
  "/coupon-usage": ["used_at", "created_at"],
  "/course-purchases": ["created_at", "purchased_at"],
  "/settings": ["updated_at"],
  "/lesson-progress": ["created_at", "updated_at"],
};

/**
 * Convert anything date-shaped to an ISO string.
 * Handles: ISO strings, epoch seconds, epoch milliseconds, Date instances,
 * and `{ }` wrappers some serialisers produce. Returns null if unusable.
 */
export function toIsoString(value: unknown): string | null {
  if (value == null) return null;

  if (typeof value === "string") {
    return Number.isNaN(Date.parse(value)) ? null : value;
  }

  if (typeof value === "number") {
    // Below ~1e11 is far too small to be milliseconds, so treat as seconds.
    const d = new Date(value < 1e11 ? value * 1000 : value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === "object") {
    // Some serialisers wrap dates, e.g. { value: "..." } or { $date: ... }.
    const inner =
      (value as any).value ?? (value as any).$date ?? (value as any).date ?? null;
    if (inner != null && inner !== value) return toIsoString(inner);
  }

  const d = new Date(value as any);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toNumber(value: unknown): unknown {
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return value;
}

/** Normalise one row for the given endpoint path. Mutates and returns it. */
export function normaliseRow<T = any>(endpoint: string, row: T): T {
  if (row == null || typeof row !== "object") return row;
  const r = row as any;

  (DATE_COLUMNS[endpoint] ?? []).forEach((c) => {
    // Only touch keys that already exist — never add keys, or nulls could
    // leak into update payloads and trip the backend's DTO validation.
    if (c in r) r[c] = toIsoString(r[c]);
  });

  (DECIMAL_COLUMNS[endpoint] ?? []).forEach((c) => {
    if (c in r) r[c] = toNumber(r[c]);
  });

  return row;
}

/** Normalise an array (or single row) for the given endpoint path. */
export function normalise<T = any>(endpoint: string, data: T): T {
  if (Array.isArray(data)) {
    data.forEach((row) => normaliseRow(endpoint, row));
    return data;
  }
  return normaliseRow(endpoint, data);
}
