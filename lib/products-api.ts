/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Products API — direct calls to the NestJS backend.
 *
 * Every function here calls a named endpoint through `apiFetch`, which
 * attaches the JWT as `Authorization: Bearer <token>` and refreshes it once
 * on a 401. There is no query-builder and no table-name indirection.
 *
 * Endpoints (POST/PATCH/DELETE are admin-guarded on the backend):
 *   GET    /products        list
 *   GET    /products/:id    one
 *   POST   /products        create
 *   PATCH  /products/:id    update
 *   DELETE /products/:id    delete
 */

import { apiFetch } from "./api-client";



export type ApiProduct = {
  id: string | number;
  title: string;
  slug: string;
  description: string | null;
  price: number;
  original_price: number | null;
  category: string | null;
  subcategory: string | null;
  thumbnail_url: string | null;
  images: string[] | null;
  videos: string[] | null;
  features: string[] | null;
  in_stock: boolean | null;
  stock: number | null;
  stock_quantity: number | null;
  status: string | null;
  is_course: boolean | null;
  course_id: number | null;
  gst_rate: number | null;
  weight_kg: number | null;
  hsn_code: string | null;
  created_at: string;
};

/**
 * Fields accepted by CreateProductDto / UpdateProductDto on the backend.
 *
 * ⚠️ The backend runs ValidationPipe with `forbidNonWhitelisted: true`, so
 * sending ANY key not listed here fails the whole request with 400.
 *
 * `gst_rate`, `weight_kg`, `hsn_code` and `stock_quantity` are now accepted
 * by the backend DTO and are sent normally. `toDtoPayload()` still guards
 * against any OTHER unknown key, because the backend rejects unknown fields
 * (forbidNonWhitelisted) with a 400.
 */
export type ProductPayload = {
  title?: string;
  slug?: string;
  description?: string | null;
  price?: number;
  original_price?: number;
  category?: string;
  subcategory?: string;
  thumbnail_url?: string;
  images?: string[];
  videos?: string[];
  features?: string[];
  in_stock?: boolean;
  stock?: number;
  status?: string;
  is_course?: boolean;
  course_id?: number;
  // Not yet accepted by the backend DTO — see note above.
  gst_rate?: number;
  weight_kg?: number;
  hsn_code?: string;
  stock_quantity?: number;
};

/** Keys CreateProductDto/UpdateProductDto actually accept today. */
const DTO_FIELDS = new Set([
  "title", "slug", "description", "price", "original_price", "category",
  "subcategory", "thumbnail_url", "images", "videos", "features",
  "in_stock", "stock", "status", "is_course", "course_id",
  // Added to CreateProductDto/UpdateProductDto by the backend, so these are
  // now sent and saved correctly (GST rate, weight, HSN code, stock qty).
  "gst_rate", "stock_quantity", "weight_kg", "hsn_code",
]);

/**
 * Drop keys the backend DTO does not declare, so a request never 400s over
 * a field the API simply hasn't added yet. Warns loudly so the dropped data
 * is visible rather than silently lost.
 */
export function toDtoPayload(payload: ProductPayload): Record<string, any> {
  const accepted: Record<string, any> = {};
  const dropped: string[] = [];

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) return;
    if (DTO_FIELDS.has(key)) accepted[key] = value;
    else dropped.push(key);
  });

  if (dropped.length > 0) {
    console.warn(
      `[products] These fields were not sent because the backend DTO does not accept them yet: ${dropped.join(", ")}. ` +
      `If a field belongs in the product record, ask the backend team to add it to CreateProductDto/UpdateProductDto.`
    );
  }
  return accepted;
}

/** GET /products */
export async function fetchProducts(): Promise<ApiProduct[]> {
  const data = await apiFetch<ApiProduct[]>("/products");
  // apiFetch already normalises dates and Decimal strings.
  const list = Array.isArray(data) ? data : [];
  // The endpoint has no sort parameter, so order newest-first here.
  return list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

/**
 * GET /products?search=&limit= — server-side search (title or description,
 * case-insensitive), newest first. Used by pickers that must reach the whole
 * catalogue: plain `GET /products` returns only the first page (10 rows).
 * An empty `search` returns the newest products.
 */
export async function searchProducts(
  search: string,
  limit = 50,
  signal?: AbortSignal
): Promise<ApiProduct[]> {
  const params = new URLSearchParams({ page: "1", limit: String(limit) });
  const term = search.trim();
  if (term) params.set("search", term);
  const data = await apiFetch<ApiProduct[]>(`/products?${params.toString()}`, { signal });
  return Array.isArray(data) ? data : [];
}

/** GET /products/:id — returns null when it doesn't exist (404). */
export async function fetchProduct(id: string | number): Promise<ApiProduct | null> {
  try {
    return await apiFetch<ApiProduct>(`/products/${id}`);
  } catch (e: any) {
    if (e?.status === 404) return null;
    throw e;
  }
}

/** POST /products (admin only) */
export async function createProduct(payload: ProductPayload): Promise<ApiProduct> {
  return apiFetch<ApiProduct>("/products", {
    method: "POST",
    body: JSON.stringify(toDtoPayload(payload)),
  });
}

/** PATCH /products/:id (admin only) */
export async function updateProduct(
  id: string | number,
  payload: ProductPayload
): Promise<ApiProduct> {
  return apiFetch<ApiProduct>(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(toDtoPayload(payload)),
  });
}

/** DELETE /products/:id (admin only) */
export async function deleteProduct(id: string | number): Promise<void> {
  await apiFetch(`/products/${id}`, { method: "DELETE" });
}
