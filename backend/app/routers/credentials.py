import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from ..auth import get_current_user
from ..crud import (
    build_credential_response,
    create_credential,
    create_custom_template,
    delete_credential,
    get_credential_by_id,
    get_credentials_for_member,
    get_member_by_account_id,
    get_member_by_id,
    get_organization_by_id,
    get_organization_members,
    get_template_by_id,
    get_templates,
)
from ..db import get_session
from ..schemas import (
    CredentialCreate,
    CredentialResponse,
    CustomTemplateCreate,
    FieldDef,
    ServiceTemplateResponse,
)

router = APIRouter(tags=["credentials"])


# ── Helper ────────────────────────────────────────────────────────────────────

async def _require_org_admin(org_id: str, user, session: AsyncSession):
    org = await get_organization_by_id(session, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    if org.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return org


# ── Templates ─────────────────────────────────────────────────────────────────

@router.get("/orgs/{org_id}/templates", response_model=list[ServiceTemplateResponse])
async def list_templates(
    org_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    org = await get_organization_by_id(session, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    members = await get_organization_members(session, org_id)
    if org.owner_id != user.id and not any(m.email == user.email for m in members):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    templates = await get_templates(session, org_id)
    return [
        ServiceTemplateResponse(
            id=t.id,
            name=t.name,
            service_slug=t.service_slug,
            credential_type=t.credential_type,
            fields_schema=[FieldDef(**f) for f in json.loads(t.fields_schema)],
            is_builtin=t.is_builtin,
            organization_id=t.organization_id,
        )
        for t in templates
    ]


@router.post("/orgs/{org_id}/templates", response_model=ServiceTemplateResponse, status_code=201)
async def create_template(
    org_id: str,
    body: CustomTemplateCreate,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_org_admin(org_id, user, session)
    template = await create_custom_template(
        session,
        organization_id=org_id,
        name=body.name,
        service_slug=body.service_slug,
        credential_type=body.credential_type,
        fields_schema=[f.model_dump() for f in body.fields_schema],
    )
    return ServiceTemplateResponse(
        id=template.id,
        name=template.name,
        service_slug=template.service_slug,
        credential_type=template.credential_type,
        fields_schema=[FieldDef(**f) for f in json.loads(template.fields_schema)],
        is_builtin=template.is_builtin,
        organization_id=template.organization_id,
    )


# ── Credentials ───────────────────────────────────────────────────────────────

@router.post(
    "/orgs/{org_id}/members/{member_id}/credentials",
    response_model=CredentialResponse,
    status_code=201,
)
async def add_credential(
    org_id: str,
    member_id: str,
    body: CredentialCreate,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_org_admin(org_id, user, session)

    member = await get_member_by_id(session, member_id)
    if not member or member.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    template = None
    if body.template_id:
        template = await get_template_by_id(session, body.template_id)
        if not template:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    if body.credential_type == "api_custom" and not body.template_id and not body.custom_fields_schema:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="custom_fields_schema required for api_custom credentials without a template",
        )

    custom_schema = (
        [f.model_dump() for f in body.custom_fields_schema]
        if body.custom_fields_schema else None
    )

    credential = await create_credential(
        session,
        organization_id=org_id,
        member_id=member_id,
        created_by_id=user.id,
        name=body.name,
        credential_type=body.credential_type,
        fields=body.fields,
        template_id=body.template_id,
        custom_fields_schema=custom_schema,
        notes=body.notes,
    )
    return build_credential_response(credential, template)


@router.get(
    "/orgs/{org_id}/members/{member_id}/credentials",
    response_model=list[CredentialResponse],
)
async def list_member_credentials(
    org_id: str,
    member_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    org = await get_organization_by_id(session, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    member = await get_member_by_id(session, member_id)
    if not member or member.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    # Admin or the member themselves
    is_admin = org.owner_id == user.id
    is_self = member.account_id == user.id
    if not is_admin and not is_self:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    credentials = await get_credentials_for_member(session, member_id)
    result = []
    for c in credentials:
        template = await get_template_by_id(session, c.template_id) if c.template_id else None
        result.append(build_credential_response(c, template))
    return result


@router.delete("/orgs/{org_id}/credentials/{credential_id}", status_code=204)
async def remove_credential(
    org_id: str,
    credential_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_org_admin(org_id, user, session)

    credential = await get_credential_by_id(session, credential_id)
    if not credential or credential.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    await delete_credential(session, credential)


@router.get("/me/credentials", response_model=list[CredentialResponse])
async def my_credentials(
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Returns all credentials assigned to the logged-in user's member record."""
    member = await get_member_by_account_id(session, user.id)
    if not member:
        return []

    credentials = await get_credentials_for_member(session, member.id)
    result = []
    for c in credentials:
        template = await get_template_by_id(session, c.template_id) if c.template_id else None
        result.append(build_credential_response(c, template))
    return result
