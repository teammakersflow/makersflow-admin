"use client";

import { useEffect, useState } from "react";
import DataErrorNotice from "@/components/DataErrorNotice";
import { useRouter, useParams } from "next/navigation";
import { backendApi } from "@/lib/backend-api";
import { ArrowLeft, Users, DollarSign, Tag } from "lucide-react";

type CouponUsage = {
  id: string; used_at: string; discount_amount: number; user_id: string;
  profiles?: { email: string; full_name: string | null } | null;
};
type Coupon = { id: string; code: string; discount_type: string; discount_value: number; used_count: number; usage_limit: number | null };

export default function CouponUsagePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [loadError, setLoadError] = useState("");
  const [usage, setUsage] = useState<CouponUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      backendApi.endpoint("/coupons").select("id, code, discount_type, discount_value, used_count, usage_limit").eq("id", id).maybeSingle(),
      backendApi.endpoint("/coupon-usage").select("id, used_at, discount_amount, user_id, profiles(email, full_name)").eq("coupon_id", id).order("used_at", { ascending: false }),
    ]).then(([{ data: c, error: couponErr }, { data: u, error: usageErr }]) => {
      if (couponErr) { console.warn("[coupon-usage] coupon load failed:", couponErr.message); setLoadError(couponErr.message); }
      if (usageErr) { console.warn("[coupon-usage] usage load failed:", usageErr.message); setLoadError(usageErr.message); }
      if (c) setCoupon(c as Coupon);
      setUsage((u ?? []) as unknown as CouponUsage[]);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;
  if (!coupon) return <div className="p-6 text-red-500">Coupon not found.</div>;

  const totalDiscount = usage.reduce((s, u) => s + (u.discount_amount ?? 0), 0);
  const uniqueUsers = new Set(usage.map(u => u.user_id)).size;
  const redemptionRate = coupon.usage_limit ? Math.round((coupon.used_count / coupon.usage_limit) * 100) : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <DataErrorNotice message={loadError} />
      <button onClick={() => router.push("/coupons")} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft size={18} /> Back to Coupons
      </button>
      <div>
        <div className="flex items-center gap-3">
          <span className="bg-blue-100 text-blue-700 font-mono font-bold px-3 py-1.5 rounded-lg text-xl">{coupon.code}</span>
          <span className="text-gray-500">{coupon.discount_type === "percentage" ? `${coupon.discount_value}% off` : `₹${coupon.discount_value} off`}</span>
        </div>
        <p className="mt-1 text-gray-500">Usage history</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Uses", value: coupon.used_count, icon: Tag, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Discount Given", value: `₹${totalDiscount.toLocaleString()}`, icon: DollarSign, color: "text-red-600", bg: "bg-red-50" },
          { label: "Unique Users", value: uniqueUsers, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
        ].map(s => { const Icon = s.icon; return (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className={`inline-flex p-2 rounded-lg ${s.bg} mb-3`}><Icon size={18} className={s.color} /></div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        );})}
      </div>
      {redemptionRate !== null && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-2">Redemption Rate: <span className="font-bold">{redemptionRate}%</span> ({coupon.used_count}/{coupon.usage_limit})</p>
          <div className="h-2 bg-gray-100 rounded-full"><div className="h-2 bg-blue-500 rounded-full" style={{ width: `${Math.min(redemptionRate,100)}%` }} /></div>
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100"><h2 className="font-semibold text-gray-900">Who Used This Coupon</h2></div>
        {usage.length === 0 ? <p className="px-6 py-12 text-center text-gray-400">No one has used this coupon yet</p> : (
          <table className="w-full">
            <thead className="bg-gray-50"><tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Customer</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Discount</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date Used</th>
            </tr></thead>
            <tbody>
              {usage.map(u => (
                <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-gray-900">{(u.profiles as any)?.full_name ?? "—"}</p>
                    <p className="text-xs text-gray-400">{(u.profiles as any)?.email ?? u.user_id.slice(0,8)}</p>
                  </td>
                  <td className="px-6 py-3 text-sm font-semibold text-red-600">−₹{u.discount_amount}</td>
                  <td className="px-6 py-3 text-xs text-gray-500">{new Date(u.used_at).toLocaleString("en-IN", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
