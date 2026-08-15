"use client";
import Link from "next/link";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string | React.ReactNode;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: number;      // % change, positive = up, negative = down
  href?: string;
  loading?: boolean;
}

export function StatCard({ label, value, sub, icon: Icon, iconColor = "text-blue-600", iconBg = "bg-blue-50", trend, href, loading }: StatCardProps) {
  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm animate-pulse">
      <div className="h-10 w-10 rounded-xl bg-gray-100 mb-4" />
      <div className="h-7 w-24 bg-gray-100 rounded mb-2" />
      <div className="h-4 w-32 bg-gray-100 rounded" />
    </div>
  );

  const inner = (
    <div className={`bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow group ${href ? "cursor-pointer" : ""}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${iconBg} group-hover:scale-110 transition-transform`}>
          <Icon size={20} className={iconColor} />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${trend >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-sm text-gray-500 mt-1 font-medium">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}
