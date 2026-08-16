"use client";

/**
 * Was a Server Component using a the previous backend service-role key. Now fetches on
 * the client (the JWT lives in the browser). Data logic unchanged.
 */

import { useEffect, useState } from "react";
import { backendApi } from "@/lib/backend-api";
import RefundsClient, { OrderForRefund } from "./RefundsClient";

export default function RefundsPage() {
  const [orders, setOrders] = useState<OrderForRefund[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let result: OrderForRefund[] = [];
      try {
        const [ordersRes, profilesRes] = await Promise.all([
          backendApi.endpoint("/orders").select("*").order("created_at", { ascending: false }),
          backendApi.endpoint("/users").select("id, email, full_name"),
        ]);

        if (ordersRes.error) {
          console.warn("Failed to query orders for refunds:", ordersRes.error.message);
        } else {
          const rawOrders = ordersRes.data ?? [];
          const profilesMap = new Map<string, { email: string; full_name: string | null }>();

          if (profilesRes.data) {
            profilesRes.data.forEach((p: any) => {
              profilesMap.set(p.id, { email: p.email || "", full_name: p.full_name || null });
            });
          }

          result = rawOrders.map((o: any) => ({
            id: o.id,
            user_id: o.user_id,
            total_amount: o.total_amount,
            status: o.status,
            payment_id: o.payment_id,
            razorpay_order_id: o.razorpay_order_id,
            razorpay_payment_id: o.razorpay_payment_id,
            created_at: o.created_at,
            profiles: profilesMap.get(o.user_id) || null,
          }));
        }
      } catch (err) {
        console.warn("Unexpected error fetching orders for refunds:", err);
      }
      if (!cancelled) setOrders(result);
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
      <RefundsClient initialOrders={orders} />
    </div>
  );
}
