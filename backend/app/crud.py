import secrets
import uuid

from sqlmodel import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Account, AccountToken, Organization, OrganizationMember


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


async def account_count(session: AsyncSession) -> int:
    from sqlalchemy import func
    result = await session.exec(select(func.count()).select_from(Account))
    return result.one()


async def get_account_by_email(session: AsyncSession, email: str) -> Account | None:
    result = await session.execute(select(Account).where(Account.email == email))
    return result.scalars().one_or_none()


async def get_account_by_id(session: AsyncSession, account_id: str) -> Account | None:
    result = await session.get(Account, account_id)
    return result


async def create_account_token(session: AsyncSession, account_id: str) -> str:
    token = secrets.token_urlsafe(32)
    account_token = AccountToken(token=token, account_id=account_id)
    session.add(account_token)
    await session.commit()
    return token


async def get_account_by_token(session: AsyncSession, token: str) -> Account | None:
    statement = select(Account).join(AccountToken).where(AccountToken.token == token)
    result = await session.execute(statement)
    return result.scalars().one_or_none()


async def create_organization(session: AsyncSession, name: str, owner_id: str) -> Organization:
    organization = Organization(id=str(uuid.uuid4()), name=name, owner_id=owner_id)
    session.add(organization)
    await session.commit()
    await session.refresh(organization)
    return organization


async def get_organization_by_id(session: AsyncSession, organization_id: str) -> Organization | None:
    result = await session.get(Organization, organization_id)
    return result


async def create_organization_member(
    session: AsyncSession,
    organization_id: str,
    name: str,
    email: str,
    role: str,
    account_id: str | None = None,
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
    result = await session.execute(select(OrganizationMember).where(OrganizationMember.organization_id == organization_id))
    return result.scalars().all()
