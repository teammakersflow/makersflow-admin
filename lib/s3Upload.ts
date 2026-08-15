/**
 * File uploads via the NestJS backend's presigned-URL endpoint.
 * Replaces the old Supabase Edge Functions (generate-upload-url /
 * delete-s3-file), which no longer exist.
 *
 * The backend returns `{ uploadUrl, key, publicUrl }` from
 * POST /storage/upload-url, and supports DELETE /storage/object?key=...
 *
 * NEXT_PUBLIC_S3_PUBLIC_BASE_URL is now only a fallback, used if the API
 * response has no publicUrl (i.e. an older backend build).
 */

import { API_URL, tokenStore } from "./api-client";

const PUBLIC_BASE = process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL;

/**
 * The backend only accepts these folder names (see CreateUploadUrlDto).
 * The app asks for 'news' and 'avatars' too, which the API would reject
 * with a validation error, so they are funnelled into 'uploads'.
 */
// The backend now accepts all of these directly.
type AppFolder = "courses" | "products" | "news" | "avatars" | "uploads";

export async function uploadToS3(file: File, folder: AppFolder): Promise<string> {
  const token = tokenStore.getAccessToken();
  if (!token) {
    throw new Error("Not signed in — please refresh the page and log in again.");
  }

  const res = await fetch(`${API_URL}/storage/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      folder,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 503) {
      throw new Error(
        "File storage is not configured on the server (missing AWS credentials). Ask the backend team to set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_S3_BUCKET."
      );
    }
    throw new Error(`Could not get an upload URL (${res.status}). ${detail.slice(0, 200)}`);
  }

  const payload = await res.json().catch(() => null);
  const uploadUrl: string | undefined = payload?.data?.uploadUrl;
  const key: string | undefined = payload?.data?.key;
  // The backend now returns the public URL, so the frontend no longer has to
  // reconstruct it from a separate env var.
  const publicUrl: string | undefined = payload?.data?.publicUrl;

  if (!uploadUrl || !key) {
    throw new Error("Upload service returned an invalid response (missing uploadUrl/key).");
  }

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error(`Upload to storage failed (${putRes.status}).`);
  }

  if (publicUrl) return publicUrl;

  // Fallback for an older backend that doesn't return publicUrl yet.
  if (!PUBLIC_BASE) {
    throw new Error(
      "The upload service did not return a public URL and NEXT_PUBLIC_S3_PUBLIC_BASE_URL is not set. Set one of them."
    );
  }
  return `${PUBLIC_BASE.replace(/\/$/, "")}/${key}`;
}

export function extractS3Key(publicUrl: string, folder: string): string | null {
  const marker = `/${folder}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + 1);
}

export async function deleteFromS3(key: string): Promise<void> {
  // DELETE /storage/object?key=... — the key contains slashes, so it is sent
  // as a query parameter rather than a path segment.
  const token = tokenStore.getAccessToken();
  if (!token) return;

  try {
    const res = await fetch(
      `${API_URL}/storage/object?key=${encodeURIComponent(key)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      // Non-fatal: the record is already updated; the object is just orphaned.
      console.warn(`Could not delete "${key}" from storage (${res.status}).`);
    }
  } catch (e) {
    console.warn(`Could not delete "${key}" from storage:`, e);
  }
}
