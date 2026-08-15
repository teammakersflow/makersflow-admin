"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { db } from "@/lib/db";
import { ArrowLeft, Save } from "lucide-react";

export default function EditCouponPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [form, setForm] = useState({
    code: "", description: "",
    discount_type: "percentage" as "percentage" | "flat",
    discount_value: "", min_order_amount: "0",
    max_discount_amount: "", expiry_date: "",
    usage_limit: "", is_active: true,
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const toggleItem = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  };

  useEffect(() => {
    Promise.all([
      db.from("coupons").select("*").eq("id", id).single(),
      db.from("courses").select("id, title").eq("is_published", true),
      db.from("products").select("id, title"),
    ]).then(([{ data }, { data: c }, { data: p }]) => {
      if (data) {
        setForm({
          code: data.code,
          description: data.description || "",
          discount_type: data.discount_type,
          discount_value: String(data.discount_value),
          min_order_amount: String(data.min_order_amount),
          max_discount_amount: data.max_discount_amount ? String(data.max_discount_amount) : "",
          expiry_date: data.expiry_date ? data.expiry_date.slice(0, 16) : "",
          usage_limit: data.usage_limit ? String(data.usage_limit) : "",
          is_active: data.is_active,
        });
        setSelectedCourses(data.applicable_course_ids ?? []);
        setSelectedProducts(data.applicable_product_ids ?? []);
      }
      const dedup = (arr: any[]) => {
        const seen = new Set<string>();
        return arr.filter((x: any) => { const k = x.title.trim().toLowerCase(); return seen.has(k) ? false : (seen.add(k), true); });
      };
      setCourses(dedup(c ?? []));
      setProducts(dedup(p ?? []));
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    if (!form.code.trim()) { alert("Coupon code is required"); return; }
    if (!form.discount_value || Number(form.discount_value) <= 0) { alert("Discount value must be > 0"); return; }
    setSaving(true);
    const { error } = await db.from("coupons").update({
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
    }).eq("id", id);
    setSaving(false);
    if (error) { alert(error.message); return; }
    router.push("/coupons");
  };

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>;

  const inputCls = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500";

  return (
    <div className="space-y-6 max-w-2xl">
      <button onClick={() => router.push("/coupons")} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft size={18} /> Back to Coupons
      </button>
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Edit Coupon</h1>
        <p className="mt-1 text-gray-600">Update coupon settings</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Coupon Code</label>
            <input type="text" value={form.code} onChange={e => set("code", e.target.value.toUpperCase())} className={inputCls + " font-mono uppercase"} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Description</label>
            <input type="text" value={form.description} onChange={e => set("description", e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Discount Type</label>
            <select value={form.discount_type} onChange={e => set("discount_type", e.target.value)} className={inputCls}>
              <option value="percentage">Percentage (%)</option>
              <option value="flat">Flat Amount (₹)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Discount Value</label>
            <input type="text" inputMode="decimal" value={form.discount_value} onChange={e => set("discount_value", e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Min Order Amount (₹)</label>
            <input type="text" inputMode="numeric" value={form.min_order_amount} onChange={e => set("min_order_amount", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Max Discount (₹) <span className="text-gray-400 text-xs">optional</span></label>
            <input type="text" inputMode="numeric" placeholder="No cap" value={form.max_discount_amount} onChange={e => set("max_discount_amount", e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Expiry Date <span className="text-gray-400 text-xs">optional</span></label>
            <input type="datetime-local" value={form.expiry_date} onChange={e => set("expiry_date", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Usage Limit <span className="text-gray-400 text-xs">blank = unlimited</span></label>
            <input type="text" inputMode="numeric" placeholder="Unlimited" value={form.usage_limit} onChange={e => set("usage_limit", e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Applicable Courses */}
        {courses.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Applicable Courses <span className="text-gray-400 text-xs">(leave empty for all)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {courses.map(c => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedCourses.includes(c.id)}
                    onChange={() => toggleItem(c.id, selectedCourses, setSelectedCourses)} className="accent-blue-600" />
                  <span className="truncate">{c.title}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Applicable Products */}
        {products.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Applicable Products <span className="text-gray-400 text-xs">(leave empty for all)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {products.map(p => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedProducts.includes(p.id)}
                    onChange={() => toggleItem(p.id, selectedProducts, setSelectedProducts)} className="accent-blue-600" />
                  <span className="truncate">{p.title}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4 accent-blue-600" />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-900">Active</label>
        </div>

        <div className="flex gap-4 pt-2 border-t border-gray-100">
          <button onClick={() => router.push("/coupons")} className="px-6 py-2.5 border border-gray-300 text-gray-900 font-medium rounded-lg hover:bg-gray-50 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
            <Save size={16} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
