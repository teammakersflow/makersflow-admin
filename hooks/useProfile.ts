"use client";

import { useEffect, useState } from "react";
import { apiFetch, tokenStore } from "@/lib/api-client";

type Profile = {
  id: string;
  email: string;
  role: string;
  avatar_url?: string | null;
};

export function useProfile() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!tokenStore.getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        // GET /auth/me returns { success, message, data: <AuthenticatedUser> }
        const user = await apiFetch<Profile>("/auth/me");
        setProfile(user);
      } catch {
        // Token invalid/expired past the point apiFetch could refresh it —
        // leave profile null, the dashboard layout's own check will redirect.
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  return { profile, loading };
}
