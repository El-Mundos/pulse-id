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


class OrgSettings(SQLModel, table=True):
    """Per-org configuration: LDAP server, OAuth defaults, etc."""
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    organization_id: str = Field(foreign_key="organization.id", unique=True, index=True)
    # Fernet-encrypted JSON with LDAP server config
    ldap_config: Optional[str] = Field(default=None)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ServiceTemplate(SQLModel, table=True):
    """Field schema for a credential type. Builtin templates seeded on startup."""
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    name: str
    service_slug: str = Field(index=True)
    credential_type: str  # "api_custom" | "manual" | "ssh" | "oauth2" | "ldap"
    fields_schema: str = Field(default="[]")  # JSON list of FieldDef
    is_builtin: bool = Field(default=False)
    organization_id: Optional[str] = Field(default=None, foreign_key="organization.id", index=True)


class Credential(SQLModel, table=True):
    """Credential assigned to an OrganizationMember by an admin."""
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    name: str
    credential_type: str  # "api_custom" | "manual" | "ssh" | "oauth2" | "ldap"
    template_id: Optional[str] = Field(default=None, foreign_key="servicetemplate.id")
    organization_id: str = Field(foreign_key="organization.id", index=True)
    member_id: str = Field(foreign_key="organizationmember.id", index=True)
    created_by_id: str = Field(foreign_key="account.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    encrypted_data: str  # Fernet-encrypted JSON: {field_key: value, ...}
    custom_fields_schema: Optional[str] = Field(default=None)  # JSON, for api_custom without template
    notes: Optional[str] = Field(default=None)


class OAuthState(SQLModel, table=True):
    """Temporary state token for OAuth 2.0 CSRF protection."""
    state: str = Field(primary_key=True)
    credential_id: str = Field(foreign_key="credential.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
