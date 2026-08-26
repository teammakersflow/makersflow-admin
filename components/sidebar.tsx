"use client";

import { useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProfile } from "@/hooks/useProfile";
import {
  LayoutDashboard, BookOpen, Package, Newspaper, Bell,
  FolderOpen, Tag, ShoppingCart, CreditCard, GraduationCap,
  RefreshCw, BarChart3, Users, Settings, UserCircle2,
  LogOut, ChevronRight, Truck, Megaphone, Star, HelpCircle, Paperclip, StickyNote, Menu, X,
} from "lucide-react";
import { apiFetch, tokenStore } from "@/lib/api-client";
import { useRouter } from "next/navigation";

const NAV = [
  {
    group: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    group: "LMS",
    items: [
      { label: "Courses", href: "/courses", icon: BookOpen },
    ],
  },
  {
    group: "Store",
    items: [
      { label: "Products", href: "/products", icon: Package },
      { label: "Categories", href: "/categories", icon: FolderOpen },
    ],
  },
  {
    group: "Commerce",
    items: [
      { label: "Orders", href: "/orders", icon: ShoppingCart },
      { label: "Payments", href: "/payments", icon: CreditCard },
      { label: "Coupons", href: "/coupons", icon: Tag },
      { label: "LMS Purchases", href: "/lms-purchases", icon: GraduationCap },
      { label: "Refunds", href: "/refunds", icon: RefreshCw },
      { label: "Reports", href: "/reports", icon: BarChart3 },
      { label: "Shipping", href: "/shipping", icon: Truck },
    ],
  },
  {
    group: "Content",
    items: [
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "Promotions", href: "/promotions", icon: Megaphone },
      { label: "Reviews", href: "/reviews", icon: Star },
      { label: "Quizzes", href: "/quizzes", icon: HelpCircle },
      { label: "Resources", href: "/resources", icon: Paperclip },
      { label: "Lesson Notes", href: "/lesson-notes", icon: StickyNote },
      { label: "News", href: "/news", icon: Newspaper },
    ],
  },
  {
    group: "Users",
    items: [
      { label: "Users", href: "/users", icon: Users },
    ],
  },
  {
    group: "System",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Profile", href: "/profile", icon: UserCircle2 },
    ],
  },
];

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { profile } = useProfile();
  const router = useRouter();

  async function handleLogout() {
    try {
      // Best-effort: invalidates the refresh token server-side.
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // Ignore — still clear locally so the user is never stuck signed in.
    } finally {
      tokenStore.clear();
      router.replace("/login");
    }
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {/* Backdrop, only while the drawer is open on small screens */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Toggle. Fixed so it stays reachable; hidden once the sidebar is
          permanently visible at lg and above. */}
      <button
        onClick={() => setMobileOpen(o => !o)}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-[#0f1117] text-white shadow-lg">
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <aside className={`w-60 shrink-0 bg-[#0f1117] flex flex-col h-full
        fixed inset-y-0 left-0 z-40 transition-transform duration-200
        lg:static lg:translate-x-0
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
        <div className="h-8 w-8 rounded-lg bg-blue-500 grid place-items-center text-white font-bold text-sm shadow-lg shadow-blue-500/20">
          MF
        </div>
        <div>
          <p className="font-semibold text-white text-sm">MakersFlow</p>
          <p className="text-xs text-gray-500">Admin Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin">
        {NAV.map(({ group, items }) => (
          <div key={group}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
              {group}
            </p>
            <ul className="space-y-0.5">
              {items.map(({ label, href, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link href={href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group ${
                        active
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                      }`}>
                      <Icon size={16} className={active ? "text-blue-400" : "text-gray-500 group-hover:text-gray-300"} />
                      {label}
                      {active && <ChevronRight size={12} className="ml-auto text-blue-400/50" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/5 px-3 py-3">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 mb-2">
          <div className="h-7 w-7 rounded-full bg-blue-500 grid place-items-center text-white text-xs font-bold shrink-0">
            {profile?.email?.[0]?.toUpperCase() ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{profile?.email?.split("@")[0] ?? "Admin"}</p>
            <p className="text-[10px] text-gray-500">Administrator</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition text-sm">
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
    </>
  );
}
