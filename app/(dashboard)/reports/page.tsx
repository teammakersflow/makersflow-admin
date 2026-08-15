import { createClient } from "@supabase/supabase-js";
import ReportsClient, { OrderReportItem, EnrollmentReportItem } from "./ReportsClient";

function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export const revalidate = 0;

export default async function ReportsPage() {
  let orders: OrderReportItem[] = [];
  let enrollments: EnrollmentReportItem[] = [];
  let couponUsageData: Array<{ code: string; uses: number; saved: number }> = [];

  try {
    const supabaseServer = createServerClient();
    const [ordersRes, enrollmentsRes, couponUsageRes] = await Promise.all([
      supabaseServer
        .from("orders")
        .select("id, total_amount, status, created_at, discount_amount, coupon_code, promo_code")
        .order("created_at", { ascending: false }),
      supabaseServer
        .from("enrollments")
        .select("id, enrolled_at, payment_status, course_id, courses(id, title, price, is_free)")
        .order("enrolled_at", { ascending: false }),
      // Fetch coupon_usage for accurate analytics
      supabaseServer
        .from("coupon_usage")
        .select("coupon_id, discount_amount, coupons(code)")
        .order("used_at", { ascending: false })
        .limit(1000)
    ]);

    if (!ordersRes.error) {
      orders = (ordersRes.data as OrderReportItem[]) ?? [];
    }
    if (!enrollmentsRes.error) {
      enrollments = (enrollmentsRes.data as unknown as EnrollmentReportItem[]) ?? [];
    }
  } catch (err) {
    console.warn("Unexpected error fetching reports:", err);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <ReportsClient orders={orders} enrollments={enrollments} />
    </div>
  );
}
