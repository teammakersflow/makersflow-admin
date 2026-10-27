/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Kits API: admin kit management + course-kit association.
 *
 *   GET    /kits                     list (admin)
 *   GET    /kits/:id                 one (admin)
 *   POST   /kits                     create (admin)
 *   PATCH  /kits/:id                 update; `items` replaces the whole list (admin)
 *   DELETE /kits/:id                 delete; refused once users have claimed it (admin)
 *   PUT    /kits/course/:courseId    attach { kit_id } or detach { kit_id: null } (admin)
 *   GET    /kits/course/:courseId    public course-page view
 */

import { apiFetch } from "./api-client";

export type KitProduct = {
  id: string;
  title: string;
  slug: string;
  price: number | string | null;
  thumbnail_url: string | null;
  images: string[] | null;
  in_stock: boolean | null;
  stock: number | null;
  status: string | null;
};

export type ApiKit = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "inactive" | string;
  created_at: string;
  kit_items: { id: string; product_id: string; quantity: number; products: KitProduct }[];
  courses?: { id: string; title: string }[];
};

export type KitItemInput = { product_id: string; quantity: number };

export type KitPayload = {
  name?: string;
  description?: string;
  status?: "active" | "inactive";
  items?: KitItemInput[];
};

export type CourseKitView = {
  course_id: string;
  kit: null | {
    id: string;
    name: string;
    description: string | null;
    items: { product_id: string; title: string; slug: string; quantity: number; price: any; image: string | null; available: boolean }[];
    all_available: boolean;
  };
  kit_included?: boolean;
  kit_purchase_required?: boolean;
  label?: string;
};

// Only send keys the backend DTO accepts (forbidNonWhitelisted)
function clean(p: KitPayload): KitPayload {
  const out: KitPayload = {};
  if (p.name !== undefined) out.name = p.name.trim();
  if (p.description !== undefined && p.description.trim() !== "") out.description = p.description.trim();
  if (p.status !== undefined) out.status = p.status;
  if (p.items !== undefined) {
    out.items = p.items.map((i) => ({ product_id: String(i.product_id), quantity: Number(i.quantity) }));
  }
  return out;
}

const json = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const listKits = () => apiFetch<ApiKit[]>("/kits");
export const getKit = (id: string) => apiFetch<ApiKit>(`/kits/${id}`);
export const createKit = (p: KitPayload) => apiFetch<ApiKit>("/kits", json("POST", clean(p)));
export const updateKit = (id: string, p: KitPayload) => apiFetch<ApiKit>(`/kits/${id}`, json("PATCH", clean(p)));
export const deleteKit = (id: string) => apiFetch<{ deleted: boolean }>(`/kits/${id}`, { method: "DELETE" });

export const getCourseKit = (courseId: string | number) =>
  apiFetch<CourseKitView>(`/kits/course/${courseId}`);
export const setCourseKit = (courseId: string | number, kitId: string | null) =>
  apiFetch<CourseKitView>(`/kits/course/${courseId}`, json("PUT", { kit_id: kitId }));
