"use client";

import { useEffect, useState } from "react";
import { formatDate, formatDateLong } from "@/lib/format";
import { useRouter, useParams } from "next/navigation";
import { backendApi } from "@/lib/backend-api";
import { ArrowLeft, Users, DollarSign, BookOpen, BarChart2, Edit, TrendingUp, Clock } from "lucide-react";

type Course = {
  id: string; title: string; description: string; category: string;
  level: string; price: number; gst_rate: number;
  is_free: boolean; is_published: boolean; created_at: string;
  thumbnail_url?: string | null; slug?: string | null;
};

type EnrollmentRow = {
  id: string;
  user_id: string;
  enrolled_at: string;
  payment_status: string;
  completed_at?: string | null;
  profiles?: { email: string; full_name: string | null } | null;
};

type Analytics = {
  totalEnrollments: number;    // ALL enrollments (any payment_status)
  paidEnrollments: number;     // payment_status = 'completed' only
  freeEnrollments: number;     // free course enrollments
  completedCount: number;      // students who finished (completed_at set)
  completionRate: number;      // % of paid students who finished
  revenue: number;
  recentEnrollments: EnrollmentRow[];
};

export default function ViewCoursePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [course, setCourse] = useState<Course | null>(null);
  const [analytics, setAnalytics] = useState<Analytics>({
    totalEnrollments: 0, paidEnrollments: 0, freeEnrollments: 0,
    completedCount: 0, completionRate: 0, revenue: 0, recentEnrollments: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      const [
        { data: courseData },
        { data: allEnrollments },
        { data: purchases },
        { data: recentEnroll },
      ] = await Promise.all([
        backendApi.endpoint("/courses").select("*").eq("id", id).maybeSingle(),

        // All enrollments for this course (to show real total)
        backendApi
          .endpoint("/enrollments")
          .select("id, enrolled_at, payment_status, completed_at")
          .eq("course_id", id),

        // Paid purchases for revenue
        backendApi
          .endpoint("/course-purchases")
          .select("amount_paid")
          .eq("course_id", id)
          .eq("status", "active"),

        // Recent PAID enrollments — get enrollment rows first
        backendApi
          .endpoint("/enrollments")
          .select("id, user_id, enrolled_at, payment_status, completed_at")
          .eq("course_id", id)
          .eq("payment_status", "completed")
          .order("enrolled_at", { ascending: false })
          .limit(20),
      ]);

      if (courseData) setCourse(courseData as Course);

      const enrollList = (allEnrollments ?? []) as EnrollmentRow[];
      const paid = enrollList.filter(e => e.payment_status === "completed");
      const free = enrollList.filter(
        e => e.payment_status !== "completed" && (courseData as any)?.is_free
      );

      // Revenue: course_purchases if populated, else fallback to paid enrollments × price
      let revenue = (purchases ?? []).reduce((s: number, p: any) => s + (p.amount_paid ?? 0), 0);
      if (revenue === 0 && !(courseData as any)?.is_free) {
        revenue = paid.length * ((courseData as any)?.price ?? 0);
      }

      // Completion rate from ALL paid enrollments (not just recent 10)
      const completedEnrolls = paid.filter((e: any) => e.completed_at !== null && e.completed_at !== undefined);
      const completionRate = paid.length > 0 ? Math.round((completedEnrolls.length / paid.length) * 100) : 0;

      // Enrich enrollments with profile data (separate query avoids FK/RLS issues)
      let enrichedEnrollments: EnrollmentRow[] = (recentEnroll ?? []) as unknown as EnrollmentRow[];
      const userIds = (recentEnroll ?? []).map((e: any) => e.user_id).filter(Boolean);
      if (userIds.length > 0) {
        const { data: profilesData } = await backendApi
          .endpoint("/users")
          .select("id, email, full_name")
          .in("id", userIds);
        const profileMap: Record<string, { email: string; full_name: string | null }> = {};
        (profilesData ?? []).forEach((p: any) => { profileMap[p.id] = p; });
        enrichedEnrollments = (recentEnroll ?? []).map((e: any) => ({
          ...e,
          profiles: profileMap[e.user_id] ?? null,
        })) as EnrollmentRow[];
      }

      setAnalytics({
        totalEnrollments: enrollList.length,
        paidEnrollments: paid.length,
        freeEnrollments: free.length,
        completedCount: completedEnrolls.length,
        completionRate,
        revenue,
        recentEnrollments: enrichedEnrollments,
      });
      setLoading(false);
    }
    fetchAll();
  }, [id]);

  if (loading) return <div className="p-6 text-gray-400 animate-pulse">Loading course...</div>;
  if (!course) return <div className="p-6 text-red-500">Course not found.</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => router.push("/courses")}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition">
        <ArrowLeft size={18} /> Back to Courses
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {course.thumbnail_url && (
          <img src={course.thumbnail_url} alt={course.title}
            className="w-full h-48 object-cover" />
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">{course.category || "Uncategorized"}</span>
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full capitalize">{course.level}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${course.is_published ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {course.is_published ? "Published" : "Draft"}
                </span>
                {course.is_free && (
                  <span className="text-xs px-2 py-1 rounded-full font-medium bg-teal-100 text-teal-700">Free Course</span>
                )}
              </div>
            </div>
            <button onClick={() => router.push(`/courses/${id}/edit`)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium shrink-0">
              <Edit size={16} /> Edit Course
            </button>
          </div>

          {course.description && (
            <p className="mt-4 text-sm text-gray-600 leading-relaxed">{course.description}</p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-gray-100 text-sm">
            <div><p className="text-gray-400">Price</p><p className="font-semibold text-green-600 mt-0.5">{course.is_free ? "Free" : `₹${course.price}`}</p></div>
            <div><p className="text-gray-400">GST Rate</p><p className="font-semibold text-gray-900 mt-0.5">{course.gst_rate ?? 18}%</p></div>
            <div><p className="text-gray-400">Created</p><p className="font-semibold text-gray-900 mt-0.5">{formatDate(course.created_at)}</p></div>
            {course.slug && <div><p className="text-gray-400">Slug</p><p className="font-mono text-xs text-gray-600 mt-0.5 truncate">{course.slug}</p></div>}
          </div>
        </div>
      </div>

      {/* Analytics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><BarChart2 size={20} />Analytics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Total Enrollments",
              value: analytics.totalEnrollments,
              sub: "All statuses",
              icon: Users,
              color: "text-blue-600",
              bg: "bg-blue-50"
            },
            {
              label: "Paid Enrollments",
              value: analytics.paidEnrollments,
              sub: "Payment completed",
              icon: TrendingUp,
              color: "text-green-600",
              bg: "bg-green-50"
            },
            {
              label: "Pending / Other",
              value: analytics.totalEnrollments - analytics.paidEnrollments,
              sub: "Not yet paid",
              icon: Clock,
              color: "text-amber-600",
              bg: "bg-amber-50"
            },
            {
              label: "Revenue Generated",
              value: `₹${analytics.revenue.toLocaleString()}`,
              sub: "From paid purchases",
              icon: DollarSign,
              color: "text-purple-600",
              bg: "bg-purple-50"
            },
            {
              label: "Completion Rate",
              value: `${analytics.completionRate}%`,
              sub: `${analytics.completedCount} students finished`,
              icon: TrendingUp,
              color: "text-teal-600",
              bg: "bg-teal-50"
            },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className={`inline-flex p-2 rounded-lg ${s.bg} mb-3`}><Icon size={18} className={s.color} /></div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent PAID Enrollments */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Paid Enrollments</h2>
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
            {analytics.paidEnrollments} total paid
          </span>
        </div>
        {analytics.recentEnrollments.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <BookOpen size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500 font-medium">No paid enrollments yet</p>
            <p className="text-xs text-gray-400 mt-1">Enrollments appear here once payment is completed</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Student</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Enrolled</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Completed</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Progress</th>
              </tr>
            </thead>
            <tbody>
              {analytics.recentEnrollments.map(e => {
                const isCompleted = !!(e as any).completed_at;
                return (
                <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
                        {((e.profiles as any)?.full_name?.[0] ?? (e.profiles as any)?.email?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{(e.profiles as any)?.full_name ?? "Unknown"}</p>
                        <p className="text-xs text-gray-400">{(e.profiles as any)?.email ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-sm text-gray-500">
                    {formatDateLong(e.enrolled_at)}
                  </td>
                  <td className="px-6 py-3.5">
                    {isCompleted ? (
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          ✓ Completed
                        </span>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date((e as any).completed_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}
                        </p>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                        In Progress
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="w-24 bg-gray-100 rounded-full h-2">
                      <div className={`h-full rounded-full ${isCompleted ? "bg-green-500" : "bg-blue-500"}`}
                        style={{ width: isCompleted ? "100%" : "50%" }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{isCompleted ? "100%" : "In progress"}</p>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
