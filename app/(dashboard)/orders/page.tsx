import { createClient } from "@supabase/supabase-js";
import OrdersClient, { Order } from "./OrdersClient";

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

export default async function OrdersPage() {
  let orders: Order[] = [];

  try {
    const supabaseServer = createServerClient();

    // Query orders and profiles in parallel
    const [ordersRes, profilesRes] = await Promise.all([
      supabaseServer
        .from("orders")
        .select(`
          id, user_id, total_amount, status, razorpay_id, shipping_address, created_at, 
          payment_id, coupon_id, coupon_code, discount_amount, subtotal, order_type, 
          tax_amount, invoice_url, razorpay_order_id, razorpay_payment_id, promo_code, 
          refund_id, items, tracking_number
        `)
        .order("created_at", { ascending: false }),
      supabaseServer
        .from("profiles")
        .select("id, email, full_name")
    ]);

    if (ordersRes.error) {
      console.warn("Table or columns in 'orders' failed to query for orders list:", ordersRes.error.message);
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
        items: o.items || [],
        profiles: profilesMap.get(o.user_id) || null
      }));
    }
  } catch (err) {
    console.warn("Unexpected error fetching orders list server-side:", err);
    orders = [];
  }

  return (
    <div className="mx-auto max-w-7xl">
      <OrdersClient initialOrders={orders} />
    </div>
  );
}
