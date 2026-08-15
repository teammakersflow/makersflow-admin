import { createClient } from "@supabase/supabase-js";
import PaymentsClient, { Payment } from "./PaymentsClient";

function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

export const revalidate = 0; // Disable caching so payments list loads fresh transactions

export default async function PaymentsPage() {
  let payments: Payment[] = [];

  try {
    const supabaseServer = createServerClient();

    // Query payments and profiles in parallel to perform in-memory join
    const [paymentsRes, profilesRes] = await Promise.all([
      supabaseServer
        .from("payments")
        .select(`
          id, user_id, razorpay_order_id, razorpay_payment_id, razorpay_signature,
          amount, currency, status, failure_reason, refund_id, refund_amount, 
          refunded_at, created_at, updated_at, failure_code, failure_description
        `)
        .order("created_at", { ascending: false }),
      supabaseServer
        .from("profiles")
        .select("id, email, full_name")
    ]);

    if (paymentsRes.error) {
      console.warn("Table or columns in 'payments' failed to query for payments page:", paymentsRes.error.message);
    } else {
      const rawPayments = paymentsRes.data ?? [];
      const profilesMap = new Map<string, { email: string; full_name: string | null }>();

      if (profilesRes.data) {
        profilesRes.data.forEach((p: any) => {
          profilesMap.set(p.id, { email: p.email || "", full_name: p.full_name || null });
        });
      }

      payments = rawPayments.map((p: any) => ({
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
        profiles: profilesMap.get(p.user_id) || null
      }));
    }
  } catch (err) {
    console.warn("Unexpected error fetching payments list server-side:", err);
    payments = [];
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PaymentsClient initialPayments={payments} />
    </div>
  );
}
