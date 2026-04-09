"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck, LogOut, Plus, Users, Building2,
  CheckCircle2, Clock, UserX, ChevronRight, X
} from "lucide-react";
import { getMe, getOrg, createOrg, addMember, type Member } from "@/lib/api";

interface User { id: string; email: string; name: string }
interface Org { id: string; name: string; owner_id: string; members: Member[] }

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: "", email: "", role: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { window.location.href = "/login"; return; }
    const u: User = JSON.parse(stored);
    setUser(u);

    const orgId = localStorage.getItem("orgId");
    Promise.all([
      getMe().catch(() => null),
      orgId ? getOrg(orgId).catch(() => null) : Promise.resolve(null),
    ]).then(([, o]) => {
      if (o) setOrg(o);
    }).finally(() => setLoading(false));
  }, []);

  function logout() {
    localStorage.clear();
    window.location.href = "/login";
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const o = await createOrg(orgName);
      localStorage.setItem("orgId", o.id);
      setOrg({ ...o, members: [] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setError(null);
    setSaving(true);
    try {
      const m = await addMember(org.id, memberForm);
      setOrg((prev) => prev ? { ...prev, members: [...prev.members, m] } : prev);
      setMemberForm({ name: "", email: "", role: "" });
      setShowAddMember(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080d19] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080d19] text-white">

      {/* ── Nav ──────────────────────────────────────── */}
      <nav className="border-b border-slate-800 bg-[#0d1221]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="font-semibold font-mono text-sm tracking-wide">
              PULSE<span className="text-indigo-400"> ID</span>
            </span>
            {org && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className="text-slate-400 text-sm">{org.name}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-500 text-sm hidden sm:block">{user?.email}</span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-200 text-sm transition"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">

        {/* ── No org yet ───────────────────────────── */}
        {!org && (
          <div className="max-w-md mx-auto mt-16 space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex w-14 h-14 rounded-xl bg-indigo-500/10 border border-indigo-500/20 items-center justify-center mx-auto">
                <Building2 className="w-7 h-7 text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold">Create your organization</h2>
              <p className="text-slate-500 text-sm">Set up your workspace to start managing identity lifecycles.</p>
            </div>
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
            )}
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Corp"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition"
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold transition"
              >
                {saving ? "Creating…" : "Create organization"}
              </button>
            </form>
          </div>
        )}

        {/* ── Org dashboard ────────────────────────── */}
        {org && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total members", value: org.members.length, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
                { label: "Provisioned", value: org.members.filter(m => m.account_id).length, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                { label: "Pending", value: org.members.filter(m => !m.account_id).length, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
                { label: "Deprovisioned", value: 0, icon: UserX, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-800 bg-[#0d1221] p-4 space-y-3">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${s.bg}`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{s.value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Members table */}
            <div className="rounded-xl border border-slate-800 bg-[#0d1221] overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm">Members</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Manage your organization&apos;s identity lifecycle</p>
                </div>
                <button
                  onClick={() => { setShowAddMember(true); setError(null); }}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add member
                </button>
              </div>

              {org.members.length === 0 ? (
                <div className="py-16 text-center text-slate-600 text-sm">
                  No members yet — add your first employee to get started.
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      {["Name", "Email", "Role", "Status"].map((h) => (
                        <th key={h} className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {org.members.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/20 transition">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center text-xs font-semibold text-indigo-300">
                              {m.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                            </div>
                            <span className="text-sm font-medium">{m.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-sm text-slate-400">{m.email}</td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-300">
                            {m.role}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          {m.account_id ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Provisioned
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>

      {/* ── Add member modal ─────────────────────────── */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-slate-700 bg-[#0d1221] shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h3 className="font-semibold">Add member</h3>
                <p className="text-xs text-slate-500 mt-0.5">Onboard a new employee to your organization</p>
              </div>
              <button onClick={() => setShowAddMember(false)} className="text-slate-500 hover:text-slate-200 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="p-6 space-y-4">
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
              )}
              {[
                { key: "name", label: "Full name", placeholder: "John Doe", type: "text" },
                { key: "email", label: "Work email", placeholder: "john@company.com", type: "email" },
                { key: "role", label: "Role", placeholder: "e.g. Software Engineer", type: "text" },
              ].map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{f.label}</label>
                  <input
                    type={f.type}
                    value={memberForm[f.key as keyof typeof memberForm]}
                    onChange={(e) => setMemberForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMember(false)}
                  className="flex-1 rounded-lg border border-slate-700 bg-transparent hover:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold transition"
                >
                  {saving ? "Adding…" : "Add member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
