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
