"use client";

import React, { useState, useCallback } from "react";
import { updateOrder, updateOrdersBulk, createNotification } from "@/lib/orders-api";
import {
  Search, Package, Calendar, ChevronDown, ChevronUp, ShoppingCart,
  Clock, CheckCircle2, Truck, AlertOctagon, Download, MapPin,
  Send, Hash, Copy, Check, RefreshCw, ArrowUpDown, DollarSign
} from "lucide-react";

export type OrderItem = {
  id: string; title: string; price: number; qty: number; is_course: boolean;
};

export type Order = {
  id: string; user_id: string; total_amount: number; status: string;
  payment_id: string | null; razorpay_order_id: string | null;
  razorpay_payment_id: string | null; coupon_code: string | null;
  discount_amount: number; tax_amount: number; subtotal?: number | null;
  items: OrderItem[]; shipping_address: Record<string, string> | null;
  created_at: string; tracking_number?: string | null;
  profiles?: { email: string; full_name: string | null } | null;
};

const FILTER_STATUSES = ["all","pending","paid","packed","shipped","out_for_delivery","delivered","completed","cancelled","refund_requested"];
const ALL_ORDER_STATUSES = ["pending","paid","packed","shipped","out_for_delivery","delivered","completed","cancelled","refund_requested"];

const STATUS_COLORS: Record<string, string> = {
  pending:          "bg-amber-100 text-amber-800",
  paid:             "bg-blue-100 text-blue-800",
  packed:           "bg-indigo-100 text-indigo-800",
  shipped:          "bg-purple-100 text-purple-800",
  out_for_delivery: "bg-orange-100 text-orange-800",
  delivered:        "bg-green-100 text-green-800",
  completed:        "bg-green-100 text-green-800",
  cancelled:        "bg-red-100 text-red-800",
  refund_requested: "bg-orange-100 text-orange-800",
};


// Pretty-print status labels
const STATUS_LABEL: Record<string, string> = {
  all:              "All Statuses",
  pending:          "Pending",
  paid:             "Paid",
  packed:           "Packed",
  shipped:          "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered:        "Delivered",
  completed:        "Completed",
  cancelled:        "Cancelled",
  refund_requested: "Refund Requested",
};
const statusLabel = (s: string) => STATUS_LABEL[s] ?? (s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " "));

// Send in-app notification to customer when order status changes
async function sendOrderNotification(userId: string, orderId: string, status: string, trackingNumber?: string | null) {
  const messages: Record<string, { title: string; message: string }> = {
    packed:    { title: "Order Packed!", message: `Your order #${orderId.slice(0,8).toUpperCase()} has been packed and is ready for pickup by courier.` },
    out_for_delivery: { title: "Out for Delivery!", message: `Your order #${orderId.slice(0,8).toUpperCase()} is out for delivery. Expect it today!` },
    shipped:   { title: "Order Shipped!", message: `Your order #${orderId.slice(0,8).toUpperCase()} is on its way!${trackingNumber ? ` Tracking: ${trackingNumber}` : ""}` },
    delivered: { title: "Order Delivered!", message: `Your order #${orderId.slice(0,8).toUpperCase()} has been delivered. Thank you for shopping with us!` },
    cancelled: { title: "Order Cancelled", message: `Your order #${orderId.slice(0,8).toUpperCase()} has been cancelled. Refund will be processed in 5-7 business days.` },
  };
  const notif = messages[status];
  if (!notif) return;
  try {
    // POST /notifications. `created_at` is deliberately NOT sent: it is not
    // in CreateNotificationDto and the backend runs ValidationPipe with
    // forbidNonWhitelisted, so including it returns 400. The server sets it.
    await createNotification({
      user_id: userId,
      title: notif.title,
      body: notif.message,
      type: status === "cancelled" ? "warning" : "success",
      is_read: false,
    });
  } catch (e) {
    // Non-critical: the order update already succeeded.
    console.warn("Could not send notification:", e);
  }
}

function OrderRow({ order, onStatusChange, onRefund, onTrackingUpdate, selected, onToggleSelect }: {
  order: Order;
  onStatusChange: (id: string, status: string, trackingNumber?: string) => void;
  onRefund: (id: string) => void;
  onTrackingUpdate: (id: string, tracking: string) => void;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [trackingInput, setTrackingInput] = useState(order.tracking_number ?? "");
  const [savingTracking, setSavingTracking] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const items = Array.isArray(order.items) ? order.items : [];

  const handleTrackingSave = async () => {
    setSavingTracking(true);
    await onTrackingUpdate(order.id, trackingInput.trim());
    setSavingTracking(false);
  };

  const copyOrderId = () => {
    navigator.clipboard.writeText(order.id);
    setCopiedId(true); setTimeout(() => setCopiedId(false), 1500);
  };

  return (
    <div className={`border rounded-xl overflow-hidden bg-white mb-3 shadow-sm transition-colors ${selected ? "border-blue-400 ring-1 ring-blue-300" : "border-gray-200 hover:border-gray-300"}`}>
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50/50"
        onClick={() => setExpanded(e => !e)}>

        {/* Checkbox */}
        <input type="checkbox" checked={selected}
          onClick={e => e.stopPropagation()}
          onChange={() => onToggleSelect(order.id)}
          className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0" />

        <Package size={18} className="text-blue-600 shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm font-bold text-gray-900">#{order.id.slice(0,8).toUpperCase()}</p>
            <button onClick={e => { e.stopPropagation(); copyOrderId(); }}
              className="text-gray-300 hover:text-blue-500 transition" title="Copy full order ID">
              {copiedId ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            </button>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap mt-0.5">
            <span>{order.profiles?.email ?? order.user_id.slice(0,8)}</span>
            {order.profiles?.full_name && <span>· {order.profiles.full_name}</span>}
            {order.coupon_code && (
              <span className="bg-blue-50 text-blue-700 font-mono text-[10px] px-1.5 py-0.5 rounded border border-blue-100 font-semibold">
                {order.coupon_code} (-₹{order.discount_amount})
              </span>
            )}
            {order.tracking_number && (
              <span className="bg-purple-50 text-purple-700 text-[10px] px-1.5 py-0.5 rounded border border-purple-100 font-semibold flex items-center gap-1">
                <Truck size={9} /> {order.tracking_number}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right shrink-0">
            <span className="text-[10px] text-gray-400 block uppercase font-semibold">Amount</span>
            <span className="text-sm font-bold text-gray-900">₹{order.total_amount.toLocaleString()}</span>
          </div>

          <select value={order.status} onClick={e => e.stopPropagation()}
            onChange={e => onStatusChange(order.id, e.target.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold border-0 cursor-pointer outline-none ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"}`}>
            {ALL_ORDER_STATUSES.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Calendar size={12} />
            {new Date(order.created_at).toLocaleDateString("en-IN")}
          </span>

          {(order.status === "paid" || order.status === "shipped" || order.status === "delivered" || order.status === "packed") && (
            <button onClick={e => { e.stopPropagation(); onRefund(order.id); }}
              className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs px-3 py-1 rounded-lg border border-red-100 transition">
              Refund
            </button>
          )}

          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Items */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Order Items ({items.length})</p>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400">No item details available</p>
                ) : items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm bg-white p-2.5 rounded-lg border border-gray-100">
                    <span className="text-gray-700 font-medium">
                      {item.title} {item.qty > 1 && `× ${item.qty}`}
                      <span className={`ml-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${item.is_course ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-gray-100 text-gray-600 border border-gray-200"}`}>
                        {item.is_course ? "Course" : "Product"}
                      </span>
                    </span>
                    <span className="font-semibold text-gray-900">₹{(item.price * item.qty).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary + Tracking */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payment Details</p>
              <div className="bg-white p-4 rounded-xl border border-gray-100 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-800 font-medium">₹{(order.subtotal ?? (order.total_amount - (order.tax_amount || 0) + (order.discount_amount || 0))).toLocaleString()}</span>
                </div>
                {order.coupon_code && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Coupon ({order.coupon_code})</span>
                    <span className="text-emerald-600 font-medium">−₹{order.discount_amount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">GST / Tax</span>
                  <span className="text-gray-800 font-medium">₹{order.tax_amount || 0}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="flex justify-between font-bold text-base text-gray-900">
                  <span>Grand Total</span>
                  <span>₹{order.total_amount.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment IDs */}
              <div className="bg-white p-3 rounded-xl border border-gray-100 text-xs space-y-1.5">
                {order.razorpay_payment_id && (
                  <div className="flex gap-2"><span className="text-gray-400 w-28 shrink-0">Payment ID:</span><span className="font-mono text-gray-600 truncate">{order.razorpay_payment_id}</span></div>
                )}
                {order.razorpay_order_id && (
                  <div className="flex gap-2"><span className="text-gray-400 w-28 shrink-0">RZP Order ID:</span><span className="font-mono text-gray-600 truncate">{order.razorpay_order_id}</span></div>
                )}
              </div>

              {/* Tracking Number */}
              <div className="bg-white p-3 rounded-xl border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Truck size={11} /> Tracking Number
                </p>
                <div className="flex gap-2">
                  <input value={trackingInput} onChange={e => setTrackingInput(e.target.value)}
                    placeholder="e.g. DELHIVERY123456789"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400 font-mono" />
                  <button onClick={handleTrackingSave} disabled={savingTracking}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50">
                    {savingTracking ? "..." : "Save"}
                  </button>
                </div>
                {order.tracking_number && (
                  <p className="text-[10px] text-purple-600 mt-1.5 font-medium flex items-center gap-1">
                    <Check size={10} /> Current: {order.tracking_number}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Shipping */}
          {order.shipping_address && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin size={11} /> Shipping Details
              </p>
              <p className="text-sm text-gray-700 bg-white p-3 rounded-xl border border-gray-100">
                {Object.values(order.shipping_address).filter(Boolean).join(", ")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type SortField = "date" | "amount";
type SortDir = "asc" | "desc";

export default function OrdersClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("shipped");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState<string | null>(null);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const updateStatus = useCallback(async (id: string, status: string, trackingNumber?: string) => {
    const order = orders.find(o => o.id === id);
    const updateData: { status: string; tracking_number?: string | null } = { status };
    if (trackingNumber !== undefined) updateData.tracking_number = trackingNumber;
    try {
      await updateOrder(id, updateData);            // PATCH /orders/:id
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : "Update failed"}`);
      return;
    }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status, tracking_number: trackingNumber ?? o.tracking_number } : o));
    if (order) await sendOrderNotification(order.user_id, id, status, trackingNumber ?? order.tracking_number);
  }, [orders]);

  const handleRefund = useCallback(async (id: string) => {
    const order = orders.find(o => o.id === id);
    const hasRazorpayPayment = order?.razorpay_payment_id;
    const msg = hasRazorpayPayment
      ? `Refund order #${id.slice(0,8).toUpperCase()}?\n\nThis will cancel the order in the admin. To return money to the customer, also process the refund in your Razorpay Dashboard under Payments → Refunds.\n\nRazorpay Payment ID: ${order.razorpay_payment_id}`
      : `Cancel order #${id.slice(0,8).toUpperCase()}? Order status will be set to cancelled.`;
    if (!confirm(msg)) return;
    setRefundLoading(id);
    try {
      await updateOrder(id, { status: "cancelled" }); // PATCH /orders/:id
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : "Update failed"}`);
      setRefundLoading(null);
      return;
    }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: "cancelled" } : o));
    if (order) await sendOrderNotification(order.user_id, id, "cancelled");
    setRefundLoading(null);
    alert(hasRazorpayPayment
      ? `Order cancelled. To refund money, go to Razorpay Dashboard → Payments → find payment ${order.razorpay_payment_id} → Refund.`
      : "Order cancelled successfully."
    );
  }, [orders]);

  const handleTrackingUpdate = useCallback(async (id: string, tracking: string) => {
    try {
      await updateOrder(id, { tracking_number: tracking || null }); // PATCH /orders/:id
    } catch (e) {
      alert(`Error saving tracking: ${e instanceof Error ? e.message : "Save failed"}`);
      return;
    }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, tracking_number: tracking || null } : o));
    const order = orders.find(o => o.id === id);
    if (order && tracking && order.status === "shipped") {
      await sendOrderNotification(order.user_id, id, "shipped", tracking);
    }
  }, [orders]);

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(o => o.id)));
  };

  const applyBulkStatus = async () => {
    if (selectedIds.size === 0) { alert("Select at least one order"); return; }
    if (!confirm(`Update ${selectedIds.size} orders to "${bulkStatus}"?`)) return;
    setBulkLoading(true);
    const ids = [...selectedIds];
    // The backend has no bulk-update route, so this PATCHes each order and
    // reports partial failures instead of silently claiming success.
    const { succeeded, failed } = await updateOrdersBulk(ids, { status: bulkStatus });
    if (failed.length > 0) {
      alert(
        `${succeeded.length} of ${ids.length} orders updated.\n` +
        `${failed.length} failed:\n` +
        failed.slice(0, 5).map(f => `• ${f.id.slice(0, 8)}: ${f.message}`).join("\n")
      );
      if (succeeded.length === 0) { setBulkLoading(false); return; }
    }
    // Only notify and update rows that actually saved.
    const savedIds = new Set(succeeded);
    await Promise.all(succeeded.map(id => {
      const order = orders.find(o => o.id === id);
      return order ? sendOrderNotification(order.user_id, id, bulkStatus) : Promise.resolve();
    }));
    setOrders(prev => prev.map(o => savedIds.has(o.id) ? { ...o, status: bulkStatus } : o));
    setSelectedIds(new Set());
    setBulkLoading(false);
    if (failed.length === 0) {
      alert(`${succeeded.length} orders updated to "${bulkStatus}" and customers notified.`);
    }
  };

  const exportCSV = () => {
    const rows = [["Order ID","Customer Email","Customer Name","Amount","Status","Payment ID","Tracking","Date"]];
    orders.forEach(o => rows.push([
      o.id, o.profiles?.email ?? "", o.profiles?.full_name ?? "",
      String(o.total_amount), o.status,
      o.razorpay_payment_id ?? "", o.tracking_number ?? "",
      new Date(o.created_at).toLocaleDateString("en-IN"),
    ]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `orders_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const filtered = orders.filter(o => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (dateFilter && !o.created_at.startsWith(dateFilter)) return false;
    const q = search.toLowerCase();
    return !search ||
      o.id.toLowerCase().includes(q) ||
      (o.profiles?.email ?? "").toLowerCase().includes(q) ||
      (o.profiles?.full_name ?? "").toLowerCase().includes(q) ||
      (o.razorpay_payment_id ?? "").toLowerCase().includes(q) ||
      (o.razorpay_order_id ?? "").toLowerCase().includes(q) ||
      (o.tracking_number ?? "").toLowerCase().includes(q);
  }).sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortField === "amount") return (a.total_amount - b.total_amount) * mul;
    return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * mul;
  });

  const totalCount = orders.length;
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const paidCount = orders.filter(o => o.status === "paid").length;
  const packedCount = orders.filter(o => o.status === "packed").length;
  const shippedCount = orders.filter(o => o.status === "shipped").length;
  const refundCount = orders.filter(o => o.status === "refund_requested").length;
  const deliveredCount = orders.filter(o => o.status === "delivered").length;
  const cancelledCount = orders.filter(o => o.status === "cancelled").length;
  const totalRevenue = orders.filter(o => ["paid","packed","shipped","delivered","completed"].includes(o.status)).reduce((s, o) => s + o.total_amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Track orders, assign tracking numbers, and notify customers</p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-9 gap-2">
        {[
          { label: "Total", value: totalCount, icon: ShoppingCart, color: "text-gray-600 bg-gray-50" },
          { label: "Pending", value: pendingCount, icon: Clock, color: "text-amber-600 bg-amber-50" },
          { label: "Paid", value: paidCount, icon: CheckCircle2, color: "text-blue-600 bg-blue-50" },
          { label: "Packed", value: packedCount, icon: Package, color: "text-indigo-600 bg-indigo-50" },
          { label: "Shipped", value: shippedCount, icon: Truck, color: "text-purple-600 bg-purple-50" },
          { label: "Delivered", value: deliveredCount, icon: CheckCircle2, color: "text-green-600 bg-green-50" },
          { label: "Cancelled", value: cancelledCount, icon: AlertOctagon, color: "text-red-600 bg-red-50" },
          { label: "Refund Req", value: refundCount, icon: AlertOctagon, color: "text-orange-600 bg-orange-50" },
          { label: "Revenue", value: totalRevenue >= 1000 ? `₹${(totalRevenue/1000).toFixed(1)}k` : `₹${totalRevenue.toLocaleString()}`, icon: DollarSign, color: "text-emerald-600 bg-emerald-50" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1 ${s.color}`}><Icon size={14} /></span>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex-wrap">
          <span className="text-sm font-semibold text-blue-900">{selectedIds.size} order{selectedIds.size > 1 ? "s" : ""} selected</span>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
            className="border border-blue-200 bg-white rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-400">
            {ALL_ORDER_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <button onClick={applyBulkStatus} disabled={bulkLoading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
            <Send size={14} /> {bulkLoading ? "Updating..." : "Update + Notify Customers"}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-sm text-blue-500 hover:text-blue-700 ml-auto">Clear selection</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search order ID, email, payment ID, tracking..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 w-80" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white">
          {FILTER_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
        {/* Sort buttons */}
        <button onClick={() => toggleSort("date")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition ${sortField === "date" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
          <ArrowUpDown size={12} /> Date {sortField === "date" ? (sortDir === "desc" ? "↓" : "↑") : ""}
        </button>
        <button onClick={() => toggleSort("amount")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition ${sortField === "amount" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
          <ArrowUpDown size={12} /> Amount {sortField === "amount" ? (sortDir === "desc" ? "↓" : "↑") : ""}
        </button>
        {(search || dateFilter || statusFilter !== "all") && (
          <button onClick={() => { setSearch(""); setDateFilter(""); setStatusFilter("all"); }}
            className="text-sm text-red-500 hover:text-red-700">Clear all</button>
        )}
      </div>

      {/* Select all + count */}
      <div className="flex items-center gap-3">
        <button onClick={selectAll}
          className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-900 transition px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">
          <input type="checkbox" readOnly checked={selectedIds.size === filtered.length && filtered.length > 0}
            className="w-3.5 h-3.5 accent-blue-600" />
          {selectedIds.size === filtered.length && filtered.length > 0 ? "Deselect all" : "Select all"}
        </button>
        <p className="text-sm text-gray-500">
          Showing <span className="font-semibold text-gray-800">{filtered.length}</span> of{" "}
          <span className="font-semibold text-gray-800">{orders.length}</span> orders
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="text-gray-500 text-center py-12 bg-white rounded-xl border border-gray-200">
          <Package className="mx-auto mb-2 text-gray-400" size={32} />
          <p className="font-medium">No orders found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div>
          {filtered.map(order => (
            <OrderRow key={order.id} order={order}
              onStatusChange={updateStatus} onRefund={handleRefund}
              onTrackingUpdate={handleTrackingUpdate}
              selected={selectedIds.has(order.id)} onToggleSelect={toggleSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
