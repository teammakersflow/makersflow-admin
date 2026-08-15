"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Save } from "lucide-react";

export default function NewCouponPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [form, setForm] = useState({
    code: "",
    description: "",
    discount_type: "percentage" as "percentage" | "flat",
    discount_value: "",
    min_order_amount: "0",
    max_discount_amount: "",
    expiry_date: "",
    usage_limit: "",
    is_active: true,
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    supabase.from("courses").select("id, title").eq("is_published", true).then(({ data }) => {
      const seen = new Set<string>();
      setCourses((data ?? []).filter((c: any) => { const k = c.title.trim().toLowerCase(); return seen.has(k) ? false : (seen.add(k), true); }));
    });
    supabase.from("products").select("id, title").then(({ data }) => {
      const seen = new Set<string>();
      setProducts((data ?? []).filter((p: any) => { const k = p.title.trim().toLowerCase(); return seen.has(k) ? false : (seen.add(k), true); }));
    });
  }, []);

  const toggleItem = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  };

  const handleCreate = async () => {
    if (!form.code.trim()) { alert("Coupon code is required"); return; }
    if (!form.discount_value || Number(form.discount_value) <= 0) { alert("Discount value must be greater than 0"); return; }
    if (form.discount_type === "percentage" && Number(form.discount_value) > 100) { alert("Percentage discount cannot exceed 100%"); return; }

    setLoading(true);

    const { error } = await supabase.from("coupons").insert({
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
    });

    setLoading(false);
    if (error) { alert(error.message); return; }
    router.push("/coupons");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <button onClick={() => router.push("/coupons")} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft size={18} /> Back to Coupons
      </button>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create New Coupon</h1>
        <p className="mt-1 text-gray-600">Set up a discount coupon for customers</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-6">

        {/* Code + Description */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Coupon Code <span className="text-red-500">*</span></label>
            <input type="text" placeholder="e.g. SUMMER20" value={form.code}
              onChange={e => set("code", e.target.value.toUpperCase())}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-mono uppercase outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Description <span className="text-gray-400 text-xs">(optional)</span></label>
            <input type="text" placeholder="Summer sale discount" value={form.description}
              onChange={e => set("description", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>

        {/* Discount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Discount Type</label>
            <select value={form.discount_type} onChange={e => set("discount_type", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
              <option value="percentage">Percentage (%)</option>
              <option value="flat">Flat Amount (₹)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Discount Value <span className="text-red-500">*</span>
              <span className="text-gray-400 ml-1 text-xs">({form.discount_type === "percentage" ? "%" : "₹"})</span>
            </label>
            <input type="text" inputMode="decimal" value={form.discount_value}
              onChange={e => set("discount_value", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>

        {/* Min Order + Max Discount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Minimum Order Amount (₹)</label>
            <input type="text" inputMode="numeric" value={form.min_order_amount}
              onChange={e => set("min_order_amount", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Max Discount (₹) <span className="text-gray-400 text-xs">(optional, for % coupons)</span>
            </label>
            <input type="text" inputMode="numeric" placeholder="No cap"
              value={form.max_discount_amount}
              onChange={e => set("max_discount_amount", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>

        {/* Expiry + Usage limit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Expiry Date <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <input type="datetime-local" value={form.expiry_date}
              onChange={e => set("expiry_date", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Usage Limit <span className="text-gray-400 text-xs">(optional, blank = unlimited)</span>
            </label>
            <input type="text" inputMode="numeric" placeholder="Unlimited"
              value={form.usage_limit}
              onChange={e => set("usage_limit", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>

        {/* Applicable Courses */}
        {courses.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Applicable Courses <span className="text-gray-400 text-xs">(leave empty for all courses)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {courses.map(c => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedCourses.includes(c.id)}
                    onChange={() => toggleItem(c.id, selectedCourses, setSelectedCourses)}
                    className="accent-blue-600" />
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
              Applicable Products <span className="text-gray-400 text-xs">(leave empty for all products)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {products.map(p => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedProducts.includes(p.id)}
                    onChange={() => toggleItem(p.id, selectedProducts, setSelectedProducts)}
                    className="accent-blue-600" />
                  <span className="truncate">{p.title}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Active toggle */}
        <div className="flex items-center gap-3">
          <input type="checkbox" id="is_active" checked={form.is_active}
            onChange={e => set("is_active", e.target.checked)} className="w-4 h-4 accent-blue-600" />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-900">
            Active — coupon is immediately usable by customers
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-2 border-t border-gray-100">
          <button onClick={() => router.push("/coupons")}
            className="px-6 py-2.5 border border-gray-300 text-gray-900 font-medium rounded-lg hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
            <Save size={18} />
            {loading ? "Creating..." : "Create Coupon"}
          </button>
        </div>
      </div>
    </div>
  );
}
