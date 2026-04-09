"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck, ChevronRight, LogOut, Settings,
  Server, CheckCircle2, XCircle, Loader2, Save, FlaskConical,
} from "lucide-react";
import { getLdapConfig, saveLdapConfig, testLdapConnection, type LdapConfig } from "@/lib/api";

interface User { id: string; email: string; name: string }

const DEFAULT_LDAP: LdapConfig = {
  host: "",
  port: 389,
  base_dn: "",
  bind_dn: "",
  bind_password: "",
  use_ssl: false,
  user_search_filter: "(objectClass=person)",
  user_attributes: ["cn", "mail", "sAMAccountName", "uid"],
};

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>("");

  const [ldap, setLdap] = useState<LdapConfig>(DEFAULT_LDAP);
  const [ldapLoaded, setLdapLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean; message: string; user_count?: number;
    sample_users?: Record<string, string>[];
  } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { window.location.href = "/login"; return; }
    setUser(JSON.parse(stored));
    const id = localStorage.getItem("orgId");
    setOrgId(id);
    const name = localStorage.getItem("orgName") ?? "";
    setOrgName(name);

    if (id) {
      getLdapConfig(id).then(cfg => {
        setLdap(prev => ({ ...prev, ...cfg, bind_password: "" }));
        setLdapLoaded(true);
      }).catch(() => setLdapLoaded(false));
    }
  }, []);

  async function handleSaveLdap(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await saveLdapConfig(orgId, ldap);
      setSaveMsg({ ok: true, text: "LDAP configuration saved." });
      setLdapLoaded(true);
    } catch (err: unknown) {
      setSaveMsg({ ok: false, text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestLdap() {
    if (!orgId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testLdapConnection(orgId);
      setTestResult(result);
    } catch (err: unknown) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  }

  function logout() {
    localStorage.clear();
    window.location.href = "/login";
  }

  const field = (
    key: keyof LdapConfig,
    label: string,
    opts: { type?: string; placeholder?: string; required?: boolean } = {}
  ) => (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
        {label}{opts.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={opts.type ?? "text"}
        value={String(ldap[key])}
        onChange={e => setLdap(prev => ({ ...prev, [key]: opts.type === "number" ? Number(e.target.value) : e.target.value }))}
        placeholder={opts.placeholder}
        required={opts.required}
        className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080d19] text-white">

      {/* Nav */}
      <nav className="border-b border-slate-800 bg-[#0d1221]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="font-semibold font-mono text-sm tracking-wide">
              PULSE<span className="text-indigo-400"> ID</span>
            </span>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <a href="/dashboard" className="text-slate-400 text-sm hover:text-slate-200 transition">{orgName || "Dashboard"}</a>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className="text-slate-300 text-sm flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" /> Settings
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-500 text-sm hidden sm:block">{user?.email}</span>
            <button onClick={logout} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-200 text-sm transition">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        <div>
          <h1 className="text-xl font-bold">Organization Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Configure integrations and server connections for your org.</p>
        </div>

        {/* LDAP Section */}
        <section className="rounded-xl border border-slate-800 bg-[#0d1221] overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Server className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">LDAP / Active Directory</h2>
              <p className="text-xs text-slate-500 mt-0.5">Connect to your directory server for member authentication</p>
            </div>
            {ldapLoaded && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Configured
              </span>
            )}
          </div>

          <form onSubmit={handleSaveLdap} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                {field("host", "Host / IP", { required: true, placeholder: "ldap.example.com or 192.168.1.10" })}
              </div>
              <div>
                {field("port", "Port", { type: "number", placeholder: "389" })}
              </div>
            </div>

            {field("base_dn", "Base DN", { required: true, placeholder: "DC=example,DC=com" })}
            {field("bind_dn", "Bind DN (service account)", { required: true, placeholder: "CN=svc-ldap,OU=ServiceAccounts,DC=example,DC=com" })}
            {field("bind_password", "Bind Password", { type: "password", required: !ldapLoaded, placeholder: ldapLoaded ? "Leave blank to keep current" : "••••••••" })}
            {field("user_search_filter", "User Search Filter", { placeholder: "(objectClass=person)" })}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">User Attributes (comma-separated)</label>
              <input
                type="text"
                value={ldap.user_attributes.join(", ")}
                onChange={e => setLdap(prev => ({ ...prev, user_attributes: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                placeholder="cn, mail, sAMAccountName, uid"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition"
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setLdap(prev => ({ ...prev, use_ssl: !prev.use_ssl }))}
                className={`w-10 h-5 rounded-full transition relative ${ldap.use_ssl ? "bg-indigo-600" : "bg-slate-700"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${ldap.use_ssl ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
              <span className="text-sm text-slate-300">Use SSL/TLS (LDAPS — port 636)</span>
            </label>

            {saveMsg && (
              <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm border ${saveMsg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
                {saveMsg.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {saveMsg.text}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold transition"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving…" : "Save configuration"}
              </button>
              {ldapLoaded && (
                <button
                  type="button"
                  onClick={handleTestLdap}
                  disabled={testing}
                  className="flex items-center gap-2 rounded-lg border border-slate-700 hover:border-indigo-500/50 hover:bg-indigo-500/5 disabled:opacity-50 px-4 py-2.5 text-sm font-medium text-slate-300 transition"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                  {testing ? "Testing…" : "Test connection"}
                </button>
              )}
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`rounded-xl border p-4 space-y-2 ${testResult.success ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                <div className={`flex items-center gap-2 text-sm font-medium ${testResult.success ? "text-emerald-300" : "text-red-300"}`}>
                  {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {testResult.message}
                  {testResult.user_count !== undefined && (
                    <span className="ml-auto text-xs text-slate-500">{testResult.user_count} entries returned</span>
                  )}
                </div>
                {testResult.sample_users && testResult.sample_users.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Sample entries</p>
                    {testResult.sample_users.map((u, i) => (
                      <div key={i} className="rounded-lg bg-slate-800/50 px-3 py-2 text-xs font-mono text-slate-300">
                        {Object.entries(u).map(([k, v]) => v ? `${k}: ${v}` : null).filter(Boolean).join(" · ")}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>
        </section>

      </main>
    </div>
  );
}
