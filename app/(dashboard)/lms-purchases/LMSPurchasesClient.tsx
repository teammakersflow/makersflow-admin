"use client";

import { useState } from "react";
import { formatDate, formatDateLong } from "@/lib/format";
import { Search, GraduationCap, Calendar, DollarSign, BookOpen, Clock, Download, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export type Enrollment = {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  completed_at: string | null;
  payment_status: string;
  razorpay_order_id: string | null;
  expires_at?: string | null;
  courses: {
    id: string; title: string; price: number; is_free: boolean;
  } | null;
  profiles: {
    email: string; full_name: string | null;
  } | null;
};

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  pending:   "bg-amber-100 text-amber-800",
  failed:    "bg-red-100 text-red-800",
};

interface LMSPurchasesClientProps {
  initialEnrollments: Enrollment[];
}

export default function LMSPurchasesClient({ initialEnrollments }: LMSPurchasesClientProps) {
  const [enrollments] = useState<Enrollment[]>(initialEnrollments);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");

  // Get unique courses for filter.
  // The tuple annotation is required: without it TypeScript widens the mapped
  // value to string[][], which the Map constructor rejects.
  const uniqueCourses = Array.from(
    new Map(
      enrollments
        .map((e): [string, string] => [e.course_id, e.courses?.title ?? "Unknown"])
        .filter(([id]) => id)
    ).entries()
  );

  const filtered = enrollments.filter(e => {
    const matchStatus = statusFilter === "all" || e.payment_status === statusFilter;
    const matchCourse = courseFilter === "all" || e.course_id === courseFilter;
    const matchSearch = !search ||
      (e.profiles?.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.profiles?.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.courses?.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.razorpay_order_id ?? "").toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchCourse && matchSearch;
  });

  // Metrics — only count paid enrollments for revenue
  const completedPaidEnrollments = enrollments.filter(
    e => e.payment_status === "completed" && e.courses && !e.courses.is_free
  );
  const totalLMSRevenue = completedPaidEnrollments.reduce((sum, e) => sum + (e.courses?.price ?? 0), 0);
  const totalEnrollments = enrollments.length;
  const completedCount = enrollments.filter(e => e.payment_status === "completed").length;
  const pendingCount = enrollments.filter(e => e.payment_status === "pending").length;
  const failedCount = enrollments.filter(e => e.payment_status === "failed").length;

  // Check for expired access
  const now = new Date();
  const expiredCount = enrollments.filter(
    e => e.expires_at && new Date(e.expires_at) < now && e.payment_status === "completed"
  ).length;

  const exportCSV = () => {
    const rows = [["Student Name", "Email", "Course", "Price", "Status", "Enrolled At", "Completed At", "Expires At"]];
    filtered.forEach(e => rows.push([
      e.profiles?.full_name ?? "",
      e.profiles?.email ?? e.user_id.slice(0, 8),
      e.courses?.title ?? "",
      e.courses?.is_free ? "Free" : String(e.courses?.price ?? 0),
      e.payment_status,
      formatDate(e.enrolled_at),
      e.completed_at ? formatDate(e.completed_at) : "",
      e.expires_at ? formatDate(e.expires_at) : "",
    ]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `lms_purchases_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">LMS Purchases</h1>
          <p className="text-sm text-gray-500 mt-1">All student course enrollments and payment status</p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Enrollments", value: totalEnrollments, icon: GraduationCap, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Completed (Paid)", value: completedCount, icon: BookOpen, color: "text-green-600", bg: "bg-green-50" },
          { label: "Pending Payment", value: pendingCount, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Failed", value: failedCount, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
          { label: "LMS Revenue", value: `₹${totalLMSRevenue.toLocaleString()}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs">
              <div className={`inline-flex p-2.5 rounded-lg ${s.bg} mb-3`}><Icon size={18} className={s.color} /></div>
              <p className="text-xs text-gray-500 font-semibold">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Expired access alert */}
      {expiredCount > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-900 font-semibold">
            {expiredCount} enrollment{expiredCount > 1 ? "s have" : " has"} expired access — students may need to renew
          </p>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search student, email, course, order ID..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 w-80 bg-white shadow-2xs" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white">
          <option value="all">All Payment Status</option>
          <option value="completed">✓ Completed</option>
          <option value="pending">⏳ Pending</option>
          <option value="failed">✗ Failed</option>
        </select>
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white max-w-[200px]">
          <option value="all">All Courses</option>
          {uniqueCourses.map(([id, title]) => (
            <option key={id} value={id}>{title}</option>
          ))}
        </select>
        {(search || statusFilter !== "all" || courseFilter !== "all") && (
          <button onClick={() => { setSearch(""); setStatusFilter("all"); setCourseFilter("all"); }}
            className="text-sm text-red-500 hover:text-red-700">Clear filters</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase text-xs">
              <tr>
                <th className="text-left px-6 py-3.5">Student</th>
                <th className="text-left px-6 py-3.5">Course</th>
                <th className="text-left px-6 py-3.5">Price</th>
                <th className="text-left px-6 py-3.5">Payment Status</th>
                <th className="text-left px-6 py-3.5">Enrolled At</th>
                <th className="text-left px-6 py-3.5">Access Expires</th>
                <th className="text-left px-6 py-3.5">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <GraduationCap className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <p className="font-semibold text-gray-600">No LMS purchases found</p>
                    <p className="text-xs mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                filtered.map(e => {
                  const isExpired = e.expires_at && new Date(e.expires_at) < now;
                  return (
                    <tr key={e.id} className={`hover:bg-gray-50/50 transition-colors ${isExpired ? "bg-red-50/5" : ""}`}>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{e.profiles?.full_name ?? "—"}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{e.profiles?.email ?? e.user_id.slice(0, 8)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-gray-800 line-clamp-1">
                          {e.courses?.title ?? "Unknown Course"}
                        </p>
                        {e.razorpay_order_id && (
                          <p className="text-[10px] text-gray-400 mt-0.5 font-mono">Order: {e.razorpay_order_id}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {e.courses?.is_free ? (
                          <span className="text-green-600 text-xs bg-green-50 px-1.5 py-0.5 rounded font-bold border border-green-100">Free</span>
                        ) : (
                          `₹${(e.courses?.price ?? 0).toLocaleString()}`
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                          STATUS_COLORS[e.payment_status] ?? "bg-gray-100 text-gray-700"
                        }`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {e.payment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-gray-400" />
                          {formatDateLong(e.enrolled_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium">
                        {e.expires_at ? (
                          <div className={`flex items-center gap-1.5 ${isExpired ? "text-red-600" : "text-gray-600"}`}>
                            <Clock size={13} className="shrink-0" />
                            {formatDateLong(e.expires_at)}
                            {isExpired && <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1 rounded">EXPIRED</span>}
                          </div>
                        ) : (
                          <span className="text-gray-400">No expiry</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600 font-medium">
                        {e.completed_at ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-gray-400" />
                            {formatDateLong(e.completed_at)}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">In progress</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 text-xs font-semibold text-gray-500 bg-gray-50/50">
            Showing {filtered.length} of {enrollments.length} enrollments
          </div>
        )}
      </div>
    </div>
  );
}
