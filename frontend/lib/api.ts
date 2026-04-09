const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Setup ─────────────────────────────────────────────────────────────────────

export function getSetupStatus() {
  return request<{ needs_setup: boolean }>("/setup/status");
}

export function completeSetup(name: string, email: string, password: string) {
  return request<{ access_token: string; user_id: string; email: string; name: string }>(
    "/setup/complete",
    { method: "POST", body: JSON.stringify({ name, email, password }) }
  );
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export function login(email: string, password: string) {
  return request<{ access_token: string; user_id: string; email: string; name: string }>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
}

export function register(name: string, email: string, password: string) {
  return request<{ access_token: string; user_id: string; email: string; name: string }>(
    "/auth/register",
    { method: "POST", body: JSON.stringify({ name, email, password }) }
  );
}

export function getMe() {
  return request<{ id: string; email: string; name: string }>("/auth/me");
}

// ── Orgs ──────────────────────────────────────────────────────────────────────

export function createOrg(name: string) {
  return request<{ id: string; name: string; owner_id: string }>(
    "/orgs",
    { method: "POST", body: JSON.stringify({ name }) }
  );
}

export function getOrg(orgId: string) {
  return request<{
    id: string;
    name: string;
    owner_id: string;
    members: Member[];
  }>(`/orgs/${orgId}`);
}

export function addMember(orgId: string, member: { name: string; email: string; role: string }) {
  return request<Member>(`/orgs/${orgId}/members`, {
    method: "POST",
    body: JSON.stringify(member),
  });
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  account_id: string | null;
}

// ── Credential Templates ──────────────────────────────────────────────────────

export interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  secret: boolean;
  type: "text" | "password" | "textarea";
}

export interface ServiceTemplate {
  id: string;
  name: string;
  service_slug: string;
  credential_type: "api_custom" | "manual" | "ssh";
  fields_schema: FieldDef[];
  is_builtin: boolean;
  organization_id: string | null;
}

export function getTemplates(orgId: string) {
  return request<ServiceTemplate[]>(`/orgs/${orgId}/templates`);
}

export function createTemplate(orgId: string, body: {
  name: string;
  service_slug: string;
  credential_type: string;
  fields_schema: FieldDef[];
}) {
  return request<ServiceTemplate>(`/orgs/${orgId}/templates`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Credentials ───────────────────────────────────────────────────────────────

export interface CredentialFieldValue {
  key: string;
  label: string;
  value: string;
  secret: boolean;
}

export interface Credential {
  id: string;
  name: string;
  credential_type: string;
  template_id: string | null;
  template_name: string | null;
  organization_id: string;
  member_id: string;
  created_by_id: string;
  created_at: string;
  fields: CredentialFieldValue[];
  notes: string | null;
}

export function getMemberCredentials(orgId: string, memberId: string) {
  return request<Credential[]>(`/orgs/${orgId}/members/${memberId}/credentials`);
}

export function addCredential(
  orgId: string,
  memberId: string,
  body: {
    name: string;
    credential_type: string;
    template_id?: string;
    fields: Record<string, string>;
    custom_fields_schema?: FieldDef[];
    notes?: string;
  }
) {
  return request<Credential>(`/orgs/${orgId}/members/${memberId}/credentials`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteCredential(orgId: string, credentialId: string) {
  return request<void>(`/orgs/${orgId}/credentials/${credentialId}`, { method: "DELETE" });
}

export function getMyCredentials() {
  return request<Credential[]>("/me/credentials");
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

export function initiateOAuth(orgId: string, credentialId: string) {
  return request<{ authorization_url: string; state: string }>(
    `/orgs/${orgId}/credentials/${credentialId}/oauth/initiate`,
    { method: "POST" }
  );
}

export function getOAuthStatus(orgId: string, credentialId: string) {
  return request<{ authorized: boolean; token_type: string | null; scope: string | null }>(
    `/orgs/${orgId}/credentials/${credentialId}/oauth/status`
  );
}

// ── LDAP ──────────────────────────────────────────────────────────────────────

export interface LdapConfig {
  host: string;
  port: number;
  base_dn: string;
  bind_dn: string;
  bind_password: string;
  use_ssl: boolean;
  user_search_filter: string;
  user_attributes: string[];
}

export interface LdapConfigResponse extends Omit<LdapConfig, "bind_password"> {}

export function getLdapConfig(orgId: string) {
  return request<LdapConfigResponse>(`/orgs/${orgId}/settings/ldap`);
}

export function saveLdapConfig(orgId: string, config: LdapConfig) {
  return request<LdapConfigResponse>(`/orgs/${orgId}/settings/ldap`, {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export function testLdapConnection(orgId: string) {
  return request<{ success: boolean; message: string; user_count?: number; sample_users?: Record<string, string>[] }>(
    `/orgs/${orgId}/settings/ldap/test`,
    { method: "POST" }
  );
}

// ── Org Settings ──────────────────────────────────────────────────────────────

export interface OrgSettings {
  organization_id: string;
  ldap_configured: boolean;
  ldap_config: LdapConfigResponse | null;
  updated_at: string | null;
}

export function getOrgSettings(orgId: string) {
  return request<OrgSettings>(`/orgs/${orgId}/settings`);
}
