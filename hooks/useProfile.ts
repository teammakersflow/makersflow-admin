"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

     console.log(data);
     console.log(error);
     
      if (!error && data) {
        setProfile(data);
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  return { profile, loading };
}