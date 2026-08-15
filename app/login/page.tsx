"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tokenStore, ApiError } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Minimal shape of what the Google Identity Services script puts on window.
// Loaded via <script src="https://accounts.google.com/gsi/client">.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogleCredential(idToken: string) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const json = await res.json();
      if (!res.ok || !json?.data) {
        throw new ApiError(json?.message || "Google sign-in failed", res.status);
      }
      const { accessToken, refreshToken, user } = json.data;
      if (user?.role !== "admin") {
        setError("This account does not have admin access.");
        setLoading(false);
        return;
      }
      tokenStore.setTokens(accessToken, refreshToken);
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set.");
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => handleGoogleCredential(response.credential),
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "filled_blue",
        size: "large",
        width: 320,
        text: "signin_with",
      });
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#0f1117] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-blue-600 to-indigo-700 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="h-9 w-9 rounded-xl bg-white/20 grid place-items-center text-white font-bold text-sm backdrop-blur-sm">MF</div>
            <span className="text-white font-bold text-lg">MakersFlow</span>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight">
            Everything you need<br/>to run your platform
          </h2>
          <p className="text-blue-100 mt-4 text-lg leading-relaxed">
            Manage courses, products, payments and students from one powerful dashboard.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4">
            {[
              { label: "Courses", val: "50+" }, { label: "Students", val: "1200+" },
              { label: "Products", val: "30+" }, { label: "Revenue", val: "₹5L+" },
            ].map(s => (
              <div key={s.label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                <p className="text-2xl font-bold text-white">{s.val}</p>
                <p className="text-blue-200 text-sm mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute top-20 -right-10 h-48 w-48 rounded-full bg-white/5" />
        <p className="relative z-10 text-blue-200 text-xs">© 2026 MakersFlow. All rights reserved.</p>
      </div>

      {/* Right panel — login */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="h-8 w-8 rounded-lg bg-blue-500 grid place-items-center text-white font-bold text-sm">MF</div>
            <span className="text-white font-bold">MakersFlow Admin</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-gray-400 text-sm mb-8">Sign in with your admin Google account</p>

          <div className="space-y-4">
            {/* Google renders its own button into this div */}
            <div ref={buttonRef} className="flex justify-center" />

            {loading && (
              <div className="flex justify-center">
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
