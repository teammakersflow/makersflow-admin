import { createClient } from "@supabase/supabase-js";
import PromoCodesClient, { PromoCode } from "./PromoCodesClient";

function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export const revalidate = 0;

export default async function PromoCodesPage() {
  let promoCodes: PromoCode[] = [];
  let courses: Array<{ id: string; title: string }> = [];
  let products: Array<{ id: string; title: string }> = [];

  try {
    const supabaseServer = createServerClient();
    const [promoCodesRes, coursesRes, productsRes] = await Promise.all([
      supabaseServer.from("promo_codes").select("*").order("created_at", { ascending: false }),
      supabaseServer.from("courses").select("id, title").eq("is_published", true),
      supabaseServer.from("products").select("id, title"),
    ]);

    if (!promoCodesRes.error) {
      promoCodes = (promoCodesRes.data as PromoCode[]) ?? [];
    }

    if (coursesRes.data) {
      // FIX: Deduplicate courses by title — keep only first occurrence of each title
      const seenTitles = new Set<string>();
      courses = coursesRes.data.filter((c: { id: string; title: string }) => {
        const key = c.title.trim().toLowerCase();
        if (seenTitles.has(key)) return false;
        seenTitles.add(key);
        return true;
      });
    }

    if (productsRes.data) {
      // FIX: Deduplicate products by title — keep only first occurrence of each title
      const seenTitles = new Set<string>();
      products = productsRes.data.filter((p: { id: string; title: string }) => {
        const key = p.title.trim().toLowerCase();
        if (seenTitles.has(key)) return false;
        seenTitles.add(key);
        return true;
      });
    }
  } catch (err) {
    console.warn("Unexpected error fetching promo codes data:", err);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PromoCodesClient initialPromoCodes={promoCodes} courses={courses} products={products} />
    </div>
  );
}
