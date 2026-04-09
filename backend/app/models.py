from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Account(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    email: str = Field(sa_column_kwargs={"unique": True, "nullable": False}, index=True)
    hashed_password: str
    name: str


class Organization(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    name: str
    owner_id: str = Field(foreign_key="account.id")


class OrganizationMember(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    organization_id: str = Field(foreign_key="organization.id", index=True)
    name: str
    email: str = Field(index=True)
    role: str
    account_id: Optional[str] = Field(default=None, foreign_key="account.id", index=True)


class AccountToken(SQLModel, table=True):
    token: str = Field(primary_key=True, index=True)
    account_id: str = Field(foreign_key="account.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ServiceTemplate(SQLModel, table=True):
    """
    Defines the field schema for a credential type.
    Builtin templates (AWS, GitHub, SSH…) are seeded on startup.
    Orgs can create custom templates via the API.
    """
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    name: str
    service_slug: str = Field(index=True)  # e.g. "aws", "github", "ssh"
    credential_type: str  # "api_custom" | "manual" | "ssh"
    # JSON list of FieldDef: [{key, label, required, secret, type}]
    fields_schema: str = Field(default="[]")
    is_builtin: bool = Field(default=False)
    organization_id: Optional[str] = Field(default=None, foreign_key="organization.id", index=True)


class Credential(SQLModel, table=True):
    """Credential assigned to an OrganizationMember by an admin."""
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    name: str
    credential_type: str  # "api_custom" | "manual" | "ssh"
    template_id: Optional[str] = Field(default=None, foreign_key="servicetemplate.id")
    organization_id: str = Field(foreign_key="organization.id", index=True)
    member_id: str = Field(foreign_key="organizationmember.id", index=True)
    created_by_id: str = Field(foreign_key="account.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    # Fernet-encrypted JSON: {"field_key": "value", ...}
    encrypted_data: str
    # For api_custom credentials without a template, admin defines fields inline.
    # JSON list of FieldDef (same shape as fields_schema above).
    custom_fields_schema: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)
