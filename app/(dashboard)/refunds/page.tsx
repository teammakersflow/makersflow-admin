import { createClient } from "@supabase/supabase-js";
import RefundsClient, { OrderForRefund } from "./RefundsClient";

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

export default async function RefundsPage() {
  let orders: OrderForRefund[] = [];

  try {
    const supabaseServer = createServerClient();

    // Query orders and profiles in parallel
    const [ordersRes, profilesRes] = await Promise.all([
      supabaseServer
        .from("orders")
        .select("id, user_id, total_amount, status, payment_id, razorpay_order_id, razorpay_payment_id, created_at")
        .order("created_at", { ascending: false }),
      supabaseServer
        .from("profiles")
        .select("id, email, full_name")
    ]);

    if (ordersRes.error) {
      console.warn("Table or columns in 'orders' failed to query for refunds:", ordersRes.error.message);
    } else {
      const rawOrders = ordersRes.data ?? [];
      const profilesMap = new Map<string, { email: string; full_name: string | null }>();

      if (profilesRes.data) {
        profilesRes.data.forEach((p: any) => {
          profilesMap.set(p.id, { email: p.email || "", full_name: p.full_name || null });
        });
      }

      orders = rawOrders.map((o: any) => ({
        id: o.id,
        user_id: o.user_id,
        total_amount: o.total_amount,
        status: o.status,
        payment_id: o.payment_id,
        razorpay_order_id: o.razorpay_order_id,
        razorpay_payment_id: o.razorpay_payment_id,
        created_at: o.created_at,
        profiles: profilesMap.get(o.user_id) || null
      }));
    }
  } catch (err) {
    console.warn("Unexpected error fetching orders for refunds server-side:", err);
    orders = [];
  }

  return (
    <div className="mx-auto max-w-7xl">
      <RefundsClient initialOrders={orders} />
    </div>
  );
}
