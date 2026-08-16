"use client";

/**
 * Was a Server Component using a the previous backend service-role key.
 *
 * HEADS UP: the `promo_codes` table has NO endpoint on the NestJS backend
 * (only `coupons` does — a different table). So the promo code list will
 * come back empty with an error logged until that module is built. The
 * course/product dropdowns below still populate normally.
 */

import { useEffect, useState } from "react";
import { backendApi } from "@/lib/backend-api";
import PromoCodesClient, { PromoCode } from "./PromoCodesClient";

export default function PromoCodesPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [promoCodesRes, coursesRes, productsRes] = await Promise.all([
          backendApi.endpoint("/promo-codes").select("*").order("created_at", { ascending: false }),
          backendApi.endpoint("/courses").select("id, title").eq("is_published", true),
          backendApi.endpoint("/products").select("id, title"),
        ]);

        if (cancelled) return;

        if (promoCodesRes.error) {
          console.warn("Promo codes unavailable:", promoCodesRes.error.message);
          setLoadError(promoCodesRes.error.message);
        } else {
          setPromoCodes((promoCodesRes.data as PromoCode[]) ?? []);
        }

        if (coursesRes.data) {
          // Deduplicate courses by title — keep first occurrence of each.
          const seenTitles = new Set<string>();
          setCourses(
            coursesRes.data.filter((c: { id: string; title: string }) => {
              const key = String(c.title).trim().toLowerCase();
              if (seenTitles.has(key)) return false;
              seenTitles.add(key);
              return true;
            })
          );
        }

        if (productsRes.data) {
          // Deduplicate products by title — keep first occurrence of each.
          const seenTitles = new Set<string>();
          setProducts(
            productsRes.data.filter((p: { id: string; title: string }) => {
              const key = String(p.title).trim().toLowerCase();
              if (seenTitles.has(key)) return false;
              seenTitles.add(key);
              return true;
            })
          );
        }
      } catch (err) {
        console.warn("Unexpected error fetching promo codes data:", err);
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
      <PromoCodesClient initialPromoCodes={promoCodes} courses={courses} products={products} loadError={loadError} />
    </div>
  );
}
