import json
import secrets
import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import select
from sqlalchemy.exc import IntegrityError
from sqlmodel.ext.asyncio.session import AsyncSession

from .crypto import decrypt_data, encrypt_data
from .models import (
    Account, AccountToken, Credential, OAuthState, OrgSettings,
    Organization, OrganizationMember, ServiceTemplate,
)

# ── Builtin service templates ─────────────────────────────────────────────────
# Only generic types — service-specific integrations (AWS, GitHub, etc.)
# should be configured as automated integrations, not manual credentials.

BUILTIN_TEMPLATES = [
    {
        "name": "SSH Key",
        "service_slug": "ssh",
        "credential_type": "ssh",
        "fields_schema": [
            {"key": "private_key", "label": "Private Key", "required": True, "secret": True, "type": "textarea"},
            {"key": "public_key", "label": "Public Key", "required": False, "secret": False, "type": "textarea"},
            {"key": "passphrase", "label": "Passphrase", "required": False, "secret": True, "type": "password"},
            {"key": "host", "label": "Host", "required": False, "secret": False, "type": "text"},
            {"key": "username", "label": "Username", "required": False, "secret": False, "type": "text"},
        ],
    },
    {
        "name": "Manual Credentials",
        "service_slug": "manual",
        "credential_type": "manual",
        "fields_schema": [
            {"key": "username", "label": "Username", "required": True, "secret": False, "type": "text"},
            {"key": "password", "label": "Password", "required": True, "secret": True, "type": "password"},
            {"key": "url", "label": "URL / Endpoint", "required": False, "secret": False, "type": "text"},
            {"key": "notes", "label": "Notes", "required": False, "secret": False, "type": "textarea"},
        ],
    },
    {
        "name": "Custom API",
        "service_slug": "custom_api",
        "credential_type": "api_custom",
        "fields_schema": [],  # Admin defines fields at creation time
    },
    {
        "name": "OAuth 2.0",
        "service_slug": "oauth2",
        "credential_type": "oauth2",
        "fields_schema": [
            {"key": "client_id", "label": "Client ID", "required": True, "secret": False, "type": "text"},
            {"key": "client_secret", "label": "Client Secret", "required": True, "secret": True, "type": "password"},
            {"key": "auth_url", "label": "Authorization URL", "required": True, "secret": False, "type": "text"},
            {"key": "token_url", "label": "Token URL", "required": True, "secret": False, "type": "text"},
            {"key": "scopes", "label": "Scopes (space-separated)", "required": False, "secret": False, "type": "text"},
        ],
    },
    {
        "name": "LDAP",
        "service_slug": "ldap",
        "credential_type": "ldap",
        "fields_schema": [
            {"key": "username", "label": "LDAP Username / DN", "required": True, "secret": False, "type": "text"},
            {"key": "password", "label": "Password", "required": True, "secret": True, "type": "password"},
        ],
    },
]


# ── Account ───────────────────────────────────────────────────────────────────

async def create_account(session: AsyncSession, email: str, name: str, hashed_password: str) -> Account:
    account = Account(id=str(uuid.uuid4()), email=email, name=name, hashed_password=hashed_password)
    session.add(account)
    try:
        await session.commit()
        await session.refresh(account)
    except IntegrityError:
        await session.rollback()
        raise
    return account


async def get_account_by_email(session: AsyncSession, email: str) -> Account | None:
    result = await session.exec(select(Account).where(Account.email == email))
    return result.one_or_none()


async def get_account_by_id(session: AsyncSession, account_id: str) -> Account | None:
    return await session.get(Account, account_id)


async def create_account_token(session: AsyncSession, account_id: str) -> str:
    token = secrets.token_urlsafe(32)
    session.add(AccountToken(token=token, account_id=account_id))
    await session.commit()
    return token


async def get_account_by_token(session: AsyncSession, token: str) -> Account | None:
    result = await session.exec(
        select(Account).join(AccountToken).where(AccountToken.token == token)
    )
    return result.one_or_none()


# ── Organization ──────────────────────────────────────────────────────────────

async def create_organization(session: AsyncSession, name: str, owner_id: str) -> Organization:
    org = Organization(id=str(uuid.uuid4()), name=name, owner_id=owner_id)
    session.add(org)
    await session.commit()
    await session.refresh(org)
    return org


async def get_organization_by_id(session: AsyncSession, organization_id: str) -> Organization | None:
    return await session.get(Organization, organization_id)


async def create_organization_member(
    session: AsyncSession,
    organization_id: str,
    name: str,
    email: str,
    role: str,
    account_id: Optional[str] = None,
) -> OrganizationMember:
    member = OrganizationMember(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        name=name,
        email=email,
        role=role,
        account_id=account_id,
    )
    session.add(member)
    await session.commit()
    await session.refresh(member)
    return member


async def get_organization_members(session: AsyncSession, organization_id: str) -> list[OrganizationMember]:
    result = await session.exec(
        select(OrganizationMember).where(OrganizationMember.organization_id == organization_id)
    )
    return list(result.all())


async def get_member_by_id(session: AsyncSession, member_id: str) -> OrganizationMember | None:
    return await session.get(OrganizationMember, member_id)


async def get_member_by_account_id(session: AsyncSession, account_id: str) -> OrganizationMember | None:
    result = await session.exec(
        select(OrganizationMember).where(OrganizationMember.account_id == account_id)
    )
    return result.first()


# ── Org Settings ──────────────────────────────────────────────────────────────

async def get_org_settings(session: AsyncSession, organization_id: str) -> OrgSettings | None:
    result = await session.exec(
        select(OrgSettings).where(OrgSettings.organization_id == organization_id)
    )
    return result.first()


async def upsert_org_ldap_config(session: AsyncSession, organization_id: str, ldap_config: dict) -> OrgSettings:
    settings = await get_org_settings(session, organization_id)
    if settings:
        settings.ldap_config = encrypt_data(ldap_config)
        settings.updated_at = datetime.utcnow()
    else:
        settings = OrgSettings(
            id=str(uuid.uuid4()),
            organization_id=organization_id,
            ldap_config=encrypt_data(ldap_config),
        )
    session.add(settings)
    await session.commit()
    await session.refresh(settings)
    return settings


# ── Service Templates ─────────────────────────────────────────────────────────

async def seed_builtin_templates(session: AsyncSession) -> None:
    existing = await session.exec(
        select(ServiceTemplate).where(ServiceTemplate.is_builtin == True).limit(1)  # noqa: E712
    )
    if existing.first():
        return
    for t in BUILTIN_TEMPLATES:
        session.add(ServiceTemplate(
            id=str(uuid.uuid4()),
            name=t["name"],
            service_slug=t["service_slug"],
            credential_type=t["credential_type"],
            fields_schema=json.dumps(t["fields_schema"]),
            is_builtin=True,
            organization_id=None,
        ))
    await session.commit()


async def get_templates(
    session: AsyncSession,
    organization_id: Optional[str] = None,
) -> list[ServiceTemplate]:
    stmt = select(ServiceTemplate).where(
        (ServiceTemplate.is_builtin == True) |  # noqa: E712
        (ServiceTemplate.organization_id == organization_id)
    )
    result = await session.exec(stmt)
    return list(result.all())


async def get_template_by_id(session: AsyncSession, template_id: str) -> ServiceTemplate | None:
    return await session.get(ServiceTemplate, template_id)


async def create_custom_template(
    session: AsyncSession,
    organization_id: str,
    name: str,
    service_slug: str,
    credential_type: str,
    fields_schema: list,
) -> ServiceTemplate:
    template = ServiceTemplate(
        id=str(uuid.uuid4()),
        name=name,
        service_slug=service_slug,
        credential_type=credential_type,
        fields_schema=json.dumps(fields_schema),
        is_builtin=False,
        organization_id=organization_id,
    )
    session.add(template)
    await session.commit()
    await session.refresh(template)
    return template


# ── Credentials ───────────────────────────────────────────────────────────────

async def create_credential(
    session: AsyncSession,
    organization_id: str,
    member_id: str,
    created_by_id: str,
    name: str,
    credential_type: str,
    fields: dict,
    template_id: Optional[str] = None,
    custom_fields_schema: Optional[list] = None,
    notes: Optional[str] = None,
) -> Credential:
    credential = Credential(
        id=str(uuid.uuid4()),
        name=name,
        credential_type=credential_type,
        template_id=template_id,
        organization_id=organization_id,
        member_id=member_id,
        created_by_id=created_by_id,
        encrypted_data=encrypt_data(fields),
        custom_fields_schema=json.dumps(custom_fields_schema) if custom_fields_schema else None,
        notes=notes,
    )
    session.add(credential)
    await session.commit()
    await session.refresh(credential)
    return credential


async def update_credential_data(session: AsyncSession, credential: Credential, new_data: dict) -> Credential:
    credential.encrypted_data = encrypt_data(new_data)
    session.add(credential)
    await session.commit()
    await session.refresh(credential)
    return credential


async def get_credentials_for_member(session: AsyncSession, member_id: str) -> list[Credential]:
    result = await session.exec(select(Credential).where(Credential.member_id == member_id))
    return list(result.all())


async def get_credential_by_id(session: AsyncSession, credential_id: str) -> Credential | None:
    return await session.get(Credential, credential_id)


async def delete_credential(session: AsyncSession, credential: Credential) -> None:
    await session.delete(credential)
    await session.commit()


# ── OAuth State ───────────────────────────────────────────────────────────────

async def create_oauth_state(session: AsyncSession, credential_id: str) -> str:
    state = secrets.token_urlsafe(32)
    session.add(OAuthState(state=state, credential_id=credential_id))
    await session.commit()
    return state


async def consume_oauth_state(session: AsyncSession, state: str) -> OAuthState | None:
    obj = await session.get(OAuthState, state)
    if obj:
        await session.delete(obj)
        await session.commit()
    return obj


# ── Helper: build CredentialResponse ─────────────────────────────────────────

def build_credential_response(credential: Credential, template: ServiceTemplate | None) -> dict:
    fields_data = decrypt_data(credential.encrypted_data)

    if template:
        schema = json.loads(template.fields_schema)
    elif credential.custom_fields_schema:
        schema = json.loads(credential.custom_fields_schema)
    else:
        schema = []

    if schema:
        field_values = [
            {
                "key": f["key"],
                "label": f["label"],
                "value": fields_data.get(f["key"], ""),
                "secret": f.get("secret", False),
            }
            for f in schema
        ]
    else:
        field_values = [
            {"key": k, "label": k, "value": str(v), "secret": False}
            for k, v in fields_data.items()
            if not k.startswith("_oauth_")  # hide internal OAuth token fields
        ]

    oauth_authorized = None
    if credential.credential_type == "oauth2":
        oauth_authorized = bool(fields_data.get("_oauth_access_token"))

    return {
        "id": credential.id,
        "name": credential.name,
        "credential_type": credential.credential_type,
        "template_id": credential.template_id,
        "template_name": template.name if template else None,
        "organization_id": credential.organization_id,
        "member_id": credential.member_id,
        "created_by_id": credential.created_by_id,
        "created_at": credential.created_at,
        "fields": field_values,
        "notes": credential.notes,
        "oauth_authorized": oauth_authorized,
    }
