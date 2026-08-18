/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// `any` is deliberate here: this module wraps an untyped REST API whose
// responses vary per endpoint, and inventing precise types would be a
// fiction that the runtime does not guarantee. Callers narrow as needed.
/**
 * Orders API — direct calls to the NestJS backend.
 *
 * Everything here goes through `apiFetch`, which attaches the JWT access
 * token as `Authorization: Bearer <token>` and refreshes it once on a 401.
 * No query-builder indirection: each function names the endpoint it calls.
 *
 * Endpoints used:
 *   GET    /orders            list all orders
 *   PATCH  /orders/:id        update one order
 *   GET    /users?limit=...   customer lookup (admin-only, JWT required)
 *   POST   /notifications     in-app notification to the customer
 */

import { apiFetch, apiFetchWithMeta } from "./api-client";




export type ApiOrder = {
  id: string;
  user_id: string;
  total_amount: number;
  status: string;
  razorpay_id: string | null;
  shipping_address: Record<string, any> | null;
  created_at: string;
  payment_id: string | null;
  coupon_id: string | null;
  coupon_code: string | null;
  discount_amount: number | null;
  subtotal: number | null;
  order_type: string | null;
  tax_amount: number | null;
  invoice_url: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  promo_code: string | null;
  refund_id: string | null;
  tracking_number?: string | null;
  items: any[];
};

export type ApiUser = {
  id: string;
  email: string;
  full_name: string | null;
};

/** GET /orders — the backend returns the full table (no query params yet). */
export async function fetchOrders(): Promise<ApiOrder[]> {
  const data = await apiFetch<ApiOrder[]>("/orders");
  // apiFetch already normalises dates and Decimal strings.
  return Array.isArray(data) ? data : [];
}

/**
 * GET /users — customer lookup, replacing the old `profiles` table query.
 * Admin-only and JWT-guarded on the backend.
 *
 * The endpoint is paginated and has no "fetch all" mode, so we request a
 * large page and follow up if there are more. If a user still isn't found,
 * the UI falls back to showing the raw user id.
 */
export async function fetchUserMap(): Promise<Map<string, ApiUser>> {
  const map = new Map<string, ApiUser>();
  const limit = 200;
  let page = 1;
  let totalPages = 1;

  do {
    const { data, pagination } = await apiFetchWithMeta<ApiUser[]>(
      `/users?page=${page}&limit=${limit}`
    );
    (data ?? []).forEach((u) => map.set(u.id, u));
    totalPages = pagination?.totalPages ?? 1;
    page += 1;
    // Safety valve so a bad pagination payload can't spin forever.
    if (page > 50) break;
  } while (page <= totalPages);

  return map;
}

/**
 * PATCH /orders/:id
 *
 * The backend validates with `forbidNonWhitelisted: true`, so any field not
 * present in UpdateOrderDto causes a 400. Allowed fields are limited to the
 * ones the admin UI actually edits.
 */
export type OrderUpdate = {
  status?: string;
  tracking_number?: string | null;
  shipment_status?: string;
  estimated_delivery?: string;
};

export async function updateOrder(id: string, payload: OrderUpdate): Promise<ApiOrder> {
  return apiFetch<ApiOrder>(`/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * PATCH each order in turn. The backend has no bulk-update route, so this
 * issues one request per order and reports which ones failed rather than
 * silently claiming success.
 */
export async function updateOrdersBulk(
  ids: string[],
  payload: OrderUpdate
): Promise<{ succeeded: string[]; failed: { id: string; message: string }[] }> {
  const succeeded: string[] = [];
  const failed: { id: string; message: string }[] = [];

  const results = await Promise.allSettled(ids.map((id) => updateOrder(id, payload)));
  results.forEach((r, i) => {
    if (r.status === "fulfilled") succeeded.push(ids[i]);
    else {
      failed.push({
        id: ids[i],
        message: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });

  return { succeeded, failed };
}

/**
 * POST /notifications
 *
 * NOTE: CreateNotificationDto accepts only
 * user_id, type, title, body, is_read, action_url, link_url, link.
 * `created_at` is NOT accepted — sending it returns 400 because the backend
 * runs ValidationPipe with forbidNonWhitelisted. It is set server-side.
 */
export async function createNotification(input: {
  user_id: string;
  type: string;
  title: string;
  body?: string;
  is_read?: boolean;
  link?: string;
}): Promise<void> {
  await apiFetch("/notifications", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
