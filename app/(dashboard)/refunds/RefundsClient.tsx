"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Search, RefreshCw, AlertCircle, Calendar, CheckCircle2, XCircle, Info, DollarSign, ArrowUpDown } from "lucide-react";

export type OrderForRefund = {
  id: string; user_id: string; total_amount: number; status: string;
  payment_id: string | null; razorpay_order_id: string | null;
  razorpay_payment_id: string | null; created_at: string;
  profiles: { email: string; full_name: string | null } | null;
};

export default function RefundsClient({ initialOrders }: { initialOrders: OrderForRefund[] }) {
  const [orders, setOrders] = useState<OrderForRefund[]>(initialOrders);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"eligible"|"requested"|"refunded">("eligible");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [partialAmounts, setPartialAmounts] = useState<Record<string, string>>({});

  const requestedOrders = orders.filter(o => o.status === "refund_requested");
  const refundedOrders = orders.filter(o => o.status === "cancelled" || o.status === "refunded");
  const eligibleOrders = orders.filter(o => ["paid","packed","shipped","delivered","completed"].includes(o.status));

  const filterOrders = (list: OrderForRefund[]) => list.filter(o => {
    const q = search.toLowerCase();
    return !search ||
      o.id.toLowerCase().includes(q) ||
      (o.profiles?.email ?? "").toLowerCase().includes(q) ||
      (o.profiles?.full_name ?? "").toLowerCase().includes(q) ||
      (o.razorpay_payment_id ?? "").toLowerCase().includes(q);
  });

  const totalRefundedAmount = refundedOrders.reduce((s, o) => s + o.total_amount, 0);
  const pendingRefundAmount = eligibleOrders.reduce((s, o) => s + o.total_amount, 0);

  const handleRefund = async (order: OrderForRefund) => {
    const partialAmt = partialAmounts[order.id] ? Number(partialAmounts[order.id]) : null;
    const refundAmt = partialAmt && partialAmt > 0 && partialAmt <= order.total_amount
      ? partialAmt : order.total_amount;

    const hasRazorpay = !!order.razorpay_payment_id;
    const confirmMsg = hasRazorpay
      ? `Refund ₹${refundAmt.toLocaleString()} for order #${order.id.slice(0,8).toUpperCase()}?\n\n` +
        `Payment ID: ${order.razorpay_payment_id}\n\n` +
        `⚠️ IMPORTANT: This marks the order as cancelled in the admin database.\n` +
        `To actually return money to the customer, you must ALSO:\n` +
        `1. Go to Razorpay Dashboard\n` +
        `2. Payments → find payment ${order.razorpay_payment_id}\n` +
        `3. Click Refund and enter ₹${refundAmt.toLocaleString()}\n\n` +
        `Do you want to proceed with marking it cancelled here?`
      : `Cancel order #${order.id.slice(0,8).toUpperCase()} for ₹${refundAmt.toLocaleString()}?`;

    if (!confirm(confirmMsg)) return;

    setProcessingId(order.id);
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order.id);

    if (error) {
      alert(`Error: ${error.message}`);
      setProcessingId(null);
      return;
    }

    // Send in-app notification to customer
    try {
      await supabase.from("notifications").insert({
        user_id: order.user_id,
        title: "Order Refund Processed",
        body: `Your order #${order.id.slice(0,8).toUpperCase()} has been cancelled and ₹${refundAmt.toLocaleString()} refund has been initiated. It will reflect in 5-7 business days.`,
        type: "info", is_read: false, created_at: new Date().toISOString(),
      });
    } catch (err) {
      // Best-effort: never block the refund on a notification failure, but do
      // not swallow it silently either — the customer was told nothing.
      console.warn("[refunds] customer notification failed (refund still processed):", err);
    }

    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "cancelled" } : o));
    setProcessingId(null);

    alert(hasRazorpay
      ? `✓ Order marked cancelled.\n\nNow go to Razorpay Dashboard → Payments → ${order.razorpay_payment_id} → Refund ₹${refundAmt.toLocaleString()} to complete the actual money transfer.`
      : "Order cancelled successfully."
    );
  };

  const Row = ({ o, showRefund }: { o: OrderForRefund; showRefund: boolean }) => (
    <tr className="border-t border-gray-100 hover:bg-gray-50/50 transition">
      <td className="px-6 py-4">
        <p className="font-mono font-bold text-gray-900 text-sm">#{o.id.slice(0,8).toUpperCase()}</p>
        {o.razorpay_payment_id && (
          <p className="text-[10px] text-gray-400 mt-0.5 font-mono">RZP: {o.razorpay_payment_id}</p>
        )}
      </td>
      <td className="px-6 py-4">
        <p className="text-sm font-medium text-gray-900">{o.profiles?.full_name ?? "—"}</p>
        <p className="text-xs text-gray-400">{o.profiles?.email ?? o.user_id.slice(0,8)}</p>
      </td>
      <td className="px-6 py-4 font-semibold text-gray-900">₹{o.total_amount.toLocaleString()}</td>
      <td className="px-6 py-4">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
          o.status === "cancelled" ? "bg-red-50 text-red-700" :
          o.status === "paid" ? "bg-blue-50 text-blue-700" :
          o.status === "shipped" ? "bg-purple-50 text-purple-700" :
          "bg-green-50 text-green-700"
        }`}>{o.status}</span>
      </td>
      <td className="px-6 py-4 text-xs text-gray-500 flex items-center gap-1">
        <Calendar size={12} /> {new Date(o.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}
      </td>
      {showRefund && (
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
              <input
                type="number" min="1" max={o.total_amount}
                value={partialAmounts[o.id] ?? ""}
                onChange={e => setPartialAmounts(prev => ({ ...prev, [o.id]: e.target.value }))}
                placeholder={String(o.total_amount)}
                className="w-24 border border-gray-200 rounded-lg pl-5 pr-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <button onClick={() => handleRefund(o)} disabled={processingId === o.id}
              className="flex items-center gap-1 bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-100 transition text-xs font-semibold disabled:opacity-50">
              <RefreshCw size={12} className={processingId === o.id ? "animate-spin" : ""} />
              {processingId === o.id ? "Processing..." : "Refund"}
            </button>
          </div>
        </td>
      )}
    </tr>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Refunds</h1>
        <p className="mt-1 text-gray-500 text-sm">Manage order refunds and cancellations</p>
      </div>

      {/* Razorpay info banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">How refunds work</p>
          <p className="text-xs mt-0.5 text-amber-700">
            Clicking "Refund" marks the order as cancelled here and notifies the customer. To actually transfer money back, go to your{" "}
            <a href="https://dashboard.razorpay.com/app/payments" target="_blank" rel="noreferrer" className="underline font-semibold">Razorpay Dashboard → Payments</a>
            {" "}and initiate the refund there using the Payment ID shown.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { label: "Total Refunded Amount", value: `₹${totalRefundedAmount.toLocaleString()}`, sub: `${refundedOrders.length} cancelled orders`, icon: XCircle, color: "text-red-600 bg-red-50" },
          { label: "Eligible for Refund", value: eligibleOrders.length, sub: `₹${pendingRefundAmount.toLocaleString()} at risk`, icon: AlertCircle, color: "text-amber-600 bg-amber-50" },
          { label: "Refunded Orders", value: refundedOrders.length, sub: "All time", icon: CheckCircle2, color: "text-gray-600 bg-gray-50" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${s.color}`}><Icon size={18} /></div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-1">
        <div className="flex gap-4">
          {[
            { id: "eligible", label: `Eligible for Refund (${eligibleOrders.length})` },
            { id: "refunded", label: `Refunded / Cancelled (${refundedOrders.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              className={`pb-3 text-sm font-semibold border-b-2 transition -mb-px ${tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-900"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative mb-2 sm:mb-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search order, email, payment ID..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 w-72" />
        </div>
      </div>

      {/* Table */}
      {tab === "eligible" ? (
        filterOrders(eligibleOrders).length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-green-500" />
            <p className="font-medium text-gray-600">No orders eligible for refund</p>
            <p className="text-sm text-gray-400 mt-1">All paid/shipped orders will appear here</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase">
                  <tr>
                    <th className="text-left px-6 py-4">Order</th>
                    <th className="text-left px-6 py-4">Customer</th>
                    <th className="text-left px-6 py-4">Amount</th>
                    <th className="text-left px-6 py-4">Status</th>
                    <th className="text-left px-6 py-4">Date</th>
                    <th className="text-left px-6 py-4">Refund Amount (partial OK)</th>
                  </tr>
                </thead>
                <tbody>
                  {filterOrders(eligibleOrders).map(o => <Row key={o.id} o={o} showRefund={true} />)}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : tab === "requested" ? (
        filterOrders(requestedOrders).length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-medium text-gray-600">No refund requests from customers</p>
            <p className="text-sm text-gray-400 mt-1">When customers request refunds in the app, they appear here</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-orange-50 border-b border-orange-100 text-gray-500 text-xs font-semibold uppercase">
                  <tr>
                    <th className="text-left px-6 py-4">Order</th>
                    <th className="text-left px-6 py-4">Customer</th>
                    <th className="text-left px-6 py-4">Amount</th>
                    <th className="text-left px-6 py-4">Date</th>
                    <th className="text-left px-6 py-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filterOrders(requestedOrders).map(o => <Row key={o.id} o={o} showRefund={true} />)}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        filterOrders(refundedOrders).length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
            <XCircle className="mx-auto mb-3 h-8 w-8 text-gray-400" />
            <p className="font-medium text-gray-600">No refunded orders yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase">
                  <tr>
                    <th className="text-left px-6 py-4">Order</th>
                    <th className="text-left px-6 py-4">Customer</th>
                    <th className="text-left px-6 py-4">Amount</th>
                    <th className="text-left px-6 py-4">Status</th>
                    <th className="text-left px-6 py-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filterOrders(refundedOrders).map(o => <Row key={o.id} o={o} showRefund={false} />)}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
