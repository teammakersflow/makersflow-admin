/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Categories API — direct calls to the NestJS backend.
 *
 * Every function calls a named endpoint through `apiFetch`, which attaches
 * the JWT as `Authorization: Bearer <token>` and refreshes it once on a 401.
 * No query-builder, no table-name indirection.
 *
 * Endpoints:
 *   GET    /categories        list
 *   GET    /categories/:id    one
 *   POST   /categories        create
 *   PATCH  /categories/:id    update
 *   DELETE /categories/:id    delete
 *
 * Notes verified against the backend:
 *  - `categories.id` is a Prisma BigInt (autoincrement) and the controller
 *    does `BigInt(id)`, so ids arrive as numeric strings. They are kept as
 *    string|number here and only interpolated into the URL.
 *  - `CreateCategoryDto` accepts ONLY `name` and `slug`. The backend runs
 *    ValidationPipe with `forbidNonWhitelisted: true`, so sending anything
 *    else (e.g. `created_at`) returns 400. `toDtoPayload` enforces that.
 *  - There are NO Decimal columns on this table, so no numeric coercion is
 *    needed (unlike orders/products).
 */

import { apiFetch } from "./api-client";

export type ApiCategory = {
  id: string | number;
  name: string;
  slug: string;
  created_at: string | null;
};

export type CategoryPayload = {
  name?: string;
  slug?: string;
};

/** The only keys CreateCategoryDto / UpdateCategoryDto accept. */
const DTO_FIELDS = new Set(["name", "slug"]);

function toDtoPayload(payload: CategoryPayload): Record<string, any> {
  const accepted: Record<string, any> = {};
  const dropped: string[] = [];

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) return;
    if (DTO_FIELDS.has(key)) accepted[key] = value;
    else dropped.push(key);
  });

  if (dropped.length > 0) {
    console.warn(
      `[categories] Not sent (backend DTO accepts only name/slug): ${dropped.join(", ")}`
    );
  }
  return accepted;
}

/** GET /categories — sorted by name, since the endpoint has no sort param. */
export async function fetchCategories(): Promise<ApiCategory[]> {
  const data = await apiFetch<ApiCategory[]>("/categories");
  const list = Array.isArray(data) ? data : [];
  return list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/** GET /categories/:id — returns null when it doesn't exist (404). */
export async function fetchCategory(id: string | number): Promise<ApiCategory | null> {
  try {
    return await apiFetch<ApiCategory>(`/categories/${id}`);
  } catch (e: any) {
    if (e?.status === 404) return null;
    throw e;
  }
}

/** POST /categories */
export async function createCategory(payload: CategoryPayload): Promise<ApiCategory> {
  return apiFetch<ApiCategory>("/categories", {
    method: "POST",
    body: JSON.stringify(toDtoPayload(payload)),
  });
}

/** PATCH /categories/:id */
export async function updateCategory(
  id: string | number,
  payload: CategoryPayload
): Promise<ApiCategory> {
  return apiFetch<ApiCategory>(`/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(toDtoPayload(payload)),
  });
}

/** DELETE /categories/:id */
export async function deleteCategory(id: string | number): Promise<void> {
  await apiFetch(`/categories/${id}`, { method: "DELETE" });
}
