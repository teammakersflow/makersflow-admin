"use client";

import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { TrendingUp, Download, Package, Tag, GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export type OrderReportItem = {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
  discount_amount: number | null;
  coupon_code: string | null;
  promo_code?: string | null;
};

export type EnrollmentReportItem = {
  id: string;
  enrolled_at: string;
  payment_status: string;
  course_id: string;
  courses: {
    id: string;
    title: string;
    price: number;
    is_free: boolean;
  } | null;
};

interface ReportsClientProps {
  orders: OrderReportItem[];
  enrollments: EnrollmentReportItem[];
}

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];

export default function ReportsClient({ orders, enrollments }: ReportsClientProps) {
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");

  const periodDays = Number(period);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);

  // Filter orders and enrollments for the selected period
  const filteredOrders = orders.filter(o => new Date(o.created_at) >= cutoffDate);
  const filteredEnrollments = enrollments.filter(e => new Date(e.enrolled_at) >= cutoffDate);

  // 1. Total Revenue: SUM(total_amount) WHERE status IN ('paid','shipped')
  const revenueOrders = filteredOrders.filter(o => o.status === "paid" || o.status === "shipped" || o.status === "delivered");
  const totalRevenue = revenueOrders.reduce((sum, o) => sum + o.total_amount, 0);

  // 2. Coupon Savings: SUM(discount_amount) WHERE coupon_code IS NOT NULL
  const couponOrders = filteredOrders.filter(o =>
    (o.coupon_code !== null && o.coupon_code !== "") ||
    (o.promo_code !== null && o.promo_code !== "")
  );
  const couponSavings = couponOrders.reduce((sum, o) => sum + (o.discount_amount ?? 0), 0);

  // Total Orders count
  const totalOrdersCount = filteredOrders.length;

  // 3. Revenue Trend (daily) & Daily Orders
  const dayMap: Record<string, { dateStr: string; label: string; revenue: number; orders: number }> = {};
  for (let i = periodDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    dayMap[dateStr] = { dateStr, label, revenue: 0, orders: 0 };
  }

  // Populate Revenue Trend
  revenueOrders.forEach(o => {
    const dateStr = o.created_at.slice(0, 10);
    if (dayMap[dateStr]) {
      dayMap[dateStr].revenue += o.total_amount;
    }
  });

  // Populate Daily Orders
  filteredOrders.forEach(o => {
    const dateStr = o.created_at.slice(0, 10);
    if (dayMap[dateStr]) {
      dayMap[dateStr].orders += 1;
    }
  });

  const chartData = Object.values(dayMap);

  // 4. Order Status Distribution (for PieChart)
  const statusCounts: Record<string, number> = {};
  filteredOrders.forEach(o => {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  });
  const statusDist = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // 5. Top Coupons by usage
  const couponStatsMap: Record<string, { code: string; uses: number; saved: number }> = {};
  filteredOrders.forEach(o => {
    const appliedCode = o.coupon_code || o.promo_code;
    if (appliedCode) {
      const code = appliedCode.toUpperCase();
      if (!couponStatsMap[code]) {
        couponStatsMap[code] = { code, uses: 0, saved: 0 };
      }
      couponStatsMap[code].uses += 1;
      couponStatsMap[code].saved += (o.discount_amount ?? 0);
    }
  });
  const topCoupons = Object.values(couponStatsMap)
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 5);

  // 5b. GST/Tax breakdown
  const totalTaxCollected = revenueOrders.reduce((s, o) => s + ((o as any).tax_amount ?? 0), 0);
  const gstBreakdown = {
    "0%": revenueOrders.filter((o: any) => (o.tax_amount ?? 0) === 0).length,
    "5%": 0, "12%": 0, "18%": 0, "28%": 0,
  };

  // 5c. Period comparison (same period, previous window)
  const prevCutoffDate = new Date(cutoffDate.getTime() - (Number(period) * 86400000));
  const prevOrders = orders.filter(o => {
    const d = new Date(o.created_at);
    return d >= prevCutoffDate && d < cutoffDate;
  });
  const prevRevenue = prevOrders
    .filter(o => ["paid","packed","shipped","delivered","completed"].includes(o.status))
    .reduce((s, o) => s + o.total_amount, 0);
  const revenueGrowth = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : null;
  const prevOrderCount = prevOrders.length;
  const orderGrowth = prevOrderCount > 0 ? Math.round(((totalOrdersCount - prevOrderCount) / prevOrderCount) * 100) : null;

  // 6. Top Courses — only count PAID (completed) or free enrollments
  const courseStatsMap: Record<string, { title: string; purchases: number; revenue: number }> = {};
  filteredEnrollments
    .filter(e => e.payment_status === "completed" || e.courses?.is_free === true)
    .forEach(e => {
      const courseTitle = e.courses?.title ?? "Unknown Course";
      const coursePrice = e.courses?.is_free ? 0 : (e.courses?.price ?? 0);
      if (!courseStatsMap[courseTitle]) {
        courseStatsMap[courseTitle] = { title: courseTitle, purchases: 0, revenue: 0 };
      }
      courseStatsMap[courseTitle].purchases += 1;
      courseStatsMap[courseTitle].revenue += coursePrice;
    });
  const topCourses = Object.values(courseStatsMap)
    .sort((a, b) => b.purchases - a.purchases)
    .slice(0, 5);

  const printReport = () => { window.print(); };

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Revenue,Orders\n";
    chartData.forEach(row => {
      csvContent += `${row.dateStr},${row.revenue},${row.orders}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `makersflow_report_${period}_days.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-7">
      <PageHeader title="Reports" description="Revenue, sales and performance analytics">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(["7", "30", "90"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                period === p ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {p === "7" ? "7 days" : p === "30" ? "30 days" : "90 days"}
            </button>
          ))}
        </div>
        <button onClick={printReport}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition cursor-pointer">
          🖨 Print
        </button>
        <button onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition cursor-pointer">
          <Download size={15} /> Export CSV
        </button>
      </PageHeader>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Revenue", value: `₹${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50", growth: revenueGrowth },
          { label: "Total Orders", value: totalOrdersCount, icon: Package, color: "text-blue-600", bg: "bg-blue-50", growth: orderGrowth },
          { label: "Coupon Savings", value: `₹${couponSavings.toLocaleString()}`, icon: Tag, color: "text-pink-600", bg: "bg-pink-50", growth: null },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs">
              <div className={`inline-flex p-2.5 rounded-xl ${s.bg} mb-3`}><Icon size={18} className={s.color} /></div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-1 text-sm">Revenue Trend</h3>
          <p className="text-xs text-gray-400 mb-5">Daily revenue over the selected period</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={Math.floor(chartData.length / 7)} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => v ? `₹${(v/1000).toFixed(0)}k` : "₹0"} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
                  formatter={(v) => [`₹${Number(v ?? 0).toLocaleString()}`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: "#3b82f6" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-1 text-sm">Order Status</h3>
          <p className="text-xs text-gray-400 mb-5">Distribution of order statuses</p>
          {statusDist.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-gray-400 bg-gray-50/50 rounded-xl">No orders in this period</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusDist} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily orders bar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-1 text-sm">Daily Orders</h3>
          <p className="text-xs text-gray-400 mb-5">Transaction count per day</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={Math.floor(chartData.length / 7)} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }} />
                <Bar dataKey="orders" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top courses */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
            <GraduationCap size={16} className="text-blue-500" /> Top Courses
          </h3>
          {topCourses.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-gray-400 bg-gray-50/50 rounded-xl">No enrollment data</div>
          ) : (
            <div className="space-y-4">
              {topCourses.map((c, i) => (
                <div key={c.title} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5">#{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{c.title}</p>
                    <div className="mt-1.5 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (c.purchases / (topCourses[0]?.purchases || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-gray-900">₹{c.revenue.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400">{c.purchases} enrolled</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* GST / Tax Report */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">GST / Tax Report</h3>
          <span className="text-xs text-gray-400">For the selected period</span>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-blue-900">₹{totalTaxCollected.toLocaleString()}</p>
              <p className="text-xs text-blue-600 mt-1">Total Tax Collected</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-gray-900">{revenueOrders.length}</p>
              <p className="text-xs text-gray-500 mt-1">Taxable Orders</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-green-900">
                ₹{(totalRevenue - totalTaxCollected).toLocaleString()}
              </p>
              <p className="text-xs text-green-600 mt-1">Revenue excl. GST</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            GST collected = tax_amount column from orders. For detailed slab-wise GST report, export CSV and filter by product GST rate.
          </p>
        </div>
      </div>

      {/* Coupons stats */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <h3 className="font-semibold text-gray-900 text-sm">Top Coupons by Usage</h3>
        </div>
        {topCoupons.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-400">No coupon usage recorded in this period</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {topCoupons.map(c => (
              <div key={c.code} className="flex items-center gap-4 px-6 py-4">
                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                  {c.code}
                </span>
                <span className="text-xs text-gray-500">Saved: ₹{c.saved.toLocaleString()}</span>
                <div className="flex-1 mx-4">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-pink-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (c.uses / (topCoupons[0]?.uses || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-900">{c.uses} uses</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
