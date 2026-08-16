"use client";

/**
 * Was a Server Component using a the previous backend service-role key.
 *
 * The embedded join `enrollments ... courses(...)` is done in memory here
 * instead, since REST cannot join. The `course_purchases` query was already
 * unused (its result was never read) and that table has no backend
 * endpoint, so it has been removed rather than left failing.
 */

import { useEffect, useState } from "react";
import { backendApi } from "@/lib/backend-api";
import LMSPurchasesClient, { Enrollment } from "./LMSPurchasesClient";

export default function LMSPurchasesPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let result: Enrollment[] = [];
      try {
        const [enrollmentsRes, profilesRes, coursesRes] = await Promise.all([
          backendApi.endpoint("/enrollments").select("*").order("enrolled_at", { ascending: false }),
          backendApi.endpoint("/users").select("id, email, full_name"),
          backendApi.endpoint("/courses").select("id, title, price, is_free"),
        ]);

        if (enrollmentsRes.error) {
          console.warn("Failed to query enrollments for LMS purchases:", enrollmentsRes.error.message);
        } else {
          const rawEnrollments = enrollmentsRes.data ?? [];

          const profilesMap = new Map<string, { email: string; full_name: string | null }>();
          if (profilesRes.data) {
            profilesRes.data.forEach((p: any) => {
              profilesMap.set(p.id, { email: p.email || "", full_name: p.full_name || null });
            });
          }

          const courseMap = new Map<string, any>();
          (coursesRes.data ?? []).forEach((c: any) => courseMap.set(String(c.id), c));

          result = rawEnrollments.map((e: any) => ({
            id: e.id,
            user_id: e.user_id,
            course_id: e.course_id,
            enrolled_at: e.enrolled_at,
            completed_at: e.completed_at,
            payment_status: e.payment_status,
            razorpay_order_id: e.razorpay_order_id,
            expires_at: e.expires_at,
            courses: courseMap.get(String(e.course_id)) ?? null,
            profiles: profilesMap.get(e.user_id) || null,
          }));
        }
      } catch (err) {
        console.warn("Unexpected error fetching LMS purchases:", err);
      }
      if (!cancelled) setEnrollments(result);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (enrollments === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <LMSPurchasesClient initialEnrollments={enrollments} />
    </div>
  );
}
