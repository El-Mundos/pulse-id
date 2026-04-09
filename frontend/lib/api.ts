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

// Auth
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

// Orgs
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
