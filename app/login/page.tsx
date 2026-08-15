"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    setError(""); setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) { setError(authError.message); return; }
    router.replace("/dashboard");
  }

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
        {/* Decorative blobs */}
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute top-20 -right-10 h-48 w-48 rounded-full bg-white/5" />
        <p className="relative z-10 text-blue-200 text-xs">© 2026 MakersFlow. All rights reserved.</p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="h-8 w-8 rounded-lg bg-blue-500 grid place-items-center text-white font-bold text-sm">MF</div>
            <span className="text-white font-bold">MakersFlow Admin</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-gray-400 text-sm mb-8">Sign in to your admin account</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input type="email" placeholder="admin@makersflow.com" value={email} autoComplete="email" name="email"
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} autoComplete="current-password" name="password"
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-11 text-white text-sm placeholder:text-gray-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition" />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button onClick={handleLogin} disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-lg shadow-blue-600/20">
              {loading ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><LogIn size={16} /> Sign In</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
