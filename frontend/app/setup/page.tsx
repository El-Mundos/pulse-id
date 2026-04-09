"use client";

import { useState } from "react";
import { ShieldCheck, ArrowRight, Building2, User, CheckCircle2 } from "lucide-react";
import { completeSetup, createOrg } from "@/lib/api";

type Step = "admin" | "org" | "done";

export default function SetupPage() {
  const [step, setStep] = useState<Step>("admin");
  const [adminForm, setAdminForm] = useState({ name: "", email: "", password: "" });
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await completeSetup(adminForm.name, adminForm.email, adminForm.password);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify({ id: data.user_id, email: data.email, name: data.name }));
      setStep("org");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleOrgSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const org = await createOrg(orgName);
      localStorage.setItem("orgId", org.id);
      setStep("done");
      setTimeout(() => { window.location.href = "/dashboard"; }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setLoading(false);
    }
  }

  const steps = [
    { id: "admin", label: "Admin account", icon: User },
    { id: "org",   label: "Organization",  icon: Building2 },
    { id: "done",  label: "Ready",         icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen bg-[#080d19] flex flex-col items-center justify-center px-4 py-12">

      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
        </div>
        <span className="text-white font-semibold font-mono tracking-wide">
          PULSE<span className="text-indigo-400"> ID</span>
        </span>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-3 mb-10">
        {steps.map((s, i) => {
          const stepIndex = steps.findIndex(x => x.id === step);
          const isDone = i < stepIndex || step === "done";
          const isActive = s.id === step;
          return (
            <div key={s.id} className="flex items-center gap-3">
              <div className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                isActive ? "text-white" : isDone ? "text-emerald-400" : "text-slate-600"
              }`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center border text-xs font-bold transition-all ${
                  isActive
                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                    : isDone
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                    : "border-slate-700 text-slate-600"
                }`}>
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className="hidden sm:block">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 h-px ${i < stepIndex ? "bg-emerald-500/40" : "bg-slate-800"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d1221] p-8 shadow-2xl">

        {/* Step 1: Admin */}
        {step === "admin" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Create admin account</h2>
              <p className="text-slate-500 text-sm mt-1">
                This is the first and only account you can create here. Registration will be disabled after setup.
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
            )}

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              {[
                { key: "name",     label: "Full name",  type: "text",     placeholder: "Your name" },
                { key: "email",    label: "Email",      type: "email",    placeholder: "admin@company.com" },
                { key: "password", label: "Password",   type: "password", placeholder: "••••••••" },
              ].map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{f.label}</label>
                  <input
                    type={f.type}
                    value={adminForm[f.key as keyof typeof adminForm]}
                    onChange={(e) => setAdminForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    required
                    minLength={f.key === "password" ? 8 : undefined}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition"
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-white transition mt-2"
              >
                {loading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <> Continue <ArrowRight className="w-4 h-4" /> </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Org */}
        {step === "org" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Create your organization</h2>
              <p className="text-slate-500 text-sm mt-1">
                Give your company a name. You can manage employees and services from here.
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
            )}

            <form onSubmit={handleOrgSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Organization name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-white transition mt-2"
              >
                {loading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <> Finish setup <ArrowRight className="w-4 h-4" /> </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="text-center space-y-4 py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Setup complete</h2>
            <p className="text-slate-500 text-sm">Redirecting to your dashboard…</p>
            <div className="w-5 h-5 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin mx-auto" />
          </div>
        )}
      </div>

      <p className="text-slate-700 text-xs mt-8 font-mono">PULSE ID · Self-hosted deployment</p>
    </div>
  );
}
