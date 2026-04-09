"""Org-level settings endpoint (aggregates LDAP config, future OAuth providers, etc.)"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from ..auth import get_current_user
from ..crud import get_org_settings, get_organization_by_id
from ..crypto import decrypt_data
from ..db import get_session
from ..schemas import LdapConfigResponse, OrgSettingsResponse

router = APIRouter(prefix="/orgs/{org_id}/settings", tags=["settings"])


@router.get("", response_model=OrgSettingsResponse)
async def get_settings(
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
    ldap_response = None

    if settings and settings.ldap_config:
        cfg = decrypt_data(settings.ldap_config)
        ldap_response = LdapConfigResponse(
            host=cfg["host"],
            port=cfg.get("port", 389),
            base_dn=cfg["base_dn"],
            bind_dn=cfg["bind_dn"],
            use_ssl=cfg.get("use_ssl", False),
            user_search_filter=cfg.get("user_search_filter", "(objectClass=person)"),
            user_attributes=cfg.get("user_attributes", ["cn", "mail", "sAMAccountName", "uid"]),
        )

    return OrgSettingsResponse(
        organization_id=org_id,
        ldap_configured=ldap_response is not None,
        ldap_config=ldap_response,
        updated_at=settings.updated_at if settings else None,
    )
