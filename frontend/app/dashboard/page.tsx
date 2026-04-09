"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck, LogOut, Plus, Users, Building2,
  CheckCircle2, Clock, UserX, ChevronRight, X,
  Key, Eye, EyeOff, Trash2, KeyRound, Terminal, Lock, Settings, ExternalLink,
} from "lucide-react";
import {
  getMe, getOrg, createOrg, addMember, getTemplates, getMemberCredentials,
  addCredential, deleteCredential, getMyCredentials, initiateOAuth,
  type Member, type ServiceTemplate, type Credential, type FieldDef,
} from "@/lib/api";

interface User { id: string; email: string; name: string }
interface Org { id: string; name: string; owner_id: string; members: Member[] }

// ── Credential type icons ─────────────────────────────────────────────────────
const CRED_TYPE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  api_custom: { label: "API Key",   color: "text-indigo-400",  icon: <Terminal className="w-3.5 h-3.5" /> },
  manual:     { label: "Manual",    color: "text-amber-400",   icon: <Lock className="w-3.5 h-3.5" /> },
  ssh:        { label: "SSH Key",   color: "text-emerald-400", icon: <KeyRound className="w-3.5 h-3.5" /> },
  oauth2:     { label: "OAuth 2.0", color: "text-purple-400",  icon: <ExternalLink className="w-3.5 h-3.5" /> },
  ldap:       { label: "LDAP",      color: "text-blue-400",    icon: <Settings className="w-3.5 h-3.5" /> },
};

// ── Service slug icons ────────────────────────────────────────────────────────
const SLUG_EMOJI: Record<string, string> = {
  ssh: "🔑", manual: "🔒", custom_api: "⚡", oauth2: "🔐", ldap: "🗂️",
};

// ── Revealed secrets state ────────────────────────────────────────────────────
function SecretField({ value }: { value: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-mono text-xs">{show ? value : "••••••••••••"}</span>
      <button onClick={() => setShow(s => !s)} className="text-slate-500 hover:text-slate-300 transition">
        {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      </button>
    </span>
  );
}

// ── Member credential sheet ───────────────────────────────────────────────────
function CredentialSheet({
  member, orgId, isAdmin, onClose,
}: {
  member: Member; orgId: string; isAdmin: boolean; onClose: () => void;
}) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    Promise.all([
      getMemberCredentials(orgId, member.id),
      isAdmin ? getTemplates(orgId) : Promise.resolve([]),
    ]).then(([creds, tpls]) => {
      setCredentials(creds);
      setTemplates(tpls as ServiceTemplate[]);
    }).finally(() => setLoading(false));
  }, [orgId, member.id, isAdmin]);

  function handleAdded(cred: Credential) {
    setCredentials(prev => [cred, ...prev]);
    setShowAdd(false);
  }

  async function handleDelete(credId: string) {
    await deleteCredential(orgId, credId);
    setCredentials(prev => prev.filter(c => c.id !== credId));
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-[#0d1221] border-l border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center text-xs font-semibold text-indigo-300">
              {member.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div>
              <div className="font-semibold text-sm">{member.name}</div>
              <div className="text-xs text-slate-500">{member.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add credential
              </button>
            )}
            <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Credential list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
            </div>
          ) : credentials.length === 0 ? (
            <div className="text-center py-12 text-slate-600 text-sm">
              No credentials assigned yet.
            </div>
          ) : (
            credentials.map(cred => (
              <CredentialCard key={cred.id} cred={cred} canDelete={isAdmin} onDelete={handleDelete} />
            ))
          )}
        </div>
      </div>

      {showAdd && (
        <AddCredentialModal
          orgId={orgId}
          member={member}
          templates={templates}
          onAdded={handleAdded}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

// ── Single credential card ────────────────────────────────────────────────────
function CredentialCard({ cred, canDelete, onDelete }: {
  cred: Credential;
  canDelete: boolean;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const meta = CRED_TYPE_META[cred.credential_type] ?? CRED_TYPE_META.api_custom;

  async function handleAuthorize() {
    setAuthorizing(true);
    try {
      const { authorization_url } = await initiateOAuth(cred.organization_id, cred.id);
      window.open(authorization_url, "_blank", "width=600,height=700");
    } finally {
      setAuthorizing(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1e] overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800/20 transition"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs ${meta.color}`}>
            {meta.icon}
            <span>{meta.label}</span>
          </div>
          <span className="font-medium text-sm">{cred.name}</span>
          {cred.template_name && (
            <span className="text-xs text-slate-600">· {cred.template_name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {cred.credential_type === "oauth2" && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAuthorize(); }}
              disabled={authorizing}
              className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border transition ${cred.oauth_authorized ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10" : "border-purple-500/40 text-purple-400 hover:bg-purple-500/10"}`}
            >
              <ExternalLink className="w-3 h-3" />
              {cred.oauth_authorized ? "Re-authorize" : "Authorize"}
            </button>
          )}
          <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform ${expanded ? "rotate-90" : ""}`} />
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(cred.id); }}
              className="text-slate-600 hover:text-red-400 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-800 px-4 py-3 space-y-2">
          {cred.fields.map(f => (
            <div key={f.key} className="flex items-center justify-between text-sm">
              <span className="text-slate-500 text-xs w-32 shrink-0">{f.label}</span>
              {f.secret
                ? <SecretField value={f.value} />
                : <span className="font-mono text-xs text-slate-300">{f.value || "—"}</span>
              }
            </div>
          ))}
          {cred.notes && (
            <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-800">{cred.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add credential modal ──────────────────────────────────────────────────────
function AddCredentialModal({ orgId, member, templates, onAdded, onClose }: {
  orgId: string;
  member: Member;
  templates: ServiceTemplate[];
  onAdded: (cred: Credential) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"pick" | "fill">("pick");
  const [selectedTemplate, setSelectedTemplate] = useState<ServiceTemplate | null>(null);
  const [credName, setCredName] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [customFields, setCustomFields] = useState<Array<{ key: string; label: string; secret: boolean }>>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickTemplate(t: ServiceTemplate) {
    setSelectedTemplate(t);
    setCredName(t.name);
    const initial: Record<string, string> = {};
    t.fields_schema.forEach(f => { initial[f.key] = ""; });
    setFieldValues(initial);
    setStep("fill");
  }

  function addCustomField() {
    setCustomFields(prev => [...prev, { key: `field_${prev.length + 1}`, label: "", secret: false }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate) return;
    setError(null);
    setSaving(true);

    const isCustomApi = selectedTemplate.service_slug === "custom_api";
    const customSchema: FieldDef[] | undefined = isCustomApi
      ? customFields.map(f => ({ key: f.key, label: f.label || f.key, required: false, secret: f.secret, type: "text" as const }))
      : undefined;

    const fields: Record<string, string> = isCustomApi
      ? Object.fromEntries(customFields.map(f => [f.key, fieldValues[f.key] ?? ""]))
      : fieldValues;

    try {
      const cred = await addCredential(orgId, member.id, {
        name: credName,
        credential_type: selectedTemplate.credential_type,
        template_id: isCustomApi ? undefined : selectedTemplate.id,
        fields,
        custom_fields_schema: customSchema,
        notes: notes || undefined,
      });
      onAdded(cred);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save credential");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-slate-700 bg-[#0d1221] shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h3 className="font-semibold">Add credential</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === "pick" ? "Choose a credential type or service" : `For ${member.name}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {step === "fill" && (
              <button onClick={() => setStep("pick")} className="text-xs text-slate-500 hover:text-slate-300 transition">← Back</button>
            )}
            <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {step === "pick" ? (
            <div className="p-6 grid grid-cols-2 gap-3">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => pickTemplate(t)}
                  className="flex flex-col items-start gap-2 rounded-xl border border-slate-700 bg-slate-800/30 hover:border-indigo-500/50 hover:bg-indigo-500/5 p-4 text-left transition"
                >
                  <span className="text-2xl">{SLUG_EMOJI[t.service_slug] ?? "🔐"}</span>
                  <div>
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className={`text-xs mt-0.5 ${CRED_TYPE_META[t.credential_type]?.color ?? "text-slate-500"}`}>
                      {CRED_TYPE_META[t.credential_type]?.label ?? t.credential_type}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <form id="cred-form" onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Credential name</label>
                <input
                  type="text"
                  value={credName}
                  onChange={e => setCredName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition"
                />
              </div>

              {/* Standard template fields */}
              {selectedTemplate?.service_slug !== "custom_api" && selectedTemplate?.fields_schema.map(f => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea
                      value={fieldValues[f.key] ?? ""}
                      onChange={e => setFieldValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                      required={f.required}
                      rows={4}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition font-mono resize-none"
                    />
                  ) : (
                    <input
                      type={f.type === "password" ? "password" : "text"}
                      value={fieldValues[f.key] ?? ""}
                      onChange={e => setFieldValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                      required={f.required}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition"
                    />
                  )}
                </div>
              ))}

              {/* Custom API — dynamic field builder */}
              {selectedTemplate?.service_slug === "custom_api" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Fields</span>
                    <button
                      type="button"
                      onClick={addCustomField}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add field
                    </button>
                  </div>
                  {customFields.length === 0 && (
                    <p className="text-xs text-slate-600">No fields added yet. Click &quot;Add field&quot; to start.</p>
                  )}
                  {customFields.map((f, i) => (
                    <div key={i} className="rounded-lg border border-slate-800 p-3 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Field label"
                          value={f.label}
                          onChange={e => setCustomFields(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, "_") } : x))}
                          className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setCustomFields(prev => prev.filter((_, j) => j !== i))}
                          className="text-slate-600 hover:text-red-400 transition px-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Value"
                        value={fieldValues[f.key] ?? ""}
                        onChange={e => setFieldValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition"
                      />
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                        <input
                          type="checkbox"
                          checked={f.secret}
                          onChange={e => setCustomFields(prev => prev.map((x, j) => j === i ? { ...x, secret: e.target.checked } : x))}
                          className="rounded"
                        />
                        Secret (masked by default)
                      </label>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any extra context…"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition"
                />
              </div>
            </form>
          )}
        </div>

        {step === "fill" && (
          <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 bg-transparent hover:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              form="cred-form"
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold transition"
            >
              {saving ? "Saving…" : "Save credential"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── My Credentials section ────────────────────────────────────────────────────
function MyCredentials() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyCredentials().then(setCredentials).finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (credentials.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d1221] overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
        <Key className="w-4 h-4 text-indigo-400" />
        <h3 className="font-semibold text-sm">My Credentials</h3>
        <span className="ml-auto text-xs text-slate-500">{credentials.length} assigned</span>
      </div>
      <div className="p-4 space-y-2">
        {credentials.map(cred => (
          <CredentialCard key={cred.id} cred={cred} canDelete={false} onDelete={() => {}} />
        ))}
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: "", email: "", role: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credSheetMember, setCredSheetMember] = useState<Member | null>(null);

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
      if (o) { setOrg(o); localStorage.setItem("orgName", o.name); }
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

  const isAdmin = org?.owner_id === user?.id;

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
            {isAdmin && org && (
              <a
                href="/dashboard/settings"
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-200 text-sm transition"
              >
                <Settings className="w-4 h-4" />
                Settings
              </a>
            )}
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
            {/* My Credentials (member view) */}
            {!isAdmin && <MyCredentials />}

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
                {isAdmin && (
                  <button
                    onClick={() => { setShowAddMember(true); setError(null); }}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add member
                  </button>
                )}
              </div>

              {org.members.length === 0 ? (
                <div className="py-16 text-center text-slate-600 text-sm">
                  No members yet — add your first employee to get started.
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      {["Name", "Email", "Role", "Status", ""].map((h) => (
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
                        <td className="px-6 py-3.5 text-right">
                          <button
                            onClick={() => setCredSheetMember(m)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 hover:border-indigo-500/50 hover:bg-indigo-500/5 px-2.5 py-1 text-xs text-slate-400 hover:text-indigo-300 transition"
                          >
                            <Key className="w-3 h-3" />
                            Credentials
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Admin: My Credentials if also a member */}
            {isAdmin && <MyCredentials />}
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

      {/* ── Credential sheet ─────────────────────────── */}
      {credSheetMember && org && (
        <CredentialSheet
          member={credSheetMember}
          orgId={org.id}
          isAdmin={isAdmin}
          onClose={() => setCredSheetMember(null)}
        />
      )}
    </div>
  );
}
