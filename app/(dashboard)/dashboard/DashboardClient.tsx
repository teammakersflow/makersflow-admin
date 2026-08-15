"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";
import { StatCard } from "@/components/ui/stat-card";
import {
  Users, BookOpen, Package, ShoppingCart, DollarSign,
  GraduationCap, Tag, XCircle, Clock, RefreshCw,
  TrendingUp, AlertTriangle, CheckCircle, ArrowUpRight, HelpCircle
} from "lucide-react";

export type DayRevenue = {
  date: string;
  label: string;
  revenue: number;
  orders: number;
};

export type RecentPayment = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  profiles: { email: string } | null;
};

export type RecentOrder = {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
  profiles: { email: string } | null;
};

export type DashboardStats = {
  totalRevenue: number;
  monthRevenue: number;
  todayRevenue: number;
  momGrowth: number;
  totalOrders: number;
  pendingOrders: number;
  totalEnrollments: number;
  paidEnrollments: number;
  freeEnrollments: number;
  pendingEnrollments: number;
  newEnrollmentsThisWeek: number;
  courseEnrollments: { title: string; count: number }[];
  totalUsers: number;
  newUsersThisMonth: number;
  activeUsers: number;
  totalProducts: number;
  outOfStockProducts: number;
  productsByCategory: { category: string; count: number }[];
  activePromoCodes: number;
  successPayments: number;
  failedPayments: number;
  refundsCount: number;
  totalRefundedAmount: number;
};

interface DashboardClientProps {
  stats: DashboardStats;
  chartData: DayRevenue[];
  recentPayments: RecentPayment[];
  recentOrders: RecentOrder[];
}

export default function DashboardClient({ stats, chartData, recentPayments, recentOrders }: DashboardClientProps) {
  // Auto-refresh dashboard every 60 seconds (skip if user is interacting)
  useEffect(() => {
    const id = setInterval(() => {
      const active = document.activeElement;
      const isEditing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT");
      if (!isEditing) window.location.reload();
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const [revenueGoal, setRevenueGoal] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Number(localStorage.getItem("revenue_goal") ?? 0);
    }
    return 0;
  });
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");

  const saveGoal = () => {
    const n = Number(goalInput);
    if (n > 0) {
      setRevenueGoal(n);
      localStorage.setItem("revenue_goal", String(n));
    }
    setEditingGoal(false);
  };

  const goalProgress = revenueGoal > 0 ? Math.min(100, Math.round((stats.monthRevenue / revenueGoal) * 100)) : 0;

  const successRate = stats.successPayments + stats.failedPayments > 0
    ? Math.round((stats.successPayments / (stats.successPayments + stats.failedPayments)) * 100)
    : 100;

  const momSign = stats.momGrowth > 0 ? "+" : "";
  const momColor = stats.momGrowth > 0 ? "text-green-600" : stats.momGrowth < 0 ? "text-red-600" : "text-gray-500";

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label="Total Revenue"
          value={`₹${stats.totalRevenue.toLocaleString()}`}
          sub="All paid orders (any status)"
          icon={DollarSign}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          href="/orders"
        />
        <StatCard
          label="This Month"
          value={`₹${stats.monthRevenue.toLocaleString()}`}
          sub={
            <span className="text-xs">
              MoM growth: <strong className={momColor}>{momSign}{stats.momGrowth.toFixed(1)}%</strong>
            </span>
          }
          icon={TrendingUp}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          href="/reports"
        />
        <StatCard
          label="Today's Revenue"
          value={`₹${stats.todayRevenue.toLocaleString()}`}
          sub="All paid orders today"
          icon={DollarSign}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
          href="/orders"
        />
        <StatCard
          label="Total Orders"
          value={stats.totalOrders}
          sub={`${stats.pendingOrders} pending`}
          icon={ShoppingCart}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          href="/orders"
        />
        <StatCard
          label="Enrollments"
          value={stats.totalEnrollments}
          sub={`${stats.newEnrollmentsThisWeek} new this week`}
          icon={GraduationCap}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          href="/lms-purchases"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          sub={`${stats.newUsersThisMonth} new / month`}
          icon={Users}
          iconColor="text-slate-600"
          iconBg="bg-slate-50"
          href="/users"
        />
        <StatCard
          label="Active Users"
          value={stats.activeUsers}
          sub="LMS last 7 days"
          icon={Users}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
          href="/users"
        />
        <StatCard
          label="Products"
          value={stats.totalProducts}
          sub={`${stats.outOfStockProducts} out of stock`}
          icon={Package}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
          href="/products"
        />
        <StatCard
          label="Coupons"
          value={stats.activePromoCodes}
          sub="Active in app"
          icon={Tag}
          iconColor="text-pink-600"
          iconBg="bg-pink-50"
          href="/coupons"
        />
        <StatCard
          label="Success Rate"
          value={`${successRate}%`}
          sub="Payments capture"
          icon={CheckCircle}
          iconColor={successRate >= 90 ? "text-green-600" : "text-amber-600"}
          iconBg={successRate >= 90 ? "bg-green-50" : "bg-amber-50"}
          href="/payments"
        />
        <StatCard
          label="Refunds"
          value={stats.refundsCount}
          sub={`₹${stats.totalRefundedAmount.toLocaleString()}`}
          icon={RefreshCw}
          iconColor="text-gray-600"
          iconBg="bg-gray-100"
          href="/refunds"
        />
        <StatCard
          label="Failed Pay"
          value={stats.failedPayments}
          sub="Review payments"
          icon={XCircle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
          href="/payments"
        />
      </div>

      {/* Alerts */}
      {/* Revenue Goal Tracker */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Monthly Revenue Goal</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {revenueGoal > 0 ? `₹${stats.monthRevenue.toLocaleString()} of ₹${revenueGoal.toLocaleString()} this month` : "Set a goal to track progress"}
            </p>
          </div>
          <button onClick={() => { setGoalInput(String(revenueGoal)); setEditingGoal(v => !v); }}
            className="text-xs text-blue-600 font-semibold hover:underline">
            {editingGoal ? "Cancel" : revenueGoal > 0 ? "Edit goal" : "Set goal"}
          </button>
        </div>
        {editingGoal && (
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
              <input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)}
                placeholder="e.g. 50000" className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <button onClick={saveGoal} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition">Save</button>
          </div>
        )}
        {revenueGoal > 0 && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span className={goalProgress >= 100 ? "text-green-600 font-bold" : ""}>{goalProgress}% achieved</span>
              <span>₹{Math.max(0, revenueGoal - stats.monthRevenue).toLocaleString()} remaining</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${goalProgress >= 100 ? "bg-green-500" : goalProgress >= 75 ? "bg-blue-500" : goalProgress >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                style={{ width: `${goalProgress}%` }} />
            </div>
          </div>
        )}
      </div>

      {(stats.outOfStockProducts > 0 || stats.failedPayments > 0 || stats.pendingOrders > 0) && (
        <div className="flex flex-wrap gap-3">
          {stats.outOfStockProducts > 0 && (
            <Link href="/products" className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5 text-sm hover:bg-amber-100 transition shadow-2xs">
              <AlertTriangle size={15} className="shrink-0" />
              <span><strong>{stats.outOfStockProducts}</strong> products out of stock</span>
            </Link>
          )}
          {stats.failedPayments > 0 && (
            <Link href="/payments" className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm hover:bg-red-100 transition shadow-2xs">
              <XCircle size={15} className="shrink-0" />
              <span><strong>{stats.failedPayments}</strong> failed payments — review now</span>
            </Link>
          )}
          {stats.pendingOrders > 0 && (
            <Link href="/orders" className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-4 py-2.5 text-sm hover:bg-blue-100 transition shadow-2xs">
              <Clock size={15} className="shrink-0" />
              <span><strong>{stats.pendingOrders}</strong> orders need action</span>
            </Link>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Revenue — Last 30 Days</h2>
              <p className="text-sm text-gray-400">Daily paid and shipped orders</p>
            </div>
            <Link href="/reports" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Full report <ArrowUpRight size={11} />
            </Link>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => v === 0 ? "₹0" : `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", fontSize: 12 }}
                  formatter={(v) => [`₹${Number(v ?? 0).toLocaleString()}`, "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: "#3b82f6" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders bar chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-gray-900">Daily Orders</h2>
            <p className="text-sm text-gray-400">Last 30 days (all orders)</p>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
                  formatter={(v) => [Number(v ?? 0), "Orders"]}
                />
                <Bar dataKey="orders" fill="#818cf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Details Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Enrollments & Courses Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Enrollment Breakdown</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-50 p-3.5 rounded-xl border border-gray-100">
              <span className="text-sm font-medium text-gray-600">Free Enrollments</span>
              <span className="text-sm font-bold text-gray-900">{stats.freeEnrollments}</span>
            </div>
            <div className="flex justify-between items-center bg-blue-50/50 p-3.5 rounded-xl border border-blue-50">
              <span className="text-sm font-medium text-blue-700">Paid Enrollments</span>
              <span className="text-sm font-bold text-blue-900">{stats.paidEnrollments}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm font-medium text-amber-600 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                Pending Payment
              </span>
              <span className="text-sm font-bold text-amber-700">{stats.pendingEnrollments ?? 0}</span>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-2">Course-wise Enrollments</p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 scrollbar-thin">
                {stats.courseEnrollments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No enrollments recorded</p>
                ) : (
                  stats.courseEnrollments.map((course, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs p-2 bg-gray-50/50 rounded-lg">
                      <span className="text-gray-700 truncate max-w-[250px]">{course.title}</span>
                      <span className="font-semibold text-gray-900 shrink-0">{course.count} enrolled</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Product Category Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Product Category Distribution</h2>
          <div className="space-y-3">
            {stats.productsByCategory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">No products found</p>
            ) : (
              stats.productsByCategory.map((c, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50/50 border border-gray-100 rounded-xl">
                  <span className="text-sm font-medium text-gray-700 capitalize">{c.category || "Uncategorized"}</span>
                  <span className="text-sm font-bold text-gray-900">{c.count} products</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Payments */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900 text-sm">Recent Payments</h2>
            <Link href="/payments" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">No payments yet</p>
          ) : recentPayments.map(p => (
            <Link key={p.id} href="/payments" className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition border-t border-gray-50 first:border-0">
              <div className={`h-8 w-8 rounded-full grid place-items-center text-xs font-bold ${p.status === "captured" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                {p.profiles?.email?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.profiles?.email ?? "Unknown"}</p>
                <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gray-900">₹{p.amount.toLocaleString()}</p>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${p.status === "captured" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>{p.status}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900 text-sm">Recent Orders</h2>
            <Link href="/orders" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">No orders yet</p>
          ) : recentOrders.map(o => {
            const STATUS_COLOR: Record<string, string> = {
              pending: "bg-amber-50 text-amber-600",
              paid: "bg-blue-50 text-blue-600",
              shipped: "bg-purple-50 text-purple-600",
              delivered: "bg-green-50 text-green-600",
              cancelled: "bg-red-50 text-red-600",
              refunded: "bg-gray-50 text-gray-500",
            };
            return (
              <Link key={o.id} href="/orders" className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition border-t border-gray-50 first:border-0">
                <div className="h-8 w-8 rounded-full bg-purple-50 grid place-items-center text-purple-600 font-bold text-xs">
                  {o.id.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{o.profiles?.email ?? "Unknown"}</p>
                  <p className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short" })}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900">₹{o.total_amount.toLocaleString()}</p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLOR[o.status] ?? "bg-gray-50 text-gray-500"}`}>{o.status}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
