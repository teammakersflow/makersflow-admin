"use client";

import { useEffect, useState } from "react";
import DataErrorNotice from "@/components/DataErrorNotice";
import { useProfile } from "@/hooks/useProfile";
import { useRouter } from "next/navigation";
import { backendApi } from "@/lib/backend-api";
import { apiFetch, tokenStore } from "@/lib/api-client";
import { Settings, LogOut, User, Mail, Shield, Store, CreditCard, FileText, Bell, Save, Check } from "lucide-react";

export default function SettingsPage() {
  const { profile } = useProfile();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [loadError, setLoadError] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success"|"error"; text: string } | null>(null);

  // Store info
  const [storeName, setStoreName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [savingStore, setSavingStore] = useState(false);
  const [storeMsg, setStoreMsg] = useState<string | null>(null);

  // Shipping (live from DB)
  const [shippingFee, setShippingFee] = useState("49");
  const [remoteFee, setRemoteFee] = useState("149");
  const [freeThreshold, setFreeThreshold] = useState("999");
  const [savingShipping, setSavingShipping] = useState(false);
  const [shippingMsg, setShippingMsg] = useState<string | null>(null);

  useEffect(() => {
    // Load store settings
    backendApi.endpoint("/settings").select("key,value").in("key", [
      "store_name","support_email","gst_number","store_phone",
      "shipping_fee","shipping_fee_remote","free_shipping_threshold",
    ]).then(({ data, error }) => {
      if (error) setLoadError(error.message);
      const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
      setStoreName(map.store_name ?? "MakersFlow");
      setSupportEmail(map.support_email ?? "");
      setGstNumber(map.gst_number ?? "");
      setStorePhone(map.store_phone ?? "");
      setShippingFee(map.shipping_fee ?? "49");
      setRemoteFee(map.shipping_fee_remote ?? "149");
      setFreeThreshold(map.free_shipping_threshold ?? "999");
    });
  }, []);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) { setMsg({ type: "error", text: "Passwords don't match" }); return; }
    if (newPassword.length < 6) { setMsg({ type: "error", text: "Minimum 6 characters" }); return; }
    // Sign-in is Google-only now, so this app has no password to change.
    // The backend also exposes no password endpoint. Left visible but inert
    // rather than silently pretending to succeed.
    setMsg({
      type: "error",
      text: "Passwords no longer apply — this admin panel signs in with Google. Manage the account at myaccount.google.com.",
    });
    setTimeout(() => setMsg(null), 6000);
  };

  // ── FIX ────────────────────────────────────────────────────────────────────
  // These upserts specified no conflict target, so PostgREST fell back to the
  // primary key. More importantly the Promise.all result was discarded entirely
  // and "saved!" was shown unconditionally — so a failed write (RLS denial,
  // wrong conflict target, bad value) still reported success and the admin had
  // no idea the setting never persisted. Target `key` and surface real errors.
  const saveStoreInfo = async () => {
    setSavingStore(true);
    const results = await Promise.all([
      backendApi.endpoint("/settings").upsert({ key: "store_name", value: storeName }, { onConflict: "key" }),
      backendApi.endpoint("/settings").upsert({ key: "support_email", value: supportEmail }, { onConflict: "key" }),
      backendApi.endpoint("/settings").upsert({ key: "gst_number", value: gstNumber }, { onConflict: "key" }),
      backendApi.endpoint("/settings").upsert({ key: "store_phone", value: storePhone }, { onConflict: "key" }),
    ]);
    setSavingStore(false);

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error("[settings] saveStoreInfo failed:", failed.error);
      setStoreMsg(`Could not save: ${failed.error.message}`);
    } else {
      setStoreMsg("Store info saved!");
    }
    setTimeout(() => setStoreMsg(null), 5000);
  };

  const saveShipping = async () => {
    setSavingShipping(true);
    const results = await Promise.all([
      backendApi.endpoint("/settings").upsert({ key: "shipping_fee", value: shippingFee }, { onConflict: "key" }),
      backendApi.endpoint("/settings").upsert({ key: "shipping_fee_remote", value: remoteFee }, { onConflict: "key" }),
      backendApi.endpoint("/settings").upsert({ key: "free_shipping_threshold", value: freeThreshold }, { onConflict: "key" }),
    ]);
    setSavingShipping(false);

    // These three values are read at checkout by both the web app and the
    // mobile app. A silent failure here mispriced every order.
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error("[settings] saveShipping failed:", failed.error);
      setShippingMsg(`Could not save: ${failed.error.message}`);
    } else {
      setShippingMsg("Shipping fees saved!");
    }
    setTimeout(() => setShippingMsg(null), 5000);
  };

  const handleLogout = async () => {
    try { await apiFetch("/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    tokenStore.clear();
    router.replace("/login");
  };

  const inp = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition";

  return (
    <div className="space-y-6 max-w-2xl">
      <DataErrorNotice message={loadError} />
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your store, account, and admin preferences</p>
      </div>

      {/* Admin profile */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="border-b border-gray-50 px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-xl"><User size={18} className="text-blue-600" /></div>
          <h2 className="font-semibold text-gray-900">Your Account</h2>
        </div>
        <div className="p-6 space-y-3 text-sm">
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
            <Mail size={15} className="text-gray-400" />
            <span className="text-gray-700">{profile?.email ?? "Loading..."}</span>
            <span className="ml-auto text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Verified</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
            <Shield size={15} className="text-gray-400" />
            <span className="text-gray-700 capitalize">{(profile as any)?.role ?? "Administrator"}</span>
          </div>
        </div>
      </div>

      {/* Store Info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="border-b border-gray-50 px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-xl"><Store size={18} className="text-purple-600" /></div>
          <h2 className="font-semibold text-gray-900">Store Information</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Store Name</label>
              <input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="MakersFlow" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Support Email</label>
              <input value={supportEmail} onChange={e => setSupportEmail(e.target.value)} placeholder="support@yourstore.com" type="email" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">GST Number</label>
              <input value={gstNumber} onChange={e => setGstNumber(e.target.value)} placeholder="29XXXXXXXXX1Z5" className={inp + " font-mono"} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Support Phone</label>
              <input value={storePhone} onChange={e => setStorePhone(e.target.value)} placeholder="+91 98765 43210" className={inp} />
            </div>
          </div>
          {storeMsg && (
            <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-100 rounded-xl px-4 py-2">
              <Check size={14} /> {storeMsg}
            </div>
          )}
          <button onClick={saveStoreInfo} disabled={savingStore}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition disabled:opacity-40">
            <Save size={15} /> {savingStore ? "Saving..." : "Save Store Info"}
          </button>
        </div>
      </div>

      {/* Shipping Fees */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="border-b border-gray-50 px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-amber-50 rounded-xl"><FileText size={18} className="text-amber-600" /></div>
          <h2 className="font-semibold text-gray-900">Shipping Fees</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Standard (₹)</label>
              <input value={shippingFee} onChange={e => setShippingFee(e.target.value.replace(/\D/g,""))} className={inp} placeholder="49" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Remote Area (₹)</label>
              <input value={remoteFee} onChange={e => setRemoteFee(e.target.value.replace(/\D/g,""))} className={inp} placeholder="149" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Free Above (₹)</label>
              <input value={freeThreshold} onChange={e => setFreeThreshold(e.target.value.replace(/\D/g,""))} className={inp} placeholder="999" />
            </div>
          </div>
          {shippingMsg && (
            <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-100 rounded-xl px-4 py-2">
              <Check size={14} /> {shippingMsg}
            </div>
          )}
          <button onClick={saveShipping} disabled={savingShipping}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 transition disabled:opacity-40">
            <Save size={15} /> {savingShipping ? "Saving..." : "Save Shipping Fees"}
          </button>
        </div>
      </div>

      {/* Razorpay Config Note */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="border-b border-gray-50 px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-xl"><CreditCard size={18} className="text-blue-600" /></div>
          <h2 className="font-semibold text-gray-900">Payment Gateway (Razorpay)</h2>
        </div>
        <div className="p-6 space-y-3 text-sm">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-amber-800 text-sm">
            <p className="font-semibold mb-1">Keys are in .env.local for security</p>
            <p className="text-xs text-amber-700">Razorpay keys (KEY_ID, KEY_SECRET, WEBHOOK_SECRET) must be set in your <code className="font-mono bg-amber-100 px-1 rounded">.env.local</code> file and are never stored in the database. Restart the server after changing them.</p>
          </div>
          <div className="space-y-2">
            {[
              { key: "RAZORPAY_KEY_ID", hint: "rzp_live_XXXXXXXXXXXX" },
              { key: "RAZORPAY_KEY_SECRET", hint: "Your secret key" },
              { key: "RAZORPAY_WEBHOOK_SECRET", hint: "From Razorpay webhook settings" },
              { key: "NEXT_PUBLIC_API_URL", hint: "NestJS backend base URL" },
              { key: "NEXT_PUBLIC_GOOGLE_CLIENT_ID", hint: "Google OAuth client ID" },
              { key: "NEXT_PUBLIC_S3_PUBLIC_BASE_URL", hint: "Public S3/CDN base for uploads" },
            ].map(e => (
              <div key={e.key} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                <code className="text-xs font-mono text-gray-700 flex-1">{e.key}</code>
                <span className="text-xs text-gray-400">{e.hint}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="border-b border-gray-50 px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-gray-50 rounded-xl"><Shield size={18} className="text-gray-600" /></div>
          <h2 className="font-semibold text-gray-900">Change Password</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 6 characters" autoComplete="new-password" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat password" autoComplete="new-password" className={inp} />
          </div>
          {msg && (
            <div className={`text-sm px-4 py-3 rounded-xl ${msg.type === "success" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
              {msg.text}
            </div>
          )}
          <button onClick={handlePasswordChange} disabled={saving || !newPassword || !confirmPassword}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition disabled:opacity-40">
            <Save size={15} /> {saving ? "Updating..." : "Update Password"}
          </button>
        </div>
      </div>

      {/* Sign out */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 text-sm">Sign Out</p>
            <p className="text-xs text-gray-400 mt-0.5">You will be redirected to the login page</p>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 transition text-sm font-medium">
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
