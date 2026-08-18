/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// `any` is deliberate here: this module wraps an untyped REST API whose
// responses vary per endpoint, and inventing precise types would be a
// fiction that the runtime does not guarantee. Callers narrow as needed.
/**
 * BACKEND REST CLIENT — this is NOT the previous backend.
 *
 * Every call here is an HTTPS request to the NestJS API
 * (process.env.NEXT_PUBLIC_API_URL, e.g. https://api.makersflow.in) with a
 * JWT Bearer token. There is no database driver and no the previous backend SDK in this
 * project; `@the previous backend/the previous backend` is not installed.
 *
 * Call sites name the HTTP path, e.g. backendApi.endpoint("/coupons").
 *
 * WHY THIS EXISTS
 * ---------------
 * ~40 pages were written against the previous backend's chainable query builder
 * (a chainable query builder), always returning `{ data, error }`.
 * The new NestJS backend is a plain REST API. Rewriting every page's data
 * logic by hand would risk subtle behaviour changes in pages nobody has
 * time to re-test. Instead this module keeps the same calling convention
 * and translates it into REST calls. The `@the previous backend/the previous backend`
 * dependency is gone; only the shape survives.
 *
 * READ THIS BEFORE TRUSTING THE NUMBERS
 * -------------------------------------
 * 1. The backend's list endpoints accept NO query parameters. So `.eq()`,
 *    `.in()`, `.order()`, `.limit()` etc. are applied CLIENT-SIDE after
 *    fetching the whole table. Results are correct but it does not scale —
 *    ask the backend team for real query params as data grows.
 * 2. `.select("a, b, nested(x)")` does NOT project columns or perform
 *    joins. Whatever the endpoint returns is what you get. the previous backend-style
 *    embedded joins (e.g. `profiles(email)`) come back UNDEFINED — the
 *    backend has no join endpoints. Pages that showed a user's email
 *    alongside an order will show their fallback text instead.
 * 3. Tables in UNSUPPORTED_TABLES have no backend endpoint at all. They
 *    resolve to `{ data: null, error: {...} }`, which the existing pages
 *    already handle as an error state, so nothing crashes — but those
 *    screens cannot show data until the backend exposes them.
 */

import { API_URL, tokenStore } from "./api-client";

/** Tables the NestJS backend currently exposes. */
/** Endpoint paths the NestJS backend exposes. */
const KNOWN_ENDPOINTS = new Set<string>([
  "/courses", "/products", "/orders", "/categories", "/coupons", "/modules",
  "/lessons", "/users", "/reviews", "/enrollments", "/payments",
  "/notifications", "/certificates", "/settings", "/promo-codes", "/news",
  "/announcements", "/promotions", "/quiz-questions", "/lesson-notes",
  "/lesson-resources", "/review-replies", "/course-purchases",
  "/coupon-usage", "/lesson-progress",
]);

/**
 * Tables the frontend uses that the backend has NO module for yet.
 * Each entry is a page that cannot load until someone builds the endpoint.
 */
const UNSUPPORTED_TABLES: Record<string, string> = {
  // All tables the admin panel uses now have endpoints. If a new table is
  // referenced without a backend module, add it here so the UI shows a
  // clear message instead of a raw 404.
};


/**
 * Prisma serialises `Decimal` columns as JSON STRINGS ("331200.00"), not
 * numbers. the previous backend's PostgREST returned real numbers, so existing code
 * does arithmetic like `total += order.total_amount` — which silently
 * CONCATENATES when the value is a string ("0" + "331200" = "0331200").
 *
 * Every Decimal column in the Prisma schema is listed here and coerced to a
 * number as the data arrives, so pages keep working unchanged.
 *
 * If the backend adds a new Decimal column, add it here too.
 */
const DECIMAL_COLUMNS: Record<string, string[]> = {
  coupons: ["discount_value", "minimum_order_amount", "maximum_discount", "max_discount_amount", "min_order_amount"],
  course_purchases: ["amount_paid"],
  courses: ["price", "gst_rate"],
  invoices: ["amount", "tax_amount"],
  lesson_progress: ["current_time_secs", "watch_percentage", "time_spent_secs"],
  order_items: ["unit_price"],
  orders: ["total_amount", "discount_amount", "subtotal", "tax_amount"],
  payments: ["amount", "refund_amount"],
  products: ["price", "original_price", "gst_rate", "weight", "weight_kg"],
  promo_codes: ["min_order_amount", "max_discount_amount"],
  quiz_attempts: ["score"],
  refunds: ["amount"],
};


/**
 * Date columns can arrive in more than one shape depending on how the API
 * serialises them (ISO string, epoch number, or a nested object). The app
 * does string work on them — `created_at.slice(0, 10)`, `localeCompare`,
 * and `>=` comparisons against ISO strings — which throws
 * "created_at.slice is not a function" the moment it isn't a string.
 *
 * Normalise every known date column to an ISO string on arrival so all
 * call sites can rely on it. Invalid or missing values become null.
 */
const DATE_COLUMNS: Record<string, string[]> = {
  orders: ["created_at", "updated_at", "estimated_delivery"],
  payments: ["created_at", "updated_at", "refunded_at"],
  products: ["created_at", "updated_at"],
  courses: ["created_at", "updated_at"],
  categories: ["created_at"],
  coupons: ["created_at", "expiry_date"],
  users: ["created_at", "updated_at"],
  enrollments: ["enrolled_at", "completed_at", "expires_at", "created_at"],
  reviews: ["created_at", "updated_at"],
  notifications: ["created_at"],
  certificates: ["created_at", "issued_at"],
  modules: ["created_at"],
  lessons: ["created_at"],
  news: ["created_at", "updated_at"],
  announcements: ["created_at", "scheduled_at"],
  promotions: ["created_at", "expires_at"],
  promo_codes: ["created_at", "expiry_at"],
  coupon_usage: ["used_at", "created_at"],
  course_purchases: ["created_at", "purchased_at"],
  settings: ["updated_at"],
};

function toIsoString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    // Already ISO-ish — keep as-is so existing comparisons stay valid.
    if (!Number.isNaN(Date.parse(value))) return value;
    return null;
  }
  if (typeof value === "number") {
    // Epoch seconds vs milliseconds: values below ~1e11 are seconds.
    const ms = value < 1e11 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(value as any);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function coerceDates(table: string, row: any): any {
  const cols = DATE_COLUMNS[table];
  if (!cols || row == null || typeof row !== "object") return row;
  cols.forEach((c) => {
    if (c in row) row[c] = toIsoString(row[c]);
  });
  return row;
}

function coerceDecimals(table: string, row: any): any {
  const cols = DECIMAL_COLUMNS[table];
  if (!cols || row == null || typeof row !== "object") return row;
  cols.forEach((c) => {
    const v = row[c];
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
      row[c] = Number(v);
    }
  });
  return row;
}

export type DbResult<T = any> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

type Filter = { op: string; column: string; value: any };

function missingEndpointError(table: string): { message: string } {
  const label = UNSUPPORTED_TABLES[table] ?? table;
  return {
    message:
      `"${label}" is not available yet: the backend has no /${table} endpoint. ` +
      `This screen will stay empty until that module is added to the NestJS API.`,
  };
}

function getValue(row: any, column: string): any {
  return row == null ? undefined : row[column];
}

function applyFilters(rows: any[], filters: Filter[]): any[] {
  return rows.filter((row) =>
    filters.every(({ op, column, value }) => {
      const actual = getValue(row, column);
      switch (op) {
        case "eq":
          // Loose compare so numeric ids from the URL match BigInt-ish ids.
          return String(actual) === String(value);
        case "neq":
          return String(actual) !== String(value);
        case "gt":
          return actual > value;
        case "gte":
          return actual >= value;
        case "lt":
          return actual < value;
        case "lte":
          return actual <= value;
        case "in":
          return Array.isArray(value) && value.some((v) => String(v) === String(actual));
        case "is":
          return value === null ? actual === null || actual === undefined : actual === value;
        case "like":
        case "ilike": {
          if (actual == null) return false;
          const pattern = String(value).replace(/%/g, "");
          return String(actual).toLowerCase().includes(pattern.toLowerCase());
        }
        default:
          return true;
      }
    })
  );
}

async function request(path: string, init: RequestInit = {}): Promise<any> {
  const token = tokenStore.getAccessToken();
  const headers: Record<string, string> = {
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err: any = new Error(json?.message || res.statusText || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json?.data;
}

class QueryBuilder implements PromiseLike<DbResult> {
  private table: string;
  private endpoint: string | null;
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;
  private wantCount = false;
  private headOnly = false;
  private singleMode: "single" | "maybe" | null = null;
  private mutation:
    | { kind: "insert" | "update" | "upsert"; payload: any }
    | { kind: "delete" }
    | null = null;

  constructor(path: string) {
    this.table = path.replace(/^\//, "").replace(/-/g, "_");
    this.endpoint = KNOWN_ENDPOINTS.has(path) ? path : null;
  }

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (options?.count) this.wantCount = true;
    if (options?.head) this.headOnly = true;
    return this;
  }

  insert(payload: any) {
    this.mutation = { kind: "insert", payload };
    return this;
  }
  update(payload: any) {
    this.mutation = { kind: "update", payload };
    return this;
  }
  upsert(payload: any, _options?: { onConflict?: string }) {
    this.mutation = { kind: "upsert", payload };
    return this;
  }
  delete() {
    this.mutation = { kind: "delete" };
    return this;
  }

  eq(column: string, value: any) { this.filters.push({ op: "eq", column, value }); return this; }
  neq(column: string, value: any) { this.filters.push({ op: "neq", column, value }); return this; }
  gt(column: string, value: any) { this.filters.push({ op: "gt", column, value }); return this; }
  gte(column: string, value: any) { this.filters.push({ op: "gte", column, value }); return this; }
  lt(column: string, value: any) { this.filters.push({ op: "lt", column, value }); return this; }
  lte(column: string, value: any) { this.filters.push({ op: "lte", column, value }); return this; }
  in(column: string, value: any[]) { this.filters.push({ op: "in", column, value }); return this; }
  is(column: string, value: any) { this.filters.push({ op: "is", column, value }); return this; }
  like(column: string, value: string) { this.filters.push({ op: "like", column, value }); return this; }
  ilike(column: string, value: string) { this.filters.push({ op: "ilike", column, value }); return this; }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean; referencedTable?: string }) {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }
  limit(count: number) { this.limitCount = count; return this; }
  range(from: number, to: number) { this.limitCount = to - from + 1; return this; }

  single() { this.singleMode = "single"; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }

  /** The id used to address a single row for update/delete. */
  private idFilter(): any | null {
    // `settings` is keyed by `key`, every other table by `id`.
    const pk = this.table === "settings" ? "key" : "id";
    const f = this.filters.find((x) => x.op === "eq" && x.column === pk);
    return f ? f.value : null;
  }

  /**
   * ids from `.in("id", [...])`. The backend has no bulk update/delete
   * route, so these are applied one request per id.
   */
  private idListFilter(): any[] | null {
    const f = this.filters.find((x) => x.op === "in" && x.column === "id");
    return f && Array.isArray(f.value) ? f.value : null;
  }

  private async run(): Promise<DbResult> {
    if (!this.endpoint) {
      return { data: null, error: missingEndpointError(this.table), count: null };
    }

    try {
      // ---- mutations ----
      if (this.mutation) {
        const id = this.idFilter();

        if (this.mutation.kind === "delete") {
          const ids = id != null ? [id] : this.idListFilter();
          if (!ids || ids.length === 0) {
            return {
              data: null,
              error: { message: "Delete needs .eq(\"id\", ...) or .in(\"id\", [...])." },
            };
          }
          // No bulk route on the backend — one DELETE per id.
          const results = await Promise.allSettled(
            ids.map((x) => request(`${this.endpoint}/${x}`, { method: "DELETE" }))
          );
          const failures = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
          if (failures.length > 0) {
            return {
              data: null,
              error: {
                message:
                  `${ids.length - failures.length} of ${ids.length} deleted. ` +
                  `First failure: ${failures[0].reason?.message ?? failures[0].reason}`,
              },
            };
          }
          return { data: null, error: null };
        }

        const payload = this.mutation.payload;

        if (this.mutation.kind === "insert") {
          const rows = Array.isArray(payload) ? payload : [payload];
          const created = [];
          for (const row of rows) {
            created.push(await request(this.endpoint, { method: "POST", body: JSON.stringify(row) }));
          }
          const result = Array.isArray(payload) ? created : created[0];
          return { data: this.singleMode ? created[0] : result, error: null };
        }

        if (this.mutation.kind === "update") {
          const ids = id != null ? [id] : this.idListFilter();
          if (!ids || ids.length === 0) {
            return {
              data: null,
              error: { message: "Update needs .eq(\"id\", ...) or .in(\"id\", [...])." },
            };
          }
          // No bulk route on the backend — one PATCH per id.
          const results = await Promise.allSettled(
            ids.map((x) =>
              request(`${this.endpoint}/${x}`, { method: "PATCH", body: JSON.stringify(payload) })
            )
          );
          const failures = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
          if (failures.length > 0) {
            return {
              data: null,
              error: {
                message:
                  `${ids.length - failures.length} of ${ids.length} updated. ` +
                  `First failure: ${failures[0].reason?.message ?? failures[0].reason}`,
              },
            };
          }
          const ok = results
            .filter((r) => r.status === "fulfilled")
            .map((r) => (r as PromiseFulfilledResult<any>).value);
          return { data: ids.length === 1 ? ok[0] : ok, error: null };
        }

        // upsert — PATCH when the payload carries an id, else POST
        const rows = Array.isArray(payload) ? payload : [payload];
        const saved = [];
        for (const row of rows) {
          // POST /settings upserts by `key` server-side, so always POST.
          if (this.table === "settings") {
            saved.push(await request(this.endpoint, { method: "POST", body: JSON.stringify(row) }));
          } else if (row?.id != null) {
            saved.push(
              await request(`${this.endpoint}/${row.id}`, { method: "PATCH", body: JSON.stringify(row) })
            );
          } else {
            saved.push(await request(this.endpoint, { method: "POST", body: JSON.stringify(row) }));
          }
        }
        return { data: this.singleMode ? saved[0] : saved, error: null };
      }

      // ---- reads ----
      // Single row by id → use the dedicated /:id route (cheaper than listing).
      const id = this.idFilter();
      if (this.singleMode && id != null && this.filters.length === 1) {
        let row: any = null;
        try {
          row = await request(`${this.endpoint}/${id}`);
        } catch (e: any) {
          // A 404 means "no such row". maybeSingle() treats that as an empty
          // result; single() treats it as an error.
          if (e?.status === 404) {
            return this.singleMode === "maybe"
              ? { data: null, error: null }
              : { data: null, error: { message: "No rows found" } };
          }
          throw e;
        }
        if (!row && this.singleMode === "single") {
          return { data: null, error: { message: "No rows found" } };
        }
        return { data: row ? coerceDates(this.table, coerceDecimals(this.table, row)) : null, error: null };
      }

      let rows = await request(this.endpoint);
      if (!Array.isArray(rows)) rows = rows == null ? [] : [rows];
      rows = rows.map((r: any) => coerceDates(this.table, coerceDecimals(this.table, r)));

      rows = applyFilters(rows, this.filters);

      if (this.orderBy) {
        const { column, ascending } = this.orderBy;
        rows = [...rows].sort((a, b) => {
          const av = getValue(a, column);
          const bv = getValue(b, column);
          if (av == null && bv == null) return 0;
          if (av == null) return ascending ? -1 : 1;
          if (bv == null) return ascending ? 1 : -1;
          if (av < bv) return ascending ? -1 : 1;
          if (av > bv) return ascending ? 1 : -1;
          return 0;
        });
      }

      const total = rows.length;
      if (this.limitCount != null) rows = rows.slice(0, this.limitCount);

      if (this.headOnly) return { data: null, error: null, count: total };

      if (this.singleMode) {
        if (rows.length === 0) {
          return this.singleMode === "single"
            ? { data: null, error: { message: "No rows found" } }
            : { data: null, error: null };
        }
        return { data: rows[0], error: null, count: this.wantCount ? total : undefined };
      }

      return { data: rows, error: null, count: this.wantCount ? total : undefined };
    } catch (e: any) {
      // A 404 on a whole collection means the backend module for this table
      // has not been deployed yet (see BACKEND_TODO.md). Say so plainly
      // instead of surfacing a bare "Not Found".
      if (e?.status === 404) {
        return {
          data: null,
          error: {
            message:
              `The "${this.table}" endpoint (${this.endpoint}) is not available on the backend yet. ` +
              `This screen will stay empty until that module is deployed.`,
          },
          count: null,
        };
      }
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) }, count: null };
    }
  }

  then<TResult1 = DbResult, TResult2 = never>(
    onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

export const backendApi = {
  /**
   * Call a REST endpoint on the NestJS backend.
   *
   *   backendApi.endpoint("/coupons").select("*")
   *
   * The argument is the HTTP path on api.makersflow.in — NOT a database
   * table. Nothing here touches a database directly.
   */
  endpoint(path: string) {
    return new QueryBuilder(path);
  },

  /**
   * Realtime is a the previous backend feature with no equivalent in the REST backend.
   * These stubs keep subscribe/unsubscribe call sites working; live updates
   * simply don't happen. Affected: features/users/components/UsersTable.tsx.
   */
  channel(_name: string) {
    const chainable = {
      on: (..._args: any[]) => chainable,
      subscribe: (..._args: any[]) => chainable,
      unsubscribe: () => {},
    };
    return chainable;
  },
  removeChannel(_channel: unknown) {},
};

export default backendApi;
