"""
LDAP integration endpoints.

Uses ldap3 (sync) run inside asyncio.to_thread to avoid blocking the event loop.
Supports both Active Directory (sAMAccountName) and OpenLDAP (uid).
"""
import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from ldap3 import ALL, SIMPLE, Connection, Server
from ldap3.core.exceptions import LDAPException
from sqlmodel.ext.asyncio.session import AsyncSession

from ..auth import get_current_user
from ..crud import (
    get_credential_by_id,
    get_org_settings,
    get_organization_by_id,
    upsert_org_ldap_config,
)
from ..crypto import decrypt_data
from ..db import get_session
from ..schemas import LdapAuthRequest, LdapConfig, LdapConfigResponse, LdapTestResult

router = APIRouter(prefix="/orgs/{org_id}", tags=["ldap"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_server(cfg: dict) -> Server:
    return Server(
        cfg["host"],
        port=int(cfg.get("port", 389)),
        use_ssl=cfg.get("use_ssl", False),
        get_info=ALL,
        connect_timeout=5,
    )


def _sync_test_connection(cfg: dict) -> LdapTestResult:
    try:
        server = _build_server(cfg)
        conn = Connection(
            server,
            user=cfg["bind_dn"],
            password=cfg["bind_password"],
            authentication=SIMPLE,
            raise_exceptions=True,
        )
        conn.bind()

        search_filter = cfg.get("user_search_filter", "(objectClass=person)")
        attrs = cfg.get("user_attributes", ["cn", "mail", "sAMAccountName", "uid"])
        conn.search(cfg["base_dn"], search_filter, attributes=attrs, size_limit=5)

        sample: list[dict[str, Any]] = []
        for entry in conn.entries:
            sample.append({attr: str(entry[attr]) for attr in attrs if attr in entry})

        conn.unbind()
        return LdapTestResult(
            success=True,
            message=f"Connected to {cfg['host']}. Found entries matching filter.",
            user_count=len(conn.entries),
            sample_users=sample,
        )
    except LDAPException as exc:
        return LdapTestResult(success=False, message=str(exc))
    except Exception as exc:
        return LdapTestResult(success=False, message=f"Unexpected error: {exc}")


def _sync_authenticate_user(cfg: dict, username: str, password: str, username_attr: str) -> dict:
    try:
        server = _build_server(cfg)
        # First: find the user's DN
        admin_conn = Connection(
            server,
            user=cfg["bind_dn"],
            password=cfg["bind_password"],
            authentication=SIMPLE,
            raise_exceptions=True,
        )
        admin_conn.bind()
        search_filter = f"({username_attr}={username})"
        admin_conn.search(cfg["base_dn"], search_filter, attributes=["dn", "cn", "mail"])

        if not admin_conn.entries:
            admin_conn.unbind()
            return {"success": False, "message": f"User '{username}' not found"}

        user_dn = admin_conn.entries[0].entry_dn
        admin_conn.unbind()

        # Second: bind as the user to verify password
        user_conn = Connection(
            server,
            user=user_dn,
            password=password,
            authentication=SIMPLE,
            raise_exceptions=True,
        )
        user_conn.bind()
        user_conn.unbind()
        return {"success": True, "message": "Authentication successful", "user_dn": user_dn}
    except LDAPException as exc:
        return {"success": False, "message": str(exc)}
    except Exception as exc:
        return {"success": False, "message": f"Unexpected error: {exc}"}


# ── Admin: configure org LDAP server ─────────────────────────────────────────

@router.put("/settings/ldap", response_model=LdapConfigResponse)
async def configure_ldap(
    org_id: str,
    body: LdapConfig,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Save (or update) the LDAP server configuration for this org."""
    org = await get_organization_by_id(session, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    if org.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    await upsert_org_ldap_config(session, org_id, body.model_dump())
    return LdapConfigResponse(
        host=body.host,
        port=body.port,
        base_dn=body.base_dn,
        bind_dn=body.bind_dn,
        use_ssl=body.use_ssl,
        user_search_filter=body.user_search_filter,
        user_attributes=body.user_attributes,
    )


@router.get("/settings/ldap", response_model=LdapConfigResponse)
async def get_ldap_config(
    org_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    org = await get_organization_by_id(session, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    if org.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    settings = await get_org_settings(session, org_id)
    if not settings or not settings.ldap_config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LDAP not configured for this organization")

    cfg = decrypt_data(settings.ldap_config)
    return LdapConfigResponse(
        host=cfg["host"],
        port=cfg.get("port", 389),
        base_dn=cfg["base_dn"],
        bind_dn=cfg["bind_dn"],
        use_ssl=cfg.get("use_ssl", False),
        user_search_filter=cfg.get("user_search_filter", "(objectClass=person)"),
        user_attributes=cfg.get("user_attributes", ["cn", "mail", "sAMAccountName", "uid"]),
    )


@router.post("/settings/ldap/test", response_model=LdapTestResult)
async def test_ldap_connection(
    org_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Test the saved LDAP configuration: bind and run a sample search."""
    org = await get_organization_by_id(session, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    if org.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    settings = await get_org_settings(session, org_id)
    if not settings or not settings.ldap_config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LDAP not configured")

    cfg = decrypt_data(settings.ldap_config)
    result = await asyncio.to_thread(_sync_test_connection, cfg)
    return result


# ── Member LDAP credential: authenticate against org LDAP ────────────────────

@router.post("/credentials/{credential_id}/ldap/auth")
async def ldap_authenticate(
    org_id: str,
    credential_id: str,
    body: LdapAuthRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Authenticate a member's LDAP credential against the org's LDAP server.
    Uses the credential's stored username/password if body fields are empty.
    """
    org = await get_organization_by_id(session, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    credential = await get_credential_by_id(session, credential_id)
    if not credential or credential.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")
    if credential.credential_type != "ldap":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not an LDAP credential")

    # Admin or the credential's member
    is_admin = org.owner_id == user.id
    from ..crud import get_member_by_id
    member = await get_member_by_id(session, credential.member_id)
    is_self = member and member.account_id == user.id
    if not is_admin and not is_self:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    settings = await get_org_settings(session, org_id)
    if not settings or not settings.ldap_config:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="LDAP server not configured for this org")

    ldap_cfg = decrypt_data(settings.ldap_config)
    cred_fields = decrypt_data(credential.encrypted_data)

    username = body.username or cred_fields.get("username", "")
    password = body.password or cred_fields.get("password", "")

    result = await asyncio.to_thread(
        _sync_authenticate_user, ldap_cfg, username, password, body.username_attr
    )
    return result
