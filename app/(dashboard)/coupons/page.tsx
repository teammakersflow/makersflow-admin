"use client";

import { useEffect, useState, useMemo } from "react";
import { formatDate, formatDateLong } from "@/lib/format";
import { useRouter } from "next/navigation";
import { backendApi } from "@/lib/backend-api";
import {
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Calendar, Tag,
  BarChart2, Search, Copy, Check, Download, Users, Clock,
  Percent, TrendingUp, X, ChevronDown, ChevronUp, Info, Save, AlertTriangle
} from "lucide-react";

type Coupon = {
  id: string; code: string; description: string | null;
  discount_type: "percentage" | "flat";
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  expiry_date: string | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
  applicable_course_ids: string[] | null;
  applicable_product_ids: string[] | null;
  created_at: string;
};

// Searchable multi-select dropdown
function SearchableSelect({
  label, items, selected, onToggle, accent = "blue", hint
}: {
  label: string; items: Array<{ id: string; title: string }>;
  selected: string[]; onToggle: (id: string) => void;
  accent?: string; hint?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => items.filter(i => i.title.toLowerCase().includes(q.toLowerCase())), [items, q]);
  const selectedItems = items.filter(i => selected.includes(i.id));
  const badgeCls = accent === "orange" ? "bg-orange-50 text-orange-700 border-orange-100" : "bg-blue-50 text-blue-700 border-blue-100";
  const checkCls = accent === "orange" ? "accent-orange-500" : "accent-blue-600";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-700">
          {label}
          {selected.length > 0 && (
            <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded border ${badgeCls}`}>{selected.length} selected</span>
          )}
        </label>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedItems.map(item => (
            <span key={item.id} className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${badgeCls}`}>
              {item.title}
              <button type="button" onClick={() => onToggle(item.id)}><X size={10} /></button>
            </span>
          ))}
          <button type="button" onClick={() => selectedItems.forEach(i => onToggle(i.id))} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear all</button>
        </div>
      )}
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white hover:border-gray-300 transition text-left">
        <span className="text-gray-500">{selected.length === 0 ? `Search & select ${label.toLowerCase()}…` : `${selected.length} of ${items.length} selected`}</span>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>
      {open && (
        <div className="border border-gray-200 rounded-xl bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
          </div>
          {filtered.length > 0 && (
            <div className="px-3 py-1.5 border-b border-gray-50 flex gap-3">
              <button type="button" onClick={() => filtered.forEach(i => { if (!selected.includes(i.id)) onToggle(i.id); })} className="text-xs text-blue-600 hover:underline font-medium">Select all</button>
              <button type="button" onClick={() => filtered.forEach(i => { if (selected.includes(i.id)) onToggle(i.id); })} className="text-xs text-gray-400 hover:text-gray-600 hover:underline">Clear</button>
            </div>
          )}
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No results for "{q}"</p>
            ) : filtered.map(item => (
              <label key={item.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm transition">
                <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} className={`w-4 h-4 ${checkCls} rounded`} />
                <span className="text-gray-700 font-medium truncate">{item.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CouponsPage() {
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copyId, setCopyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all"|"active"|"inactive"|"expired">("all");

  // Form state
  const [form, setForm] = useState({
    code: "", description: "", discount_type: "percentage" as "percentage"|"flat",
    discount_value: "", min_order_amount: "0", max_discount_amount: "",
    expiry_date: "", usage_limit: "", is_active: true,
  });
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const toggleItem = (id: string, list: string[], setList: (v: string[]) => void) =>
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  useEffect(() => {
    Promise.all([
      backendApi.endpoint("/coupons").select("*").order("created_at", { ascending: false }),
      backendApi.endpoint("/courses").select("id, title").eq("is_published", true),
      backendApi.endpoint("/products").select("id, title"),
    ]).then(([c, co, p]) => {
      setCoupons((c.data as Coupon[]) ?? []);
      // Deduplicate by title
      const dedup = (arr: any[]) => { const s = new Set<string>(); return arr.filter(x => s.has(x.title.toLowerCase()) ? false : (s.add(x.title.toLowerCase()), true)); };
      setCourses(dedup(co.data ?? []));
      setProducts(dedup(p.data ?? []));
      setLoading(false);
    });
  }, []);

  const isExpired = (d: string | null) => d ? new Date(d) < new Date() : false;

  const resetForm = () => {
    setForm({ code: "", description: "", discount_type: "percentage", discount_value: "", min_order_amount: "0", max_discount_amount: "", expiry_date: "", usage_limit: "", is_active: true });
    setSelectedCourses([]); setSelectedProducts([]); setEditingId(null);
  };

  const handleEdit = (c: Coupon) => {
    setEditingId(c.id);
    setForm({
      code: c.code, description: c.description ?? "",
      discount_type: c.discount_type, discount_value: String(c.discount_value),
      min_order_amount: String(c.min_order_amount ?? 0),
      max_discount_amount: c.max_discount_amount ? String(c.max_discount_amount) : "",
      expiry_date: c.expiry_date ? c.expiry_date.slice(0, 10) : "",
      usage_limit: c.usage_limit ? String(c.usage_limit) : "",
      is_active: c.is_active,
    });
    setSelectedCourses(c.applicable_course_ids ?? []);
    setSelectedProducts(c.applicable_product_ids ?? []);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) { alert("Code is required"); return; }
    if (!form.discount_value || Number(form.discount_value) <= 0) { alert("Discount value must be > 0"); return; }
    if (form.discount_type === "percentage" && Number(form.discount_value) > 100) { alert("Percentage cannot exceed 100%"); return; }
    setSubmitting(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      min_order_amount: Number(form.min_order_amount) || 0,
      max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
      expiry_date: form.expiry_date || null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      is_active: form.is_active,
      applicable_course_ids: selectedCourses,
      applicable_product_ids: selectedProducts,
    };
    try {
      if (editingId) {
        const { data, error } = await backendApi.endpoint("/coupons").update(payload).eq("id", editingId).select().single();
        if (error) alert(error.message);
        else { setCoupons(prev => prev.map(c => c.id === editingId ? (data as Coupon) : c)); resetForm(); setShowForm(false); }
      } else {
        const { data, error } = await backendApi.endpoint("/coupons").insert({ ...payload, used_count: 0 }).select().single();
        if (error) alert(error.message);
        else { setCoupons(prev => [data as Coupon, ...prev]); resetForm(); setShowForm(false); }
      }
    } finally { setSubmitting(false); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await backendApi.endpoint("/coupons").update({ is_active: !current }).eq("id", id);
    if (!error) setCoupons(prev => prev.map(c => c.id === id ? { ...c, is_active: !current } : c));
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("Delete this coupon? This cannot be undone.")) return;
    const { error } = await backendApi.endpoint("/coupons").delete().eq("id", id);
    if (!error) setCoupons(prev => prev.filter(c => c.id !== id));
    else alert(error.message);
  };

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopyId(id); setTimeout(() => setCopyId(null), 1500);
  };

  const exportCSV = () => {
    const rows = [["Code","Type","Value","Min Order","Max Discount","Used","Limit","Expiry","Status","Created"]];
    coupons.forEach(c => rows.push([
      c.code, c.discount_type,
      c.discount_type === "percentage" ? `${c.discount_value}%` : `₹${c.discount_value}`,
      String(c.min_order_amount ?? 0),
      c.max_discount_amount ? `₹${c.max_discount_amount}` : "None",
      String(c.used_count), c.usage_limit ? String(c.usage_limit) : "Unlimited",
      c.expiry_date ? formatDate(c.expiry_date) : "Never",
      c.is_active && !isExpired(c.expiry_date) ? "Active" : "Inactive",
      formatDate(c.created_at),
    ]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `coupons_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const visible = coupons.filter(c => {
    const exp = isExpired(c.expiry_date);
    if (filterStatus === "active" && (!c.is_active || exp)) return false;
    if (filterStatus === "inactive" && (c.is_active && !exp)) return false;
    if (filterStatus === "expired" && !exp) return false;
    if (search && !c.code.toLowerCase().includes(search.toLowerCase()) &&
        !(c.description ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeCount = coupons.filter(c => c.is_active && !isExpired(c.expiry_date)).length;
  const expiredCount = coupons.filter(c => isExpired(c.expiry_date)).length;
  const totalSaved = coupons.reduce((s, c) => s + c.used_count, 0);
  const nearLimit = coupons.filter(c => c.usage_limit && c.used_count >= c.usage_limit * 0.9).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Coupons</h1>
          <p className="mt-1 text-sm text-gray-500">Discount codes validated at checkout in the app</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCSV}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
            <Download size={15} /> Export CSV
          </button>
          <button onClick={() => { if (showForm) resetForm(); setShowForm(!showForm); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-semibold">
            {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? "Close" : "New Coupon"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Coupons", value: coupons.length, color: "text-gray-700 bg-gray-50" },
          { label: "Active", value: activeCount, color: "text-green-700 bg-green-50" },
          { label: "Expired", value: expiredCount, color: "text-red-700 bg-red-50" },
          { label: "Total Uses", value: totalSaved, color: "text-blue-700 bg-blue-50" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Near-limit warning */}
      {nearLimit > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm font-semibold text-amber-900">
            {nearLimit} coupon{nearLimit > 1 ? "s are" : " is"} at 90%+ of usage limit — consider increasing the limit
          </p>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-7 shadow-md space-y-6 max-w-3xl">
          <div className="flex justify-between items-center pb-3 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">{editingId ? `Edit: ${form.code}` : "Create New Coupon"}</h2>
            <button type="button" onClick={() => { resetForm(); setShowForm(false); }}><X size={18} className="text-gray-400 hover:text-gray-700" /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Coupon Code <span className="text-red-500">*</span></label>
              <input value={form.code} onChange={e => set("code", e.target.value.toUpperCase())}
                placeholder="e.g. SAVE20" required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono font-bold uppercase outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description <span className="text-gray-400 text-xs">(optional)</span></label>
              <input value={form.description} onChange={e => set("description", e.target.value)} placeholder="e.g. Summer sale 20% off"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Discount Type <span className="text-red-500">*</span></label>
              <select value={form.discount_type} onChange={e => set("discount_type", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {form.discount_type === "percentage" ? "Discount %" : "Discount ₹"} <span className="text-red-500">*</span>
              </label>
              <input type="number" min="1" max={form.discount_type === "percentage" ? "100" : undefined}
                value={form.discount_value} onChange={e => set("discount_value", e.target.value)}
                placeholder={form.discount_type === "percentage" ? "e.g. 20" : "e.g. 100"} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Min Order (₹)</label>
              <input type="number" min="0" value={form.min_order_amount} onChange={e => set("min_order_amount", e.target.value)} placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Max Discount Cap (₹) <span className="text-gray-400 text-xs">(optional)</span></label>
              <input type="number" min="1" value={form.max_discount_amount} onChange={e => set("max_discount_amount", e.target.value)} placeholder="e.g. 500"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Usage Limit <span className="text-gray-400 text-xs">(blank=unlimited)</span></label>
              <input type="number" min="1" value={form.usage_limit} onChange={e => set("usage_limit", e.target.value)} placeholder="e.g. 100"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Expiry Date <span className="text-gray-400 text-xs">(optional)</span></label>
              <input type="date" value={form.expiry_date} onChange={e => set("expiry_date", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>

          {courses.length > 0 && (
            <SearchableSelect label="Applicable Courses" items={courses} selected={selectedCourses}
              onToggle={id => toggleItem(id, selectedCourses, setSelectedCourses)} accent="blue" hint="(empty = all courses)" />
          )}
          {products.length > 0 && (
            <SearchableSelect label="Applicable Products" items={products} selected={selectedProducts}
              onToggle={id => toggleItem(id, selectedProducts, setSelectedProducts)} accent="orange" hint="(empty = all products)" />
          )}

          {/* Live preview */}
          {form.discount_value && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Live Preview</p>
              <p className="text-sm text-blue-900 font-medium">
                Code <span className="font-mono font-bold">{form.code || "CODE"}</span> gives{" "}
                {form.discount_type === "percentage" ? `${form.discount_value}% off` : `₹${form.discount_value} off`}
                {form.min_order_amount && Number(form.min_order_amount) > 0 ? ` on orders above ₹${form.min_order_amount}` : ""}
                {form.max_discount_amount ? ` (max ₹${form.max_discount_amount} discount)` : ""}
                {form.expiry_date ? ` · Expires ${formatDateLong(form.expiry_date)}` : ""}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 bg-gray-50 p-3.5 rounded-lg border border-gray-100">
            <input type="checkbox" id="is_active_c" checked={form.is_active} onChange={e => set("is_active", e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer" />
            <label htmlFor="is_active_c" className="text-sm font-semibold text-gray-800 cursor-pointer">
              Active — immediately usable at app checkout
            </label>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium">Cancel</button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold disabled:opacity-50">
              <Save size={15} />{submitting ? "Saving..." : editingId ? "Save Changes" : "Create Coupon"}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search code or description..." value={search} onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 w-56" />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(["all","active","inactive","expired"] as const).map(f => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition ${filterStatus === f ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">{visible.length} of {coupons.length}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : coupons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Tag className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="font-semibold text-gray-700">No coupons yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first coupon code above</p>
          <div className="mt-4 text-xs text-gray-400 bg-blue-50 border border-blue-100 rounded-lg p-3 max-w-xs mx-auto">
            <Info size={12} className="inline mr-1 text-blue-400" />
            Coupons created here are validated at app checkout via the <code>validate-coupon</code> edge function
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-500">
          No coupons match "{search || filterStatus}"
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase">
                <tr>
                  <th className="text-left px-5 py-3.5">Code</th>
                  <th className="text-left px-5 py-3.5">Discount</th>
                  <th className="text-left px-5 py-3.5">Min Order</th>
                  <th className="text-left px-5 py-3.5">Usage</th>
                  <th className="text-left px-5 py-3.5">Expiry</th>
                  <th className="text-left px-5 py-3.5">Applies To</th>
                  <th className="text-left px-5 py-3.5">Status</th>
                  <th className="text-center px-5 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map(c => {
                  const exp = isExpired(c.expiry_date);
                  const hasLimit = c.usage_limit && c.usage_limit > 0;
                  const usagePct = hasLimit ? Math.min(100, Math.round((c.used_count / (c.usage_limit as number)) * 100)) : 0;
                  const nearLimitThis = hasLimit && usagePct >= 90;
                  return (
                    <tr key={c.id} className={`hover:bg-gray-50/60 transition ${exp ? "opacity-60" : ""}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-blue-700">{c.code}</span>
                          <button onClick={() => copyCode(c.code, c.id)} className="text-gray-300 hover:text-blue-500 transition" title="Copy">
                            {copyId === c.id ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                          </button>
                        </div>
                        {c.description && <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[140px]">{c.description}</p>}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">
                        <span className="flex items-center gap-1">
                          {c.discount_type === "percentage" ? <Percent size={13} className="text-gray-400" /> : <span className="text-gray-400 text-xs">₹</span>}
                          {c.discount_type === "percentage" ? `${c.discount_value}%` : `₹${c.discount_value}`}
                        </span>
                        {c.max_discount_amount && <span className="text-[10px] text-gray-400">Max ₹{c.max_discount_amount}</span>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        {(c.min_order_amount ?? 0) > 0 ? `₹${c.min_order_amount}` : <span className="text-gray-400">None</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="min-w-[100px]">
                          <div className="flex justify-between text-xs mb-1">
                            <span className={`flex items-center gap-1 ${nearLimitThis ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                              <Users size={10} />{c.used_count}
                              {nearLimitThis && " ⚠"}
                            </span>
                            <span className="text-gray-400">{hasLimit ? `/${c.usage_limit}` : "∞"}</span>
                          </div>
                          {hasLimit && (
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className={`h-full rounded-full ${usagePct>=90?"bg-red-500":usagePct>=70?"bg-amber-500":"bg-green-500"}`}
                                style={{ width: `${usagePct}%` }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {c.expiry_date ? (
                          <span className={`flex items-center gap-1 text-xs ${exp ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                            <Clock size={12} />
                            {formatDateLong(c.expiry_date)}
                            {exp && " (Expired)"}
                          </span>
                        ) : <span className="text-gray-400 text-xs">Never</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit ${(c.applicable_course_ids?.length ?? 0) > 0 ? "bg-blue-50 text-blue-700" : "text-gray-400"}`}>
                            {(c.applicable_course_ids?.length ?? 0) > 0 ? `${c.applicable_course_ids!.length} courses` : "All courses"}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit ${(c.applicable_product_ids?.length ?? 0) > 0 ? "bg-orange-50 text-orange-700" : "text-gray-400"}`}>
                            {(c.applicable_product_ids?.length ?? 0) > 0 ? `${c.applicable_product_ids!.length} products` : "All products"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => toggleActive(c.id, c.is_active)} disabled={exp}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition ${c.is_active && !exp ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                          {c.is_active && !exp ? <><ToggleRight size={14}/>Active</> : <><ToggleLeft size={14}/>Inactive</>}
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => router.push(`/coupons/${c.id}/usage`)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="View usage">
                            <BarChart2 size={15} />
                          </button>
                          <button onClick={() => handleEdit(c)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition" title="Edit">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => deleteCoupon(c.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 bg-gray-50/50">
            Showing {visible.length} of {coupons.length} coupons
          </div>
        </div>
      )}
    </div>
  );
}
