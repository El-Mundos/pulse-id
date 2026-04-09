from datetime import datetime
from typing import List, Optional

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


# ── Credentials ──────────────────────────────────────────────────────────────

class FieldDef(BaseModel):
    """Schema definition for a single credential field."""
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
    credential_type: str  # "api_custom" | "manual" | "ssh"
    template_id: Optional[str] = None
    fields: dict  # {field_key: value}
    # Required when credential_type=="api_custom" and no template_id
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
