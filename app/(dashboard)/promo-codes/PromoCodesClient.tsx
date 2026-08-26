"use client";

import { useState, useMemo } from "react";
import { formatDateLong } from "@/lib/format";
import DataErrorNotice from "@/components/DataErrorNotice";
import { backendApi } from "@/lib/backend-api";
import {
  Plus, Trash2, Edit2, Calendar, Percent, Tag, X, Save,
  ToggleLeft, ToggleRight, Users, Clock, Search, Copy, Check,
  ChevronDown, ChevronUp, AlertTriangle, Info
} from "lucide-react";

export type PromoCode = {
  id: string; code: string; discount_percent: number;
  expiry_at: string | null; usage_limit: number | null;
  used_count: number; is_active: boolean; created_at: string;
  min_order_amount?: number; max_discount_amount?: number | null;
  applicable_course_ids?: string[] | null;
  applicable_product_ids?: string[] | null;
};

interface PromoCodesClientProps {
  initialPromoCodes: PromoCode[];
  loadError?: string;
  courses: Array<{ id: string; title: string }>;
  products: Array<{ id: string; title: string }>;
}

// Searchable multi-select component
function SearchableSelect({
  label, items, selected, onToggle, color = "blue", hint
}: {
  label: string;
  items: Array<{ id: string; title: string }>;
  selected: string[];
  onToggle: (id: string) => void;
  color?: string;
  hint?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() =>
    items.filter(i => i.title.toLowerCase().includes(q.toLowerCase())),
    [items, q]
  );
  const selectedItems = items.filter(i => selected.includes(i.id));
  const accent = color === "orange" ? "accent-orange-500" : "accent-blue-600";
  const badge = color === "orange"
    ? "bg-orange-50 text-orange-700 border-orange-100"
    : "bg-blue-50 text-blue-700 border-blue-100";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-semibold text-gray-700">
          {label}
          {selected.length > 0 && (
            <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded border ${badge}`}>
              {selected.length} selected
            </span>
          )}
        </label>
        <span className="text-xs text-gray-400">{hint}</span>
      </div>

      {/* Selected chips */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedItems.map(item => (
            <span key={item.id}
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${badge}`}>
              {item.title}
              <button type="button" onClick={() => onToggle(item.id)}
                className="ml-0.5 hover:opacity-70">
                <X size={10} />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => { selectedItems.forEach(i => onToggle(i.id)); }}
            className="text-xs text-gray-400 hover:text-gray-600 underline px-1">
            Clear all
          </button>
        </div>
      )}

      {/* Dropdown toggle */}
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white hover:border-gray-300 transition text-left">
        <span className="text-gray-500">
          {selected.length === 0 ? `Select ${label.toLowerCase()}…` : `${selected.length} of ${items.length} selected`}
        </span>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="mt-1 border border-gray-200 rounded-xl bg-white shadow-lg z-10 overflow-hidden">
          {/* Search inside dropdown */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={q} onChange={e => setQ(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
          </div>

          {/* Select/Deselect all */}
          {filtered.length > 0 && (
            <div className="px-3 py-1.5 border-b border-gray-50 flex items-center justify-between">
              <button type="button" onClick={() => filtered.forEach(i => { if (!selected.includes(i.id)) onToggle(i.id); })}
                className="text-xs text-blue-600 hover:underline font-medium">Select all</button>
              <button type="button" onClick={() => filtered.forEach(i => { if (selected.includes(i.id)) onToggle(i.id); })}
                className="text-xs text-gray-400 hover:text-gray-600 hover:underline">Clear</button>
            </div>
          )}

          {/* Items */}
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No results for "{q}"</p>
            ) : filtered.map(item => (
              <label key={item.id}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm transition">
                <input type="checkbox" checked={selected.includes(item.id)}
                  onChange={() => onToggle(item.id)}
                  className={`w-4 h-4 ${accent} rounded`} />
                <span className="text-gray-700 font-medium truncate">{item.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PromoCodesClient({ loadError = "", initialPromoCodes, courses, products }: PromoCodesClientProps) {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(initialPromoCodes);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingExpired, setDeletingExpired] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copyId, setCopyId] = useState<string | null>(null);

  // Form states
  const [code, setCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [expiryAt, setExpiryAt] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("0");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Search / filter
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all"|"active"|"inactive"|"expired">("all");

  const resetForm = () => {
    setCode(""); setDiscountPercent(""); setUsageLimit(""); setExpiryAt("");
    setMinOrderAmount("0"); setMaxDiscountAmount("");
    setSelectedCourses([]); setSelectedProducts([]); setIsActive(true); setEditingId(null);
  };

  const toggleItem = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  };

  const handleEditClick = (pc: PromoCode) => {
    setEditingId(pc.id); setCode(pc.code);
    setDiscountPercent(String(pc.discount_percent));
    setUsageLimit(pc.usage_limit ? String(pc.usage_limit) : "");
    setExpiryAt(pc.expiry_at ? pc.expiry_at.slice(0, 10) : "");
    setMinOrderAmount(pc.min_order_amount ? String(pc.min_order_amount) : "0");
    setMaxDiscountAmount(pc.max_discount_amount ? String(pc.max_discount_amount) : "");
    setSelectedCourses(pc.applicable_course_ids ?? []);
    setSelectedProducts(pc.applicable_product_ids ?? []);
    setIsActive(pc.is_active);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !discountPercent) { alert("Code and Discount % are required"); return; }
    setSubmitting(true);
    const fullPayload = {
      code: code.trim().toUpperCase(),
      discount_percent: Number(discountPercent),
      usage_limit: usageLimit ? Number(usageLimit) : null,
      expiry_at: expiryAt ? new Date(expiryAt).toISOString() : null,
      is_active: isActive,
      min_order_amount: Number(minOrderAmount) || 0,
      max_discount_amount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
      applicable_course_ids: selectedCourses.length > 0 ? selectedCourses : [],
      applicable_product_ids: selectedProducts.length > 0 ? selectedProducts : [],
    };
    const basePayload = { code: fullPayload.code, discount_percent: fullPayload.discount_percent, usage_limit: fullPayload.usage_limit, expiry_at: fullPayload.expiry_at, is_active: fullPayload.is_active };
    try {
      if (editingId) {
        const { data, error } = await backendApi.endpoint("/promo-codes").update(fullPayload).eq("id", editingId).select().single();
        if (error) {
          const { data: fb } = await backendApi.endpoint("/promo-codes").update(basePayload).eq("id", editingId).select().single();
          if (fb) { setPromoCodes(prev => prev.map(c => c.id === editingId ? (fb as PromoCode) : c)); resetForm(); setShowForm(false); }
          else alert(`Error: ${error.message}`);
        } else if (data) { setPromoCodes(prev => prev.map(c => c.id === editingId ? (data as PromoCode) : c)); resetForm(); setShowForm(false); }
      } else {
        // `used_count` is NOT sent: it is not in CreatePromoCodeDto and the backend
        // rejects unknown fields (forbidNonWhitelisted) with a 400. The column
        // defaults to 0 in the database.
        const { data, error } = await backendApi.endpoint("/promo-codes").insert({ ...fullPayload }).select().single();
        if (error) {
          const { data: fb } = await backendApi.endpoint("/promo-codes").insert({ ...basePayload }).select().single();
          if (fb) { setPromoCodes(prev => [fb as PromoCode, ...prev]); resetForm(); setShowForm(false); }
          else alert(`Error: ${error.message}`);
        } else if (data) { setPromoCodes(prev => [data as PromoCode, ...prev]); resetForm(); setShowForm(false); }
      }
    } finally { setSubmitting(false); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await backendApi.endpoint("/promo-codes").update({ is_active: !current }).eq("id", id);
    if (!error) setPromoCodes(prev => prev.map(c => c.id === id ? { ...c, is_active: !current } : c));
    else alert(`Error: ${error.message}`);
  };

  const deletePromoCode = async (id: string) => {
    if (!confirm("Delete this promo code?")) return;
    const { error } = await backendApi.endpoint("/promo-codes").delete().eq("id", id);
    if (!error) setPromoCodes(prev => prev.filter(c => c.id !== id));
    else alert(`Error: ${error.message}`);
  };

  const deleteExpiredCodes = async () => {
    const expired = promoCodes.filter(c => c.expiry_at && new Date(c.expiry_at) < new Date());
    if (!expired.length) { alert("No expired codes found."); return; }
    if (!confirm(`Delete ${expired.length} expired codes?`)) return;
    setDeletingExpired(true);
    const ids = expired.map(c => c.id);
    const { error } = await backendApi.endpoint("/promo-codes").delete().in("id", ids);
    if (!error) setPromoCodes(prev => prev.filter(c => !ids.includes(c.id)));
    else alert(`Error: ${error.message}`);
    setDeletingExpired(false);
  };

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopyId(id); setTimeout(() => setCopyId(null), 1500);
  };

  const isExpired = (expiry: string | null) => expiry ? new Date(expiry) < new Date() : false;

  const visible = promoCodes.filter(c => {
    const exp = isExpired(c.expiry_at);
    if (filterStatus === "active" && (!c.is_active || exp)) return false;
    if (filterStatus === "inactive" && (c.is_active && !exp)) return false;
    if (filterStatus === "expired" && !exp) return false;
    if (search && !c.code.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeCount  = promoCodes.filter(c => c.is_active && !isExpired(c.expiry_at)).length;
  const expiredCount = promoCodes.filter(c => isExpired(c.expiry_at)).length;
  const totalUsed    = promoCodes.reduce((s, c) => s + (c.used_count || 0), 0);

  return (
    <div className="space-y-6">
      <DataErrorNotice message={loadError} />
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Promo Codes</h1>
          <p className="mt-1 text-gray-500 text-sm">Admin-only promo codes. For codes usable in the app go to <a href="/coupons" className="text-blue-600 underline font-medium">Coupons →</a></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={deleteExpiredCodes} disabled={deletingExpired}
            className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-100 transition text-sm font-medium disabled:opacity-50">
            <Trash2 size={15} /> Clean Expired ({expiredCount})
          </button>
          <button onClick={() => { if (showForm) resetForm(); setShowForm(!showForm); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-semibold">
            {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? "Close" : "New Promo Code"}
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 font-medium">
          <strong>Note:</strong> Promo codes here are <em>not</em> validated at app checkout. 
          For working discount codes, create them in the <a href="/coupons" className="underline font-bold">Coupons section</a>.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Codes", value: promoCodes.length, color: "text-gray-700 bg-gray-50" },
          { label: "Active", value: activeCount, color: "text-green-700 bg-green-50" },
          { label: "Expired", value: expiredCount, color: "text-red-700 bg-red-50" },
          { label: "Total Uses", value: totalUsed, color: "text-blue-700 bg-blue-50" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-7 shadow-md space-y-6 max-w-3xl">
          <div className="flex justify-between items-center pb-3 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">
              {editingId ? `Edit: ${code}` : "Create New Promo Code"}
            </h2>
            <button type="button" onClick={() => { resetForm(); setShowForm(false); }}>
              <X size={18} className="text-gray-400 hover:text-gray-700" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Code <span className="text-red-500">*</span></label>
              <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. SAVE30"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono font-bold uppercase outline-none focus:ring-1 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Discount % <span className="text-red-500">*</span></label>
              <input type="number" min="1" max="100" value={discountPercent}
                onChange={e => setDiscountPercent(e.target.value)} placeholder="e.g. 30"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Min Order (₹)</label>
              <input type="number" min="0" value={minOrderAmount}
                onChange={e => setMinOrderAmount(e.target.value)} placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Max Discount Cap (₹) <span className="text-gray-400 text-xs">(optional)</span></label>
              <input type="number" min="1" value={maxDiscountAmount}
                onChange={e => setMaxDiscountAmount(e.target.value)} placeholder="e.g. 200"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Usage Limit <span className="text-gray-400 text-xs">(blank=unlimited)</span></label>
              <input type="number" min="1" value={usageLimit}
                onChange={e => setUsageLimit(e.target.value)} placeholder="e.g. 100"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Expiry Date <span className="text-gray-400 text-xs">(optional)</span></label>
              <input type="date" value={expiryAt} onChange={e => setExpiryAt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>

          {/* Searchable course selector */}
          {courses.length > 0 && (
            <SearchableSelect label="Applicable Courses" items={courses}
              selected={selectedCourses}
              onToggle={id => toggleItem(id, selectedCourses, setSelectedCourses)}
              color="blue" hint="(empty = all courses)" />
          )}

          {/* Searchable product selector */}
          {products.length > 0 && (
            <SearchableSelect label="Applicable Products" items={products}
              selected={selectedProducts}
              onToggle={id => toggleItem(id, selectedProducts, setSelectedProducts)}
              color="orange" hint="(empty = all products)" />
          )}

          <div className="flex items-center gap-3 bg-gray-50 p-3.5 rounded-lg border border-gray-100">
            <input type="checkbox" id="is_active" checked={isActive} onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer" />
            <label htmlFor="is_active" className="text-sm font-semibold text-gray-800 cursor-pointer">
              Active — immediately usable
            </label>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold disabled:opacity-50">
              <Save size={15} />
              {submitting ? "Saving..." : editingId ? "Save Changes" : "Create Code"}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search codes..." value={search} onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 w-48" />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(["all","active","inactive","expired"] as const).map(f => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition ${filterStatus === f ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <h2 className="text-lg font-bold text-gray-900">
        {filterStatus === "all" ? "All Codes" : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}
        <span className="ml-2 text-sm font-normal text-gray-400">({visible.length})</span>
      </h2>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Tag className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="font-medium text-gray-600">No promo codes found</p>
          <p className="text-sm text-gray-400 mt-1">{search ? `No codes match "${search}"` : "Create your first code above"}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase">
                <tr>
                  <th className="text-left px-5 py-3.5">Code</th>
                  <th className="text-left px-5 py-3.5">Discount</th>
                  <th className="text-left px-5 py-3.5">Usage</th>
                  <th className="text-left px-5 py-3.5">Expiry</th>
                  <th className="text-left px-5 py-3.5">Applies To</th>
                  <th className="text-left px-5 py-3.5">Status</th>
                  <th className="text-center px-5 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map(c => {
                  const exp = isExpired(c.expiry_at);
                  const limit = c.usage_limit && c.usage_limit > 0;
                  const usagePct = limit ? Math.min(100, Math.round((c.used_count / (c.usage_limit as number)) * 100)) : 0;
                  const courseCount = c.applicable_course_ids?.length ?? 0;
                  const productCount = c.applicable_product_ids?.length ?? 0;
                  return (
                    <tr key={c.id} className={`hover:bg-gray-50/50 transition ${exp ? "opacity-70" : ""}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-blue-700">{c.code}</span>
                          <button onClick={() => copyCode(c.code, c.id)}
                            className="text-gray-300 hover:text-blue-500 transition" title="Copy">
                            {copyId === c.id ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                          </button>
                        </div>
                        {(c.min_order_amount ?? 0) > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5">Min ₹{c.min_order_amount}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">
                        <span className="flex items-center gap-1"><Percent size={13} className="text-gray-400" />{c.discount_percent}%</span>
                        {c.max_discount_amount && <span className="text-[10px] text-gray-400">Max ₹{c.max_discount_amount}</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="min-w-[100px]">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span className="flex items-center gap-1"><Users size={10}/>{c.used_count}</span>
                            <span>{limit ? `/${c.usage_limit}` : "∞"}</span>
                          </div>
                          {limit && (
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className={`h-full rounded-full ${usagePct>=90?"bg-red-500":usagePct>=70?"bg-amber-500":"bg-green-500"}`}
                                style={{width:`${usagePct}%`}} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {c.expiry_at ? (
                          <span className={`flex items-center gap-1 text-xs ${exp ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                            <Clock size={12} />{formatDateLong(c.expiry_at)}
                            {exp && " (Expired)"}
                          </span>
                        ) : <span className="text-gray-400 text-xs">No expiry</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit ${courseCount>0?"bg-blue-50 text-blue-700 border border-blue-100":"text-gray-400"}`}>
                            {courseCount > 0 ? `${courseCount} courses` : "All courses"}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit ${productCount>0?"bg-orange-50 text-orange-700 border border-orange-100":"text-gray-400"}`}>
                            {productCount > 0 ? `${productCount} products` : "All products"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => toggleActive(c.id, c.is_active)} disabled={exp}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition ${c.is_active&&!exp?"bg-green-50 text-green-700 hover:bg-green-100":"bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                          {c.is_active&&!exp ? <><ToggleRight size={14}/>Active</> : <><ToggleLeft size={14}/>Inactive</>}
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleEditClick(c)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 size={15} /></button>
                          <button onClick={() => deletePromoCode(c.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
