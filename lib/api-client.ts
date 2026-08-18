/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// `any` is deliberate here: this module wraps an untyped REST API whose
// responses vary per endpoint, and inventing precise types would be a
// fiction that the runtime does not guarantee. Callers narrow as needed.
/**
 * Shared client for the MakersFlow NestJS backend.
 * Replaces the old database client.
 *
 * Handles token storage, attaching the Authorization header, and silently
 * refreshing an expired access token once before giving up.
 *
 * Every backend response is wrapped as { success, message, data }.
 * `apiFetch` unwraps `data` for you and throws on failure.
 */

import { normalise } from "./normalise";

export const API_URL = process.env.NEXT_PUBLIC_API_URL;

const ACCESS_TOKEN_KEY = "mf_access_token";
const REFRESH_TOKEN_KEY = "mf_refresh_token";

export const tokenStore = {
  getAccessToken: () =>
    typeof window === "undefined" ? null : localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () =>
    typeof window === "undefined" ? null : localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      tokenStore.clear();
      return null;
    }
    const json = await res.json();
    const accessToken = json?.data?.accessToken;
    if (!accessToken) {
      tokenStore.clear();
      return null;
    }
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    return accessToken;
  } catch {
    return null;
  }
}

/**
 * Fetch wrapper for the backend. Returns the unwrapped `data` field.
 * On a 401, tries exactly one silent refresh-and-retry before throwing.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  _isRetry = false
): Promise<T> {
  const accessToken = tokenStore.getAccessToken();

  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && !_isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) return apiFetch<T>(path, options, true);
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty body (e.g. 204) */
  }

  if (!res.ok) {
    if (res.status === 401) tokenStore.clear();
    throw new ApiError(json?.message || res.statusText || "Request failed", res.status);
  }

  // Normalise dates and Decimal strings here so EVERY caller benefits.
  // Pages that call apiFetch directly (e.g. the dashboard) previously
  // skipped this and crashed on `created_at.slice is not a function`.
  const endpoint = "/" + path.replace(/^\//, "").split("?")[0].split("/")[0];
  return normalise(endpoint, json?.data) as T;
}

/** Same as apiFetch but also returns the `pagination` block when present. */
export async function apiFetchWithMeta<T = unknown>(
  path: string
): Promise<{ data: T; pagination?: { total: number; page: number; limit: number; totalPages: number } }> {
  const accessToken = tokenStore.getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(json?.message || res.statusText, res.status);
  const endpoint = "/" + path.replace(/^\//, "").split("?")[0].split("/")[0];
  return { data: normalise(endpoint, json?.data) as T, pagination: json?.pagination };
}
