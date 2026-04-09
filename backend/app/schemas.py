from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field


class AccountCreate(BaseModel):
    email: EmailStr
    password: str
    name: str


class AccountLogin(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: EmailStr
    name: str


class OrganizationCreate(BaseModel):
    name: str


class OrganizationResponse(BaseModel):
    id: str
    name: str
    owner_id: str


class MemberCreate(BaseModel):
    name: str
    email: EmailStr
    role: str
    account_id: Optional[str] = None


class MemberResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    account_id: Optional[str] = None


class OrganizationDetail(OrganizationResponse):
    members: List[MemberResponse] = Field(default_factory=list)


# ── Credentials ───────────────────────────────────────────────────────────────

class FieldDef(BaseModel):
    key: str
    label: str
    required: bool = False
    secret: bool = False
    type: str = "text"  # "text" | "password" | "textarea"


class ServiceTemplateResponse(BaseModel):
    id: str
    name: str
    service_slug: str
    credential_type: str
    fields_schema: List[FieldDef]
    is_builtin: bool
    organization_id: Optional[str] = None


class CustomTemplateCreate(BaseModel):
    name: str
    service_slug: str
    credential_type: str
    fields_schema: List[FieldDef]


class CredentialCreate(BaseModel):
    name: str
    credential_type: str
    template_id: Optional[str] = None
    fields: dict
    custom_fields_schema: Optional[List[FieldDef]] = None
    notes: Optional[str] = None


class CredentialFieldValue(BaseModel):
    key: str
    label: str
    value: str
    secret: bool


class CredentialResponse(BaseModel):
    id: str
    name: str
    credential_type: str
    template_id: Optional[str] = None
    template_name: Optional[str] = None
    organization_id: str
    member_id: str
    created_by_id: str
    created_at: datetime
    fields: List[CredentialFieldValue]
    notes: Optional[str] = None
    # OAuth-specific: whether the token has been obtained
    oauth_authorized: Optional[bool] = None


# ── LDAP ──────────────────────────────────────────────────────────────────────

class LdapConfig(BaseModel):
    host: str
    port: int = 389
    base_dn: str
    bind_dn: str
    bind_password: str
    use_ssl: bool = False
    user_search_filter: str = "(objectClass=person)"
    user_attributes: List[str] = Field(default_factory=lambda: ["cn", "mail", "sAMAccountName", "uid"])


class LdapConfigResponse(BaseModel):
    host: str
    port: int
    base_dn: str
    bind_dn: str
    use_ssl: bool
    user_search_filter: str
    user_attributes: List[str]
    # bind_password intentionally omitted


class LdapTestResult(BaseModel):
    success: bool
    message: str
    user_count: Optional[int] = None
    sample_users: Optional[List[Dict[str, Any]]] = None


class LdapAuthRequest(BaseModel):
    username: str
    password: str
    username_attr: str = "sAMAccountName"  # or "uid" for OpenLDAP


# ── OAuth 2.0 ─────────────────────────────────────────────────────────────────

class OAuthInitiateResponse(BaseModel):
    authorization_url: str
    state: str


class OAuthTokenInfo(BaseModel):
    authorized: bool
    token_type: Optional[str] = None
    scope: Optional[str] = None
    expires_at: Optional[str] = None


# ── Org Settings ──────────────────────────────────────────────────────────────

class OrgSettingsResponse(BaseModel):
    organization_id: str
    ldap_configured: bool
    ldap_config: Optional[LdapConfigResponse] = None
    updated_at: Optional[datetime] = None
