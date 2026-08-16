"use client";

/**
 * Was a Server Component using a the previous backend service-role key.
 *
 * The original query relied on a the previous backend embedded join
 * (`enrollments ... courses(id, title, price, is_free)`), which REST cannot
 * do. Courses are fetched separately and joined in memory below so
 * ReportsClient still receives the shape it expects.
 *
 * The `coupon_usage` query was already unused (its result was never read),
 * and that table has no backend endpoint, so it has been dropped entirely
 * rather than left as a failing request.
 */

import { useEffect, useState } from "react";
import { backendApi } from "@/lib/backend-api";
import ReportsClient, { OrderReportItem, EnrollmentReportItem } from "./ReportsClient";

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderReportItem[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentReportItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [ordersRes, enrollmentsRes, coursesRes] = await Promise.all([
          backendApi.endpoint("/orders").select("*").order("created_at", { ascending: false }),
          backendApi.endpoint("/enrollments").select("*").order("enrolled_at", { ascending: false }),
          backendApi.endpoint("/courses").select("id, title, price, is_free"),
        ]);

        if (cancelled) return;

        if (!ordersRes.error) {
          setOrders((ordersRes.data as OrderReportItem[]) ?? []);
        }

        if (!enrollmentsRes.error) {
          const courseMap = new Map<string, any>();
          (coursesRes.data ?? []).forEach((c: any) => courseMap.set(String(c.id), c));

          const joined = (enrollmentsRes.data ?? []).map((e: any) => ({
            ...e,
            courses: courseMap.get(String(e.course_id)) ?? null,
          }));
          setEnrollments(joined as unknown as EnrollmentReportItem[]);
        }
      } catch (err) {
        console.warn("Unexpected error fetching reports:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <ReportsClient orders={orders} enrollments={enrollments} />
    </div>
  );
}
