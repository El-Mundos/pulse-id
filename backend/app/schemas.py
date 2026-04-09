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
