from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user, get_password_hash, verify_password
from ..crud import create_account, create_account_token, get_account_by_email
from ..db import get_session
from ..schemas import AccountCreate, AccountLogin, AuthResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register_account(body: AccountCreate, session: AsyncSession = Depends(get_session)):
    existing = await get_account_by_email(session, body.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    account = await create_account(session, body.email, body.name, get_password_hash(body.password))
    token = await create_account_token(session, account.id)

    return {
        "access_token": token,
        "user_id": account.id,
        "email": account.email,
        "name": account.name,
    }


@router.post("/login", response_model=AuthResponse)
async def login_account(body: AccountLogin, session: AsyncSession = Depends(get_session)):
    account = await get_account_by_email(session, body.email)
    if not account or not verify_password(body.password, account.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = await create_account_token(session, account.id)
    return {
        "access_token": token,
        "user_id": account.id,
        "email": account.email,
        "name": account.name,
    }


@router.get("/me")
async def get_profile(user = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
    }