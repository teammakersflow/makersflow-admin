import { createClient } from "@supabase/supabase-js";
import DashboardClient, { DayRevenue, RecentPayment, RecentOrder, DashboardStats } from "./DashboardClient";

function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export const revalidate = 0;

export default async function DashboardPage() {
  const supabaseServer = createServerClient();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const startOfWeek = new Date(now.getTime() - 7 * 86400000).toISOString();

  let totalRevenue = 0, monthRevenue = 0, todayRevenue = 0, momGrowth = 0;
  let totalOrders = 0, pendingOrders = 0;
  let totalEnrollments = 0, paidEnrollments = 0, freeEnrollments = 0, pendingEnrollments = 0, newEnrollmentsThisWeek = 0;
  let courseEnrollments: { title: string; count: number }[] = [];
  let totalUsers = 0, newUsersThisMonth = 0, activeUsers = 0;
  let totalProducts = 0, outOfStockProducts = 0;
  let productsByCategory: { category: string; count: number }[] = [];
  let activePromoCodes = 0;
  let successPayments = 0, failedPayments = 0;
  let refundsCount = 0, totalRefundedAmount = 0;
  let recentPayments: RecentPayment[] = [];
  let recentOrders: RecentOrder[] = [];

  const chartDataMap: Record<string, { label: string; revenue: number; orders: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    chartDataMap[dateStr] = {
      label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      revenue: 0, orders: 0
    };
  }

  const [
    ordersRes, enrollmentsRes, profilesRes, newUsersMonthRes,
    productsRes, promoCodesCountRes, couponsCountRes,
    paymentsSuccessRes, paymentsFailedRes,
    recentPaymentsRes, recentOrdersRes, activeUsersRes,
    capturedPaymentsRes
  ] = await Promise.allSettled([
    supabaseServer.from("orders").select("total_amount, status, created_at, id, user_id"),
    supabaseServer.from("enrollments").select("id, payment_status, enrolled_at, course_id, courses(title, is_free)"),
    supabaseServer.from("profiles").select("id, email, full_name"),
    supabaseServer.auth.admin.listUsers(),
    supabaseServer.from("products").select("id, in_stock, category, stock_quantity"),
    // Count active promo_codes
    supabaseServer.from("promo_codes").select("id", { count: "exact", head: true }).eq("is_active", true),
    // Also count coupons table (canonical)
    supabaseServer.from("coupons").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabaseServer.from("payments").select("id", { count: "exact", head: true }).eq("status", "captured"),
    supabaseServer.from("payments").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabaseServer.from("payments").select("id, amount, status, created_at, user_id").order("created_at", { ascending: false }).limit(5),
    // FIX: Also sum payments table to cross-reference revenue (catches pending orders that were actually paid)
    supabaseServer.from("payments").select("amount").eq("status", "captured"),
    supabaseServer.from("orders").select("id, total_amount, status, created_at, user_id").order("created_at", { ascending: false }).limit(5),
    supabaseServer.from("lesson_progress").select("user_id").gte("last_watched_at", startOfWeek),
  ]);

  // Profiles map
  const profilesMap = new Map<string, { email: string; full_name: string | null }>();
  if (profilesRes.status === "fulfilled" && !profilesRes.value.error) {
    const profilesList = profilesRes.value.data ?? [];
    totalUsers = profilesList.length;
    profilesList.forEach((p: any) => profilesMap.set(p.id, { email: p.email || "", full_name: p.full_name || null }));
  }

  // Orders
  if (ordersRes.status === "fulfilled" && !ordersRes.value.error) {
    const ordersList = ordersRes.value.data ?? [];
    totalOrders = ordersList.length;
    let thisMonthRevenue = 0, lastMonthRevenue = 0;

    ordersList.forEach((order: any) => {
      const createdAt = order.created_at;
      const status = order.status;
      const amount = order.total_amount;
      const dateStr = createdAt.slice(0, 10);
      if (chartDataMap[dateStr]) {
        chartDataMap[dateStr].orders += 1;
        if (["paid","processing","shipped","delivered","packed"].includes(status)) {
          chartDataMap[dateStr].revenue += amount;
        }
      }
      if (status === "pending") pendingOrders += 1;
      else if (status === "cancelled") { refundsCount += 1; totalRefundedAmount += amount; }
      if (["paid","processing","packed","shipped","delivered","completed"].includes(status)) {
        totalRevenue += amount;
        if (createdAt >= startOfCurrentMonth) thisMonthRevenue += amount;
        else if (createdAt >= startOfLastMonth && createdAt < startOfCurrentMonth) lastMonthRevenue += amount;
        if (createdAt >= startOfToday) todayRevenue += amount;
      }
    });
    monthRevenue = thisMonthRevenue;
    momGrowth = lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : thisMonthRevenue > 0 ? 100 : 0;
  }

  // Enrollments — FIX: paidEnrollments = payment_status === 'completed' only
  if (enrollmentsRes.status === "fulfilled" && !enrollmentsRes.value.error) {
    const enrollmentsList = enrollmentsRes.value.data ?? [];
    totalEnrollments = enrollmentsList.length;
    const courseCountsMap: Record<string, number> = {};

    enrollmentsList.forEach((enrollment: any) => {
      const courseTitle = enrollment.courses?.title || "Unknown Course";
      // FIX: Only count PAID enrollments in course breakdown
      // Total enrollments = all; courseEnrollments = paid only
      if (enrollment.payment_status === "completed") {
        paidEnrollments += 1;
        // Only add to per-course count if PAID
        courseCountsMap[courseTitle] = (courseCountsMap[courseTitle] || 0) + 1;
      } else if (enrollment.courses?.is_free === true) {
        freeEnrollments += 1;
        // Free courses also count in course breakdown
        courseCountsMap[courseTitle] = (courseCountsMap[courseTitle] || 0) + 1;
      }
      if (enrollment.payment_status !== "completed" && enrollment.courses?.is_free !== true) {
        pendingEnrollments += 1;
      }
      if (enrollment.enrolled_at >= startOfWeek) newEnrollmentsThisWeek += 1;
    });
    courseEnrollments = Object.entries(courseCountsMap)
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count);
  }

  // New users
  if (newUsersMonthRes.status === "fulfilled" && !newUsersMonthRes.value.error) {
    const authUsers = newUsersMonthRes.value.data?.users ?? [];
    newUsersThisMonth = authUsers.filter((u: any) => u.created_at >= startOfCurrentMonth).length;
  } else {
    try {
      const { count } = await supabaseServer.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", startOfCurrentMonth);
      newUsersThisMonth = count ?? 0;
    } catch (err) {
      // Fallback path already; leave the stat at 0 but record why.
      console.warn("[dashboard] new-users fallback count failed:", err);
    }
  }

  // Active users
  if (activeUsersRes.status === "fulfilled" && !activeUsersRes.value.error) {
    const progressList = activeUsersRes.value.data ?? [];
    activeUsers = new Set(progressList.map((p: any) => p.user_id)).size;
  }

  // Products
  if (productsRes.status === "fulfilled" && !productsRes.value.error) {
    const productsList = productsRes.value.data ?? [];
    totalProducts = productsList.length;
    const categoryMap: Record<string, number> = {};
    productsList.forEach((product: any) => {
      // Only mark out-of-stock when qty is explicitly 0 (not null=unlimited)
      if (product.stock_quantity === 0) outOfStockProducts += 1;
      const cat = product.category || "Uncategorized";
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });
    productsByCategory = Object.entries(categoryMap).map(([category, count]) => ({ category, count }));
  }

  // FIX: Cross-check revenue with payments table (captured).
  // Razorpay stores amount in RUPEES in our payments table (same as orders).
  // If capturedPaymentsRevenue > ordersRevenue, it means some paid orders have
  // pending/failed status (race condition or webhook delay) — use payments as source of truth.
  if (capturedPaymentsRes.status === "fulfilled" && !capturedPaymentsRes.value.error) {
    const capturedList = capturedPaymentsRes.value.data ?? [];
    const capturedPaymentsRevenue = capturedList.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
    // Use whichever is higher — captures any gap between orders status and actual payment
    if (capturedPaymentsRevenue > totalRevenue) {
      totalRevenue = capturedPaymentsRevenue;
    }
  }

  // Promo codes — use both tables, sum up
  let promoCount = 0, couponCount = 0;
  if (promoCodesCountRes.status === "fulfilled" && !promoCodesCountRes.value.error) {
    promoCount = promoCodesCountRes.value.count ?? 0;
  }
  if (couponsCountRes.status === "fulfilled" && !couponsCountRes.value.error) {
    couponCount = couponsCountRes.value.count ?? 0;
  }
  // FIX: Only count coupons table (what the app validates against)
  // promo_codes table is admin-only and NOT used by the app checkout
  activePromoCodes = couponCount;

  // Payments
  if (paymentsSuccessRes.status === "fulfilled" && !paymentsSuccessRes.value.error) {
    successPayments = paymentsSuccessRes.value.count ?? 0;
  }
  if (paymentsFailedRes.status === "fulfilled" && !paymentsFailedRes.value.error) {
    failedPayments = paymentsFailedRes.value.count ?? 0;
  }

  // Recent payments
  if (recentPaymentsRes.status === "fulfilled" && !recentPaymentsRes.value.error) {
    const rawPayments = recentPaymentsRes.value.data ?? [];
    recentPayments = rawPayments.map((p: any) => ({
      id: p.id, amount: p.amount, status: p.status, created_at: p.created_at,
      profiles: profilesMap.get(p.user_id) || { email: "Unknown User" }
    }));
  }

  // Recent orders
  if (recentOrdersRes.status === "fulfilled" && !recentOrdersRes.value.error) {
    const rawOrders = recentOrdersRes.value.data ?? [];
    recentOrders = rawOrders.map((o: any) => ({
      id: o.id, total_amount: o.total_amount, status: o.status, created_at: o.created_at,
      profiles: profilesMap.get(o.user_id) || { email: "Unknown User" }
    }));
  }

  const chartData: DayRevenue[] = Object.entries(chartDataMap)
    .map(([date, data]) => ({ date, label: data.label, revenue: data.revenue, orders: data.orders }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const stats: DashboardStats = {
    totalRevenue, monthRevenue, todayRevenue, momGrowth,
    totalOrders, pendingOrders,
    totalEnrollments, paidEnrollments, freeEnrollments, pendingEnrollments, newEnrollmentsThisWeek, courseEnrollments,
    totalUsers, newUsersThisMonth, activeUsers,
    totalProducts, outOfStockProducts, productsByCategory,
    activePromoCodes,
    successPayments, failedPayments, refundsCount, totalRefundedAmount
  };

  return (
    <DashboardClient stats={stats} chartData={chartData} recentPayments={recentPayments} recentOrders={recentOrders} />
  );
}
