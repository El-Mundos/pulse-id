from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_password_hash
from ..crud import account_count, create_account, create_account_token
from ..db import get_session
from ..schemas import AccountCreate, AuthResponse

router = APIRouter(prefix="/setup", tags=["setup"])


@router.get("/status")
async def setup_status(session: AsyncSession = Depends(get_session)):
    count = await account_count(session)
    return {"needs_setup": count == 0}


@router.post("/complete", response_model=AuthResponse, status_code=201)
async def setup_complete(body: AccountCreate, session: AsyncSession = Depends(get_session)):
    count = await account_count(session)
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Setup already completed",
        )

    account = await create_account(session, body.email, body.name, get_password_hash(body.password))
    token = await create_account_token(session, account.id)

    return {
        "access_token": token,
        "user_id": account.id,
        "email": account.email,
        "name": account.name,
    }
