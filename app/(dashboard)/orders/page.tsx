"use client";

/**
 * Orders — loads from the NestJS backend.
 *
 *   GET /orders  → the order list
 *   GET /users   → customer names/emails (replaces the old `profiles` query)
 *
 * Both go through lib/orders-api.ts, which uses the JWT access token for
 * authentication. This was previously a Server Component using a privileged
 * service-role key; the JWT now lives in the browser, so it fetches here.
 */

import { useEffect, useState } from "react";
import { fetchOrders, fetchUserMap } from "@/lib/orders-api";
import OrdersClient, { Order } from "./OrdersClient";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Customers are a secondary concern — if /users fails (e.g. the
        // account lost its admin role) still show the orders themselves.
        const [orderList, userMap] = await Promise.all([
          fetchOrders(),
          fetchUserMap().catch((e) => {
            console.warn("Could not load customer details from /users:", e);
            return new Map();
          }),
        ]);

        if (cancelled) return;

        setOrders(
          orderList.map((o) => {
            const user = userMap.get(o.user_id);
            return {
              id: o.id,
              user_id: o.user_id,
              total_amount: o.total_amount,
              status: o.status,
              razorpay_id: o.razorpay_id,
              shipping_address: o.shipping_address,
              created_at: o.created_at,
              payment_id: o.payment_id,
              coupon_id: o.coupon_id,
              coupon_code: o.coupon_code,
              discount_amount: o.discount_amount,
              subtotal: o.subtotal,
              order_type: o.order_type,
              tax_amount: o.tax_amount,
              invoice_url: o.invoice_url,
              razorpay_order_id: o.razorpay_order_id,
              razorpay_payment_id: o.razorpay_payment_id,
              promo_code: o.promo_code,
              refund_id: o.refund_id,
              tracking_number: o.tracking_number ?? null,
              items: Array.isArray(o.items) ? o.items : [],
              profiles: user
                ? { email: user.email ?? "", full_name: user.full_name ?? null }
                : null,
            } as Order;
          })
          // The API returns no sort order, so newest-first is applied here.
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load orders");
          setOrders([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (orders === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <OrdersClient initialOrders={orders} />
    </div>
  );
}
