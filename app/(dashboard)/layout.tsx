"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/sidebar";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "../../lib/supabase";
import { Bell, Search, X, BookOpen, Package, ShoppingCart, Tag } from "lucide-react";

type SearchResult = {
  type: "course" | "product" | "order" | "coupon";
  id: string; title: string; sub?: string; href: string;
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [search, setSearch]           = useState("");
  const [results, setResults]         = useState<SearchResult[]>([]);
  const [searching, setSearching]     = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [notifCount, setNotifCount]   = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();
  const { profile } = useProfile();

  // ── Access control: only admins may use this dashboard ──────────────────
  // RLS is the hard enforcement layer (is_admin() policies in the DB); this
  // guard keeps non-admin accounts out of the UI entirely.
  const [accessChecked, setAccessChecked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.replace("/login");
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (cancelled) return;
      if ((prof as { role?: string } | null)?.role !== "admin") {
        await supabase.auth.signOut();
        alert("This account does not have admin access.");
        router.replace("/login");
        return;
      }
      setAccessChecked(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notification count
  useEffect(() => {
    // Show bell badge for pending orders + failed payments
    Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "failed"),
    ]).then(([{ count: o }, { count: p }]) => setNotifCount((o ?? 0) + (p ?? 0)));
  }, []);

  // Global search with debounce
  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); setShowResults(false); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const q = search.trim();
      const [{ data: courses }, { data: products }, { data: promoCodes }] = await Promise.all([
        supabase.from("courses").select("id, title, category").ilike("title", `%${q}%`).limit(4),
        supabase.from("products").select("id, title, price").ilike("title", `%${q}%`).limit(4),
        supabase.from("coupons").select("id, code, discount_type, discount_value").ilike("code", `%${q}%`).limit(3),
      ]);
      const r: SearchResult[] = [
        ...(courses ?? []).map((c: any) => ({ type: "course" as const, id: c.id, title: c.title, sub: c.category, href: `/courses/${c.id}` })),
        ...(products ?? []).map((p: any) => ({ type: "product" as const, id: p.id, title: p.title, sub: `₹${p.price}`, href: `/products/${p.id}` })),
        ...(promoCodes ?? []).map((c: any) => ({ type: "coupon" as const, id: c.id, title: c.code, sub: c.discount_type === "flat" ? `₹${c.discount_value} off` : `${c.discount_value}% off`, href: `/coupons` })),
      ];
      setResults(r);
      setShowResults(true);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const ICONS: Record<string, typeof BookOpen> = { course: BookOpen, product: Package, order: ShoppingCart, coupon: Tag };
  const TYPE_COLORS: Record<string, string> = {
    course: "bg-blue-50 text-blue-600", product: "bg-emerald-50 text-emerald-600",
    order: "bg-purple-50 text-purple-600", coupon: "bg-pink-50 text-pink-600",
  };

  // Hold rendering until the admin check passes
  if (!accessChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-40 h-14 flex items-center justify-between border-b border-gray-200 bg-white px-6 gap-4">
          {/* Global Search */}
          <div className="relative flex-1 max-w-lg">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input ref={inputRef} type="text"
              placeholder="Search courses, products, coupons…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => search.trim().length >= 2 && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
              className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition placeholder:text-gray-400" />
            {search && (
              <button onClick={() => { setSearch(""); setResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
            {/* Results dropdown */}
            {showResults && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto">
                {searching ? (
                  <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400">No results for "{search}"</div>
                ) : results.map(r => {
                  const Icon = ICONS[r.type] ?? BookOpen;
                  return (
                    <button key={r.id} onClick={() => { router.push(r.href); setSearch(""); setShowResults(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 text-left transition">
                      <span className={`p-1.5 rounded-lg ${TYPE_COLORS[r.type]}`}><Icon size={13} /></span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{r.title}</p>
                        {r.sub && <p className="text-xs text-gray-400">{r.sub}</p>}
                      </div>
                      <span className="ml-auto text-[10px] text-gray-300 uppercase font-medium">{r.type}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/notifications")}
              className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition">
              <Bell size={18} />
              {notifCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white" />
              )}
            </button>

            <div className="h-6 w-px bg-gray-200 mx-1" />

            <button onClick={() => router.push("/profile")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 grid place-items-center text-white text-xs font-bold">
                {profile?.email?.[0]?.toUpperCase() ?? "A"}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-gray-900 leading-none">{profile?.email?.split("@")[0] ?? "Admin"}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Admin</p>
              </div>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-6 py-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
