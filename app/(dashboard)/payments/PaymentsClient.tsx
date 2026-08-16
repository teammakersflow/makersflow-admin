"use client";

import React, { useState, useEffect } from "react";
import { backendApi } from "@/lib/backend-api";
import { Search, TrendingUp, CreditCard, XCircle, AlertCircle, ChevronDown, ChevronUp, Download, RefreshCw, CheckCircle } from "lucide-react";

export type Payment = {
  id: string;
  user_id: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  amount: number;
  currency: string;
  status: "pending" | "captured" | "failed" | "refunded";
  failure_reason: string | null;
  failure_code: string | null;
  failure_description: string | null;
  refund_id: string | null;
  refund_amount: number | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string | null;
  profiles?: { email: string; full_name: string | null } | null;
};

const FAILURE_REASONS: Record<string, string> = {
  "BAD_REQUEST_ERROR": "Bad request — invalid card or bank details",
  "GATEWAY_ERROR": "Payment gateway error — bank temporarily unavailable",
  "SERVER_ERROR": "Server error — Razorpay internal issue",
  "payment_cancelled": "User cancelled the payment",
  "payment_timeout": "Payment session timed out",
  "insufficient_funds": "Insufficient funds in account",
  "card_declined": "Card was declined by bank",
};

const STATUS_COLORS: Record<string, string> = {
  captured: "bg-green-100 text-green-800",
  pending:  "bg-amber-100 text-amber-800",
  failed:   "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-700",
};

interface PaymentsClientProps {
  initialPayments: Payment[];
}

export default function PaymentsClient({ initialPayments }: PaymentsClientProps) {
  // FIX: Start with server-provided payments, then refresh client-side to ensure data loads
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [loading, setLoading] = useState(initialPayments.length === 0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Always fetch client-side on mount to get the most current data
  // (server-side may have RLS issues or stale data)
  useEffect(() => {
    fetchPaymentsClientSide();
  }, []);

  async function fetchPaymentsClientSide() {
    setLoading(true);
    try {
      // Try payments table first (full columns)
      const { data: paymentsData, error: paymentsError } = await backendApi
        .endpoint("/payments")
        .select("id, user_id, razorpay_order_id, razorpay_payment_id, amount, currency, status, failure_reason, refund_id, refund_amount, refunded_at, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (!paymentsError && paymentsData && paymentsData.length > 0) {
        await enrichWithProfiles(paymentsData);
        return;
      }

      // Fallback: minimal payments columns
      const { data: minData, error: minError } = await backendApi
        .endpoint("/payments")
        .select("id, user_id, razorpay_order_id, razorpay_payment_id, amount, currency, status, created_at")
        .order("created_at", { ascending: false });

      if (!minError && minData && minData.length > 0) {
        await enrichWithProfiles(minData);
        return;
      }

      // FINAL FALLBACK: Use orders table as payment records
      // This covers the case where app writes to orders but not payments table
      console.warn("Payments table empty or inaccessible — falling back to orders table");
      const { data: ordersData, error: ordersError } = await backendApi
        .endpoint("/orders")
        .select("id, user_id, razorpay_order_id, razorpay_payment_id, total_amount, status, coupon_code, discount_amount, created_at")
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.error("Orders fallback also failed:", ordersError.message);
        setLoading(false);
        return;
      }

      // Map orders to Payment shape
      const mapped = (ordersData ?? []).map((o: any) => ({
        id: o.id,
        user_id: o.user_id,
        razorpay_order_id: o.razorpay_order_id ?? null,
        razorpay_payment_id: o.razorpay_payment_id ?? null,
        razorpay_signature: null,
        amount: o.total_amount ?? 0,
        currency: "INR",
        // Map order status to payment status
        status: o.status === "paid" || o.status === "shipped" || o.status === "delivered" || o.status === "packed"
          ? "captured"
          : o.status === "cancelled" || o.status === "refunded"
            ? "refunded"
            : o.status === "failed"
              ? "failed"
              : "pending",
        failure_reason: null,
        failure_code: null,
        failure_description: null,
        refund_id: null,
        refund_amount: null,
        refunded_at: null,
        created_at: o.created_at,
        updated_at: null,
      }));
      await enrichWithProfiles(mapped);
    } catch (err) {
      console.error("Error fetching payments:", err);
    } finally {
      setLoading(false);
    }
  }

  async function enrichWithProfiles(rawPayments: any[]) {
    if (rawPayments.length === 0) { setPayments([]); return; }

    // Get unique user IDs
    const userIds = [...new Set(rawPayments.map(p => p.user_id).filter(Boolean))];

    // Fetch profiles for those users
    const { data: profilesData } = await backendApi
      .endpoint("/users")
      .select("id, email, full_name")
      .in("id", userIds.slice(0, 1000)); // max 1000

    const profilesMap = new Map<string, { email: string; full_name: string | null }>();
    (profilesData ?? []).forEach((p: any) => {
      profilesMap.set(p.id, { email: p.email || "", full_name: p.full_name || null });
    });

    const enriched: Payment[] = rawPayments.map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      razorpay_order_id: p.razorpay_order_id ?? null,
      razorpay_payment_id: p.razorpay_payment_id ?? null,
      razorpay_signature: p.razorpay_signature ?? null,
      amount: p.amount ?? 0,
      currency: p.currency ?? "INR",
      status: p.status ?? "pending",
      failure_reason: p.failure_reason ?? null,
      failure_code: p.failure_code ?? null,
      failure_description: p.failure_description ?? null,
      refund_id: p.refund_id ?? null,
      refund_amount: p.refund_amount ?? null,
      refunded_at: p.refunded_at ?? null,
      created_at: p.created_at,
      updated_at: p.updated_at ?? null,
      profiles: profilesMap.get(p.user_id) || null,
    }));

    setPayments(enriched);
  }

  const filtered = payments.filter(p => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchSearch = !search ||
      (p.profiles?.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.profiles?.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.razorpay_payment_id ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.razorpay_order_id ?? "").toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    const matchDate = !dateFilter || p.created_at.startsWith(dateFilter);
    return matchStatus && matchSearch && matchDate;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Metrics from ALL payments
  const totalRevenue = payments.filter(p => p.status === "captured").reduce((s, p) => s + (p.amount ?? 0), 0);
  const successfulCount = payments.filter(p => p.status === "captured").length;
  const failedCount = payments.filter(p => p.status === "failed").length;
  const pendingCount = payments.filter(p => p.status === "pending").length;
  const totalPayments = payments.length;
  const successRate = totalPayments > 0 ? Math.round((successfulCount / totalPayments) * 100) : 0;
  const totalRefunded = payments.reduce((s, p) => s + (p.refund_amount ?? 0), 0);

  // Today's summary
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayPayments = payments.filter(p => new Date(p.created_at) >= todayStart);
  const todayRevenue = todayPayments.filter(p => p.status === "captured").reduce((s, p) => s + p.amount, 0);
  const todayCount = todayPayments.filter(p => p.status === "captured").length;

  const exportCSV = () => {
    const rows = [["Payment ID", "Order ID", "Customer Email", "Amount", "Status", "Refund Amount", "Date"]];
    filtered.forEach(p => rows.push([
      p.razorpay_payment_id ?? "", p.razorpay_order_id ?? "",
      p.profiles?.email ?? p.user_id?.slice(0, 8) ?? "",
      String(p.amount), p.status,
      String(p.refund_amount ?? 0),
      new Date(p.created_at).toLocaleDateString("en-IN"),
    ]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `payments_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const handleSearch = (v: string) => { setSearch(v); setCurrentPage(1); };
  const handleStatus = (v: string) => { setStatusFilter(v); setCurrentPage(1); };
  const handleDate = (v: string) => { setDateFilter(v); setCurrentPage(1); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">All Razorpay transactions with metrics and failure reasons</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchPaymentsClientSide}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards — all dynamic */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Revenue", value: loading ? "..." : `₹${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
          { label: "Successful", value: loading ? "..." : successfulCount, icon: CheckCircle, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Pending", value: loading ? "..." : pendingCount, icon: RefreshCw, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Failed", value: loading ? "..." : failedCount, icon: XCircle, color: "text-red-600", bg: "bg-red-50", alert: failedCount > 0 },
          {
            label: "Success Rate",
            value: loading ? "..." : `${successRate}%`,
            icon: TrendingUp,
            color: successRate >= 90 ? "text-green-600" : successRate >= 75 ? "text-amber-600" : "text-red-600",
            bg: successRate >= 90 ? "bg-green-50" : successRate >= 75 ? "bg-amber-50" : "bg-red-50"
          },
          { label: "Total Refunded", value: loading ? "..." : `₹${totalRefunded.toLocaleString()}`, icon: XCircle, color: "text-gray-600", bg: "bg-gray-50" },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label}
              className={`bg-white rounded-xl border p-4 shadow-2xs ${(stat as any).alert ? "border-red-200" : "border-gray-200"}`}>
              <div className={`inline-flex p-2 rounded-lg ${stat.bg} mb-3`}>
                <Icon size={18} className={stat.color} />
              </div>
              <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Today's summary */}
      {!loading && todayCount > 0 && (
        <div className="flex items-center gap-4 bg-green-50 border border-green-200 rounded-xl px-5 py-3">
          <div className="flex-1">
            <p className="text-sm font-bold text-green-900">Today's collections</p>
            <p className="text-xs text-green-600 mt-0.5">{todayCount} successful payment{todayCount > 1 ? "s" : ""} so far today</p>
          </div>
          <p className="text-2xl font-bold text-green-700">₹{todayRevenue.toLocaleString()}</p>
        </div>
      )}

      {/* Failed alert */}
      {!loading && failedCount > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-900">{failedCount} failed payment{failedCount > 1 ? "s" : ""} detected</p>
            <p className="text-xs text-red-600 mt-0.5">Click each row below to see exact failure details from Razorpay.</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <RefreshCw size={24} className="animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading payment transactions...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input placeholder="Search email, payment ID, order ID..."
                value={search} onChange={e => handleSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 w-80 bg-white" />
            </div>
            <select value={statusFilter} onChange={e => handleStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white">
              <option value="all">All Status</option>
              <option value="captured">✓ Successful</option>
              <option value="pending">⏳ Pending</option>
              <option value="failed">✗ Failed</option>
              <option value="refunded">↩ Refunded</option>
            </select>
            <input type="date" value={dateFilter} onChange={e => handleDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
            {dateFilter && <button onClick={() => handleDate("")} className="text-sm text-gray-500 hover:text-gray-900">✕ Clear</button>}
            {(search || dateFilter || statusFilter !== "all") && (
              <button onClick={() => { handleSearch(""); handleDate(""); handleStatus("all"); }}
                className="text-sm text-red-500 hover:text-red-700">Clear all</button>
            )}
          </div>

          <p className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-800">{filtered.length}</span> of{" "}
            <span className="font-semibold text-gray-800">{payments.length}</span> transactions
          </p>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase text-xs">
                  <tr>
                    <th className="text-left px-6 py-3.5">Payment</th>
                    <th className="text-left px-6 py-3.5">Customer</th>
                    <th className="text-left px-6 py-3.5">Amount</th>
                    <th className="text-left px-6 py-3.5">Refunded</th>
                    <th className="text-left px-6 py-3.5">Status</th>
                    <th className="text-left px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                        <CreditCard size={28} className="mx-auto mb-2 text-gray-300" />
                        <p className="font-medium text-gray-600">No payments found</p>
                        <p className="text-xs mt-1">Payments will appear here once customers make purchases</p>
                      </td>
                    </tr>
                  ) : paginated.map(p => {
                    const isExp = expanded === p.id;
                    return (
                      <React.Fragment key={p.id}>
                        <tr
                          className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${p.status === "failed" ? "bg-red-50/10" : ""}`}
                          onClick={() => setExpanded(isExp ? null : p.id)}>
                          <td className="px-6 py-4">
                            <p className="font-mono text-xs font-bold text-gray-800">{p.razorpay_payment_id ?? "—"}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">Order: {p.razorpay_order_id ?? "—"}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900">{p.profiles?.email ?? p.user_id?.slice(0, 8) ?? "—"}</p>
                            {p.profiles?.full_name && <p className="text-xs text-gray-400 mt-0.5">{p.profiles.full_name}</p>}
                          </td>
                          <td className="px-6 py-4 font-semibold text-gray-900">₹{(p.amount ?? 0).toLocaleString()}</td>
                          <td className="px-6 py-4">
                            {p.refund_amount && p.refund_amount > 0 ? (
                              <span className="text-red-600 font-semibold">₹{p.refund_amount.toLocaleString()}</span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-700"}`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {p.status === "captured" ? "Successful" : p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-500">
                            <div>{new Date(p.created_at).toLocaleDateString("en-IN")}</div>
                            <div className="text-gray-400 mt-0.5">{new Date(p.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                          </td>
                          <td className="px-6 py-4 text-gray-400 text-right">
                            {isExp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </td>
                        </tr>
                        {isExp && (
                          <tr key={`${p.id}-detail`} className="bg-gray-50/50">
                            <td colSpan={7} className="px-6 py-5 border-t border-gray-100">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
                                <div>
                                  <p className="text-xs text-gray-400 uppercase font-bold mb-1">Razorpay Signature</p>
                                  <p className="font-mono text-xs text-gray-600 truncate max-w-[200px]">
                                    {p.razorpay_signature ?? "—"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 uppercase font-bold mb-1">Refund Details</p>
                                  {p.refund_id ? (
                                    <div className="space-y-0.5 text-xs text-gray-600">
                                      <p><span className="font-semibold">Refund ID:</span> <span className="font-mono">{p.refund_id}</span></p>
                                      {p.refunded_at && <p><span className="font-semibold">Refunded at:</span> {new Date(p.refunded_at).toLocaleDateString("en-IN")}</p>}
                                      {p.refund_amount && <p><span className="font-semibold">Amount:</span> ₹{p.refund_amount.toLocaleString()}</p>}
                                    </div>
                                  ) : (
                                    <p className="text-gray-500 text-xs">No refunds processed</p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 uppercase font-bold mb-1">Currency</p>
                                  <p className="text-gray-700 font-medium">{(p.currency ?? "INR").toUpperCase()}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 uppercase font-bold mb-1">Internal Payment ID</p>
                                  <p className="font-mono text-xs text-gray-500">{p.id}</p>
                                </div>
                                {p.status === "failed" && (
                                  <div className="col-span-1 md:col-span-4 bg-red-50 border border-red-100 rounded-xl p-4 space-y-1">
                                    <p className="text-xs font-bold text-red-700 flex items-center gap-1.5 uppercase">
                                      <XCircle size={14} /> Failure Information
                                    </p>
                                    <p className="text-sm font-semibold text-red-900">
                                      {p.failure_reason
                                        ? (FAILURE_REASONS[p.failure_reason] ?? p.failure_reason)
                                        : p.failure_description ?? "Customer did not complete checkout or transaction expired."}
                                    </p>
                                    {p.failure_code && (
                                      <p className="text-xs text-red-500">Error Code: <span className="font-mono">{p.failure_code}</span></p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-sm">
                <span className="text-xs text-gray-500 font-semibold">
                  Page {currentPage} of {totalPages} · {filtered.length} transactions
                </span>
                <div className="flex gap-2">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 text-xs font-medium">
                    ← Prev
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = currentPage <= 3 ? i + 1
                      : currentPage >= totalPages - 2 ? totalPages - 4 + i
                      : currentPage - 2 + i;
                    if (page < 1 || page > totalPages) return null;
                    return (
                      <button key={page} onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                          page === currentPage ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}>
                        {page}
                      </button>
                    );
                  })}
                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 text-xs font-medium">
                    Next →
                  </button>
                </div>
              </div>
            )}

            {filtered.length > 0 && totalPages <= 1 && (
              <div className="px-6 py-4 border-t border-gray-100 text-xs font-semibold text-gray-500 bg-gray-50/50">
                Showing {filtered.length} of {payments.length} transactions
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
