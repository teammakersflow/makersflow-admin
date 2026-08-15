"use client";

/**
 * Was a Server Component using a Supabase service-role key. Now fetches on
 * the client (the JWT lives in the browser). Data logic unchanged.
 */

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import PaymentsClient, { Payment } from "./PaymentsClient";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let result: Payment[] = [];
      try {
        const [paymentsRes, profilesRes] = await Promise.all([
          db.from("payments").select("*").order("created_at", { ascending: false }),
          db.from("profiles").select("id, email, full_name"),
        ]);

        if (paymentsRes.error) {
          console.warn("Failed to query payments page:", paymentsRes.error.message);
        } else {
          const rawPayments = paymentsRes.data ?? [];
          const profilesMap = new Map<string, { email: string; full_name: string | null }>();

          if (profilesRes.data) {
            profilesRes.data.forEach((p: any) => {
              profilesMap.set(p.id, { email: p.email || "", full_name: p.full_name || null });
            });
          }

          result = rawPayments.map((p: any) => ({
            id: p.id,
            user_id: p.user_id,
            razorpay_order_id: p.razorpay_order_id,
            razorpay_payment_id: p.razorpay_payment_id,
            razorpay_signature: p.razorpay_signature,
            amount: p.amount,
            currency: p.currency,
            status: p.status,
            failure_reason: p.failure_reason,
            failure_code: p.failure_code,
            failure_description: p.failure_description,
            refund_id: p.refund_id,
            refund_amount: p.refund_amount,
            refunded_at: p.refunded_at,
            created_at: p.created_at,
            updated_at: p.updated_at,
            profiles: profilesMap.get(p.user_id) || null,
          }));
        }
      } catch (err) {
        console.warn("Unexpected error fetching payments list:", err);
      }
      if (!cancelled) setPayments(result);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (payments === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PaymentsClient initialPayments={payments} />
    </div>
  );
}
