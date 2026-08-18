"use client";

/**
 * IMPORTANT ARCHITECTURE NOTE — read before touching this file.
 *
 * The old version of this page was a Next.js Server Component that ran on
 * the server with a privileged service key, bypassing auth entirely.
 * Our new auth stores the JWT in the browser's localStorage (see
 * lib/api-client.ts), which a server component has no access to. So this
 * page is now a CLIENT component that fetches once the browser has the
 * token, same pattern as app/(dashboard)/layout.tsx.
 *
 * DATA GAPS vs the previous version — worth raising with the backend team,
 * don't treat the numbers below as silently equivalent:
 *
 * 1. `activeUsers` now comes from GET /analytics/dashboard, which counts
 *    distinct LOGINS in the last 30 days. The old figure counted distinct
 *    users with lesson-watch activity in the last 7 days. Different signal,
 *    different window — not a bug, just not the same metric anymore.
 * 2. `newUsersThisMonth` and the email lookups for recent orders/payments
 *    are computed from GET /users?limit=1000. If you ever have more than
 *    1000 users, this undercounts / can show "Unknown User" for anyone
 *    outside that page. GET /users has no `createdAfter` filter yet — ask
 *    your friend to add one if this becomes a real limitation.
 * 3. GET /orders, /payments, /products, /coupons, /enrollments, /courses
 *    all return the FULL table with no filters or pagination. This page
 *    pulls all of them and aggregates client-side. Fine at current data
 *    volume; will get slow as the tables grow. Ask her to add query
 *    params (date range, status, etc.) when that starts to matter.
 */

import { useEffect, useState } from "react";
import { apiFetch, tokenStore } from "@/lib/api-client";
import DashboardClient, {
  DayRevenue,
  RecentPayment,
  RecentOrder,
  DashboardStats,
} from "./DashboardClient";

type Order = {
  id: string; total_amount: number; status: string; created_at: string; user_id: string;
};
type Payment = {
  id: string; amount: number; status: string; created_at: string; user_id: string;
};
type Enrollment = {
  id: string; payment_status: string; enrolled_at: string; course_id: number | string;
};
type Course = { id: number | string; title: string; is_free: boolean | null };
type Product = {
  id: number | string; in_stock: boolean | null; category: string | null; stock_quantity: number;
};
type Coupon = { id: string; is_active: boolean | null };
type PublicUser = {
  id: string; email: string; full_name: string | null; created_at: string;
};
type AnalyticsDashboard = {
  revenue: number; students: number; courses: number; sales: number;
  certificates: number; watchTime: number; activeUsers: number;
};

// GET /users returns { data, pagination } — apiFetch only gives back `data`,
// so we fetch this one endpoint directly to also read `pagination.total`.
async function fetchUsersPage(): Promise<{ data: PublicUser[]; total: number }> {
  const token = tokenStore.getAccessToken();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users?limit=1000`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = await res.json();
  return { data: json?.data ?? [], total: json?.pagination?.total ?? (json?.data?.length ?? 0) };
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<DayRevenue[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const startOfWeek = new Date(now.getTime() - 7 * 86400000).toISOString();

        const [
          analytics, orders, payments, enrollments, courses, products, coupons, usersPage,
        ] = await Promise.all([
          apiFetch<AnalyticsDashboard>("/analytics/dashboard").catch(() => null),
          apiFetch<Order[]>("/orders").catch(() => []),
          apiFetch<Payment[]>("/payments").catch(() => []),
          apiFetch<Enrollment[]>("/enrollments").catch(() => []),
          apiFetch<Course[]>("/courses").catch(() => []),
          apiFetch<Product[]>("/products").catch(() => []),
          apiFetch<Coupon[]>("/coupons").catch(() => []),
          fetchUsersPage().catch(() => ({ data: [] as PublicUser[], total: 0 })),
        ]);

        if (cancelled) return;

        const userMap = new Map<string, { email: string; full_name: string | null }>();
        usersPage.data.forEach((u) => userMap.set(u.id, { email: u.email, full_name: u.full_name }));

        // ---- 30-day revenue/orders chart + revenue rollups ----
        const chartDataMap: Record<string, { label: string; revenue: number; orders: number }> = {};
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 86400000);
          const dateStr = d.toISOString().slice(0, 10);
          chartDataMap[dateStr] = {
            label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
            revenue: 0, orders: 0,
          };
        }

        let totalRevenue = 0, monthRevenue = 0, todayRevenue = 0, momGrowth = 0;
        let totalOrders = orders.length, pendingOrders = 0;
        let refundsCount = 0, totalRefundedAmount = 0;
        let thisMonthRevenue = 0, lastMonthRevenue = 0;
        // These two lists are intentionally DIFFERENT and are copied verbatim
        // from the original dashboard so the figures do not change:
        //   - the 30-day chart excludes "completed"
        //   - the revenue totals include it
        // NOTE for the team: neither list contains "out_for_delivery", even
        // though that order IS paid. That was true of the original dashboard
        // too, so it is preserved here rather than silently changing revenue.
        // If it should count, add it to BOTH lists.
        const CHART_PAID_STATUSES = ["paid", "processing", "shipped", "delivered", "packed"];
        const TOTAL_PAID_STATUSES = ["paid", "processing", "packed", "shipped", "delivered", "completed"];

        orders.forEach((order) => {
          // created_at is nullable in the schema, so guard before slicing.
          const dateStr = (order.created_at ?? "").slice(0, 10);
          if (chartDataMap[dateStr]) {
            chartDataMap[dateStr].orders += 1;
            if (CHART_PAID_STATUSES.includes(order.status)) chartDataMap[dateStr].revenue += order.total_amount;
          }
          if (order.status === "pending") pendingOrders += 1;
          else if (order.status === "cancelled") { refundsCount += 1; totalRefundedAmount += order.total_amount; }
          if (TOTAL_PAID_STATUSES.includes(order.status)) {
            totalRevenue += order.total_amount;
            if ((order.created_at ?? "") >= startOfCurrentMonth) thisMonthRevenue += order.total_amount;
            else if ((order.created_at ?? "") >= startOfLastMonth && (order.created_at ?? "") < startOfCurrentMonth) lastMonthRevenue += order.total_amount;
            if ((order.created_at ?? "") >= startOfToday) todayRevenue += order.total_amount;
          }
        });
        monthRevenue = thisMonthRevenue;
        momGrowth = lastMonthRevenue > 0
          ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
          : thisMonthRevenue > 0 ? 100 : 0;

        // Cross-check against captured payments, same "use whichever is higher" rule as before.
        const capturedRevenue = payments
          .filter((p) => p.status === "captured")
          .reduce((s, p) => s + p.amount, 0);
        if (capturedRevenue > totalRevenue) totalRevenue = capturedRevenue;

        // ---- Enrollments (joined client-side against /courses) ----
        const courseMap = new Map<string, { title: string; is_free: boolean }>();
        courses.forEach((c) => courseMap.set(String(c.id), { title: c.title, is_free: !!c.is_free }));

        let paidEnrollments = 0, freeEnrollments = 0, pendingEnrollments = 0, newEnrollmentsThisWeek = 0;
        const courseCountsMap: Record<string, number> = {};
        enrollments.forEach((e) => {
          const course = courseMap.get(String(e.course_id));
          const title = course?.title ?? "Unknown Course";
          if (e.payment_status === "completed") {
            paidEnrollments += 1;
            courseCountsMap[title] = (courseCountsMap[title] || 0) + 1;
          } else if (course?.is_free) {
            freeEnrollments += 1;
            courseCountsMap[title] = (courseCountsMap[title] || 0) + 1;
          }
          if (e.payment_status !== "completed" && !course?.is_free) pendingEnrollments += 1;
          if ((e.enrolled_at ?? "") >= startOfWeek) newEnrollmentsThisWeek += 1;
        });
        const courseEnrollments = Object.entries(courseCountsMap)
          .map(([title, count]) => ({ title, count }))
          .sort((a, b) => b.count - a.count);

        // ---- Products ----
        let outOfStockProducts = 0;
        const categoryMap: Record<string, number> = {};
        products.forEach((p) => {
          if (p.stock_quantity === 0) outOfStockProducts += 1;
          const cat = p.category || "Uncategorized";
          categoryMap[cat] = (categoryMap[cat] || 0) + 1;
        });
        const productsByCategory = Object.entries(categoryMap).map(([category, count]) => ({ category, count }));

        // ---- Coupons (canonical — promo_codes table isn't used by checkout) ----
        const activePromoCodes = coupons.filter((c) => c.is_active).length;

        // ---- Payments ----
        const successPayments = payments.filter((p) => p.status === "captured").length;
        const failedPayments = payments.filter((p) => p.status === "failed").length;

        const recentPaymentsList: RecentPayment[] = [...payments]
          .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
          .slice(0, 5)
          .map((p) => ({
            id: p.id, amount: p.amount, status: p.status, created_at: p.created_at,
            profiles: userMap.get(p.user_id) ? { email: userMap.get(p.user_id)!.email } : { email: "Unknown User" },
          }));

        const recentOrdersList: RecentOrder[] = [...orders]
          .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
          .slice(0, 5)
          .map((o) => ({
            id: o.id, total_amount: o.total_amount, status: o.status, created_at: o.created_at,
            profiles: userMap.get(o.user_id) ? { email: userMap.get(o.user_id)!.email } : { email: "Unknown User" },
          }));

        const newUsersThisMonth = usersPage.data.filter((u) => (u.created_at ?? "") >= startOfCurrentMonth).length;

        const finalStats: DashboardStats = {
          totalRevenue, monthRevenue, todayRevenue, momGrowth,
          totalOrders, pendingOrders,
          totalEnrollments: enrollments.length, paidEnrollments, freeEnrollments, pendingEnrollments,
          newEnrollmentsThisWeek, courseEnrollments,
          totalUsers: usersPage.total, newUsersThisMonth,
          activeUsers: analytics?.activeUsers ?? 0,
          totalProducts: products.length, outOfStockProducts, productsByCategory,
          activePromoCodes,
          successPayments, failedPayments, refundsCount, totalRefundedAmount,
        };

        const chart: DayRevenue[] = Object.entries(chartDataMap)
          .map(([date, data]) => ({ date, label: data.label, revenue: data.revenue, orders: data.orders }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setStats(finalStats);
        setChartData(chart);
        setRecentPayments(recentPaymentsList);
        setRecentOrders(recentOrdersList);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Couldn't load dashboard data{error ? `: ${error}` : "."}
      </div>
    );
  }

  return (
    <DashboardClient stats={stats} chartData={chartData} recentPayments={recentPayments} recentOrders={recentOrders} />
  );
}
