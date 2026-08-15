import { createClient } from "@supabase/supabase-js";
import LMSPurchasesClient, { Enrollment } from "./LMSPurchasesClient";

function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export const revalidate = 0;

export default async function LMSPurchasesPage() {
  let enrollments: Enrollment[] = [];

  try {
    const supabaseServer = createServerClient();

    const [enrollmentsRes, profilesRes, coursePurchasesRes] = await Promise.all([
      supabaseServer
        .from("enrollments")
        .select(`
          id, user_id, course_id, enrolled_at, completed_at,
          payment_status, razorpay_order_id, expires_at,
          courses(id, title, price, is_free)
        `)
        .order("enrolled_at", { ascending: false }),
      supabaseServer.from("profiles").select("id, email, full_name"),
      // Also fetch course_purchases for additional revenue data
      supabaseServer
        .from("course_purchases")
        .select("id, user_id, course_id, amount_paid, status, created_at")
        .eq("status", "active")
    ]);

    if (!enrollmentsRes.error) {
      const rawEnrollments = enrollmentsRes.data ?? [];
      const profilesMap = new Map<string, { email: string; full_name: string | null }>();
      if (profilesRes.data) {
        profilesRes.data.forEach((p: any) => {
          profilesMap.set(p.id, { email: p.email || "", full_name: p.full_name || null });
        });
      }

      enrollments = rawEnrollments.map((e: any) => ({
        id: e.id,
        user_id: e.user_id,
        course_id: e.course_id,
        enrolled_at: e.enrolled_at,
        completed_at: e.completed_at,
        payment_status: e.payment_status,
        razorpay_order_id: e.razorpay_order_id,
        expires_at: e.expires_at,
        courses: e.courses,
        profiles: profilesMap.get(e.user_id) || null
      }));
    } else {
      console.warn("Failed to query enrollments for LMS purchases:", enrollmentsRes.error.message);
    }
  } catch (err) {
    console.warn("Unexpected error fetching LMS purchases:", err);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <LMSPurchasesClient initialEnrollments={enrollments} />
    </div>
  );
}
