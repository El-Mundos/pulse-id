from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..crud import (
    create_organization,
    create_organization_member,
    get_account_by_id,
    get_organization_by_id,
    get_organization_members,
)
from ..db import get_session
from ..schemas import MemberCreate, MemberResponse, OrganizationCreate, OrganizationDetail, OrganizationResponse

router = APIRouter(prefix="/orgs", tags=["orgs"])


@router.post("", response_model=OrganizationResponse)
async def create_organization_endpoint(
    body: OrganizationCreate,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    organization = await create_organization(session, body.name, user.id)
    return organization


@router.post("/{org_id}/members", response_model=MemberResponse)
async def add_organization_member(
    org_id: str,
    body: MemberCreate,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    organization = await get_organization_by_id(session, org_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    if organization.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organization owner can add members")

    if body.account_id is not None:
        account = await get_account_by_id(session, body.account_id)
        if not account:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Linked account_id does not exist")

    member = await create_organization_member(
        session,
        organization.id,
        body.name,
        body.email,
        body.role,
        body.account_id,
    )
    return member


@router.get("/{org_id}", response_model=OrganizationDetail)
async def get_organization_endpoint(
    org_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    organization = await get_organization_by_id(session, org_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    members = await get_organization_members(session, org_id)
    if organization.owner_id != user.id and not any(member.email == user.email for member in members):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return OrganizationDetail(
        id=organization.id,
        name=organization.name,
        owner_id=organization.owner_id,
        members=members,
    )