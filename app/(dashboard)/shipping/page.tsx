"use client";

import { useEffect, useState } from "react";
import DataErrorNotice from "@/components/DataErrorNotice";
import { db } from "@/lib/db";
import { Truck, Save, MapPin, Info, CheckCircle, Package, Clock, TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";

const REMOTE_STATES = [
  "Arunachal Pradesh","Assam","Manipur","Meghalaya","Mizoram",
  "Nagaland","Sikkim","Tripura","Andaman and Nicobar Islands",
  "Lakshadweep","Jammu and Kashmir","Ladakh"
];

type ShippingOrder = {
  id: string;
  user_id: string;
  status: string;
  total_amount: number;
  created_at: string;
  shipping_address: Record<string, string> | null;
  profiles?: { email: string; full_name: string | null } | null;
};

export default function ShippingPage() {
  const [standard, setStandard]   = useState("49");
  const [remote, setRemote]       = useState("149");
  const [threshold, setThreshold] = useState("999");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<"config" | "orders">("orders");

  // Live orders data
  const [shippingOrders, setShippingOrders] = useState<ShippingOrder[]>([]);
  const [ordersLoading, setOrdersLoading]   = useState(false);
  const [statusUpdate, setStatusUpdate]     = useState<string | null>(null);
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [savingTracking, setSavingTracking] = useState<string | null>(null);
  const [bulkShipping, setBulkShipping]     = useState(false);

  useEffect(() => {
    db.from("settings").select("key,value")
      .in("key",["shipping_fee","shipping_fee_remote","free_shipping_threshold"])
      .then(({ data, error }) => {
        if (error) setLoadError(error.message);
        data?.forEach((r: { key: string; value: string }) => {
          if (r.key === "shipping_fee") setStandard(r.value);
          if (r.key === "shipping_fee_remote") setRemote(r.value);
          if (r.key === "free_shipping_threshold") setThreshold(r.value);
        });
        setLoading(false);
      });
  }, []);

  const loadShippingOrders = async () => {
    setOrdersLoading(true);
    const { data, error } = await db
      .from("orders")
      .select("id, user_id, status, total_amount, created_at, shipping_address, tracking_number")
      .in("status", ["paid", "packed", "shipped", "delivered"])
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) {
      // Enrich with profile data separately (avoids FK/RLS join issues)
      const rows = data as unknown as ShippingOrder[];
      const ids = rows.map(r => r.user_id).filter(Boolean);
      if (ids.length > 0) {
        const { data: profiles } = await db
          .from("profiles").select("id, email, full_name").in("id", ids);
        const pm: Record<string, any> = {};
        (profiles ?? []).forEach((p: any) => { pm[p.id] = p; });
        setShippingOrders(rows.map(r => ({ ...r, profiles: pm[r.user_id] ?? null })));
      } else {
        setShippingOrders(rows);
      }
    }
    setOrdersLoading(false);
  };

  useEffect(() => {
    if (activeTab === "orders") loadShippingOrders();
  }, [activeTab]);

  // Load orders on initial mount for stats

  const updateOrderStatus = async (id: string, status: string) => {
    setStatusUpdate(id);
    const { error } = await db.from("orders").update({ status }).eq("id", id);
    if (!error) {
      setShippingOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    } else {
      alert(`Error: ${error.message}`);
    }
    setStatusUpdate(null);
  };

  // ── FIX ────────────────────────────────────────────────────────────────────
  // No conflict target was given, and the Promise.all results were discarded
  // before the success tick was shown. Checkout on both web and mobile reads
  // these three values, so a failed write mispriced every order while the admin
  // saw "Saved". Target `key` and surface the real error.
  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const results = await Promise.all([
      db.from("settings").upsert({ key:"shipping_fee", value:standard, label:"Standard shipping fee (₹)" }, { onConflict: "key" }),
      db.from("settings").upsert({ key:"shipping_fee_remote", value:remote, label:"Remote area shipping fee (₹)" }, { onConflict: "key" }),
      db.from("settings").upsert({ key:"free_shipping_threshold", value:threshold, label:"Free shipping above (₹)" }, { onConflict: "key" }),
    ]);
    setSaving(false);

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error("[shipping] save failed:", failed.error);
      setSaveError(failed.error.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const inp = "w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition";

  const STATUS_COLORS: Record<string, string> = {
    paid:      "bg-blue-100 text-blue-800",
    packed:    "bg-indigo-100 text-indigo-800",
    shipped:   "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
  };

  const pendingShip = shippingOrders.filter(o => o.status === "paid" || o.status === "packed").length;
  const inTransit   = shippingOrders.filter(o => o.status === "shipped").length;
  const delivered   = shippingOrders.filter(o => o.status === "delivered" || o.status === "completed").length;

  const saveTracking = async (orderId: string) => {
    const tracking = trackingInputs[orderId]?.trim();
    if (!tracking) { alert("Enter a tracking number first"); return; }
    setSavingTracking(orderId);
    const { error } = await db.from("orders")
      .update({ tracking_number: tracking, status: "shipped" })
      .eq("id", orderId);
    if (!error) {
      setShippingOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "shipped", tracking_number: tracking } : o));
    } else { alert(error.message); }
    setSavingTracking(null);
  };

  const bulkMarkShipped = async () => {
    const packed = shippingOrders.filter(o => o.status === "paid" || o.status === "packed");
    if (packed.length === 0) { alert("No orders ready to ship"); return; }
    if (!confirm(`Mark ${packed.length} orders as Shipped?`)) return;
    setBulkShipping(true);
    const ids = packed.map(o => o.id);
    await db.from("orders").update({ status: "shipped" }).in("id", ids);
    setShippingOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status: "shipped" } : o));
    setBulkShipping(false);
    alert(`${packed.length} orders marked as Shipped.`);
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <DataErrorNotice message={loadError} />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shipping</h1>
        <p className="text-sm text-gray-500 mt-1">Configure delivery charges and manage physical order shipments</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["config", "orders"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
              activeTab === tab ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}>
            {tab === "config" ? "⚙️ Configuration" : "📦 Active Orders"}
          </button>
        ))}
      </div>

      {activeTab === "config" && (
        <div className="space-y-6">
          {/* Zones */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="border-b border-gray-50 px-6 py-4 flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl"><Truck size={18} className="text-blue-600" /></div>
              <div>
                <h2 className="font-semibold text-gray-900">Delivery Zones</h2>
                <p className="text-xs text-gray-400">Changes apply to all new checkouts instantly</p>
              </div>
            </div>

            {loading ? (
              <div className="p-6 space-y-4">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}</div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Standard */}
                <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="p-2.5 bg-white rounded-xl shadow-sm shrink-0"><MapPin size={16} className="text-gray-600" /></div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">Standard Delivery</p>
                    <p className="text-xs text-gray-400 mt-0.5">Maharashtra, Karnataka, Tamil Nadu, Delhi, Gujarat, Telangana and all other states</p>
                  </div>
                  <div className="w-32">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">₹</span>
                      <input type="text" inputMode="numeric" value={standard}
                        onChange={e => setStandard(e.target.value.replace(/\D/g,""))}
                        className={inp + " pl-7"} />
                    </div>
                  </div>
                </div>

                {/* Remote */}
                <div className="flex items-start gap-4 p-4 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="p-2.5 bg-white rounded-xl shadow-sm shrink-0"><MapPin size={16} className="text-amber-600" /></div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">Remote Area Delivery</p>
                    <p className="text-xs text-gray-400 mt-0.5">NE India, Andaman & Nicobar, Lakshadweep, Jammu & Kashmir, Ladakh</p>
                    <details className="mt-2">
                      <summary className="text-xs text-amber-600 cursor-pointer font-medium">View remote states ({REMOTE_STATES.length})</summary>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {REMOTE_STATES.map(s => (
                          <span key={s} className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    </details>
                  </div>
                  <div className="w-32">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">₹</span>
                      <input type="text" inputMode="numeric" value={remote}
                        onChange={e => setRemote(e.target.value.replace(/\D/g,""))}
                        className={inp + " pl-7 bg-white border-amber-200 focus:border-amber-400 focus:ring-amber-100"} />
                    </div>
                  </div>
                </div>

                {/* Free threshold */}
                <div className="flex items-start gap-4 p-4 rounded-xl bg-green-50 border border-green-100">
                  <div className="p-2.5 bg-white rounded-xl shadow-sm shrink-0"><CheckCircle size={16} className="text-green-600" /></div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">Free Shipping Above</p>
                    <p className="text-xs text-gray-400 mt-0.5">Orders above this amount get free delivery — applies to all zones</p>
                  </div>
                  <div className="w-32">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">₹</span>
                      <input type="text" inputMode="numeric" value={threshold}
                        onChange={e => setThreshold(e.target.value.replace(/\D/g,""))}
                        className={inp + " pl-7 bg-white border-green-200 focus:border-green-400 focus:ring-green-100"} />
                    </div>
                  </div>
                </div>

                {/* Live preview */}
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Info size={14} className="text-blue-600" />
                    <p className="text-xs font-semibold text-blue-800">Live Preview — what customers see at checkout</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { label:"Standard", val:`₹${standard}`, sub:"Most states", color:"text-gray-700" },
                      { label:"Remote", val:`₹${remote}`, sub:"NE/Islands/J&K", color:"text-amber-700" },
                      { label:"Free shipping", val:`Above ₹${threshold}`, sub:"All zones", color:"text-green-700" },
                    ].map(item => (
                      <div key={item.label} className="bg-white rounded-lg p-3 border border-blue-100">
                        <p className={`text-sm font-bold ${item.color}`}>{item.val}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{item.label}</p>
                        <p className="text-[10px] text-gray-400">{item.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-xl hover:bg-blue-700 transition disabled:opacity-50 shadow-sm shadow-blue-200">
                  <Save size={15} />
                  {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Shipping Settings"}
                </button>

                {saveError && (
                  <p className="text-sm text-red-600 mt-2">
                    Could not save: {saveError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "orders" && (
        <div className="space-y-6">
          {/* Shipping stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Awaiting Shipment", value: pendingShip, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "In Transit", value: inTransit, icon: Truck, color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Delivered", value: delivered, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className={`inline-flex p-2 rounded-lg ${s.bg} mb-3`}><Icon size={18} className={s.color} /></div>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
                </div>
              );
            })}
          </div>

          {/* Alert for pending shipments */}
          {pendingShip > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <AlertTriangle size={18} className="text-amber-600 shrink-0" />
              <p className="text-sm font-semibold text-amber-900 flex-1">
                {pendingShip} order{pendingShip > 1 ? "s" : ""} awaiting shipment
              </p>
              <button onClick={bulkMarkShipped} disabled={bulkShipping}
                className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-amber-700 transition disabled:opacity-50 shrink-0">
                {bulkShipping ? "Updating..." : `Mark All ${pendingShip} as Shipped`}
              </button>
            </div>
          )}

          {/* Orders table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Active Shipping Orders</h2>
              <button onClick={loadShippingOrders} disabled={ordersLoading}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition">
                <RefreshCw size={13} className={ordersLoading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
            {ordersLoading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading orders...</div>
            ) : shippingOrders.length === 0 ? (
              <div className="p-10 text-center">
                <Truck size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600">No active shipping orders</p>
                <p className="text-xs text-gray-400 mt-1">Orders with physical products will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Order</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Ship To</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Tracking</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {shippingOrders.map(o => {
                      const addr = o.shipping_address;
                      const addrStr = addr
                        ? [addr.address_line1, addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ")
                        : "—";
                      const isRemote = addr?.state && REMOTE_STATES.includes(addr.state);
                      return (
                        <tr key={o.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4">
                            <p className="font-mono text-xs font-bold text-gray-800">#{o.id.slice(0,8).toUpperCase()}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-gray-900">{(o.profiles as any)?.full_name ?? "—"}</p>
                            <p className="text-xs text-gray-400">{(o.profiles as any)?.email ?? ""}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs text-gray-700 max-w-[180px]">{addrStr}</p>
                            {isRemote && (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                Remote Area
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-semibold text-gray-900">₹{o.total_amount.toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-700"}`}>
                              {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-500">
                            {new Date(o.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-1.5">
                              <input
                                value={trackingInputs[o.id] ?? (o as any).tracking_number ?? ""}
                                onChange={e => setTrackingInputs(prev => ({ ...prev, [o.id]: e.target.value }))}
                                placeholder="Tracking ID"
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-28 outline-none focus:ring-1 focus:ring-blue-400 font-mono"
                              />
                              <button onClick={() => saveTracking(o.id)} disabled={savingTracking === o.id}
                                className="bg-blue-600 text-white px-2 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50">
                                {savingTracking === o.id ? "..." : "Ship"}
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <select value={o.status}
                              onChange={e => updateOrderStatus(o.id, e.target.value)}
                              disabled={statusUpdate === o.id}
                              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 bg-white cursor-pointer disabled:opacity-50">
                              <option value="paid">Paid (Ready)</option>
                              <option value="packed">Packed</option>
                              <option value="shipped">Shipped</option>
                              <option value="delivered">Delivered</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
