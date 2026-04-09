"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Zap, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { login, getSetupStatus } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSetupStatus()
      .then((s) => {
        if (s.needs_setup) {
          window.location.href = "/setup";
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await login(email, password);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify({ id: data.user_id, email: data.email, name: data.name }));
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080d19]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          <p className="text-slate-500 text-sm font-mono">Connecting…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex font-sans bg-[#080d19]">

      {/* ── Left panel ───────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden">

        {/* grid background */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* radial glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-violet-600/10 blur-[80px] pointer-events-none" />

        {/* top logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="text-white font-semibold tracking-wide text-lg font-mono">
            PULSE<span className="text-indigo-400"> ID</span>
          </span>
        </div>

        {/* center content */}
        <div className="relative space-y-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-mono tracking-widest uppercase">
              <Zap className="w-3 h-3" />
              Identity Lifecycle Platform
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight">
              Access control,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                automated.
              </span>
            </h1>
            <p className="text-slate-400 text-base leading-relaxed max-w-sm">
              Identity lifecycle management. Automated, auditable, and secure — from onboarding to offboarding.
            </p>
          </div>

          {/* feature pills */}
          <div className="space-y-3">
            {[
              { icon: "⚡", label: "Parallel provisioning across all services" },
              { icon: "🔒", label: "AES-256 encrypted credential vault" },
              { icon: "🔗", label: "Cryptographic tamper-evident audit log" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3 text-sm text-slate-400">
                <span className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-xs">
                  {f.icon}
                </span>
                {f.label}
              </div>
            ))}
          </div>
        </div>

        {/* bottom */}
        <p className="relative text-slate-600 text-xs font-mono">
          PULSE ID · CiberGU 2026
        </p>
      </div>

      {/* ── Right panel ──────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-[#0d1221]">

        {/* mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <ShieldCheck className="w-6 h-6 text-indigo-400" />
          <span className="text-white font-semibold font-mono text-lg">
            PULSE<span className="text-indigo-400"> ID</span>
          </span>
        </div>

        <div className="w-full max-w-sm space-y-8">

          {/* heading */}
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white tracking-tight">Welcome back</h2>
            <p className="text-slate-500 text-sm">Sign in to your organization</p>
          </div>

          {/* error */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <Lock className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
              {error}
            </div>
          )}

          {/* form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-600 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in…
                </span>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-600">
            Protected by zero-trust access control
          </p>
        </div>
      </div>
    </div>
  );
}
