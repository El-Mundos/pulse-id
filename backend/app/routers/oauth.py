"""
OAuth 2.0 Authorization Code flow.

Flow:
  1. Admin calls POST /orgs/{org_id}/credentials/{cred_id}/oauth/initiate
     → returns authorization_url + state
  2. Admin (or member) visits authorization_url in browser, grants access
  3. Provider redirects to GET /oauth/callback?code=...&state=...
     → backend exchanges code for tokens, stores them encrypted in the credential
"""
import os
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from sqlmodel.ext.asyncio.session import AsyncSession

from ..auth import get_current_user
from ..crud import (
    consume_oauth_state,
    create_oauth_state,
    get_credential_by_id,
    get_organization_by_id,
    update_credential_data,
)
from ..crypto import decrypt_data
from ..db import get_session
from ..schemas import OAuthInitiateResponse, OAuthTokenInfo

router = APIRouter(tags=["oauth"])

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
_CALLBACK_URI = f"{BACKEND_URL}/oauth/callback"


@router.post(
    "/orgs/{org_id}/credentials/{credential_id}/oauth/initiate",
    response_model=OAuthInitiateResponse,
)
async def initiate_oauth(
    org_id: str,
    credential_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    org = await get_organization_by_id(session, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    if org.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    credential = await get_credential_by_id(session, credential_id)
    if not credential or credential.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")
    if credential.credential_type != "oauth2":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Credential is not OAuth2 type")

    fields = decrypt_data(credential.encrypted_data)
    auth_url = fields.get("auth_url", "").strip()
    client_id = fields.get("client_id", "").strip()
    scopes = fields.get("scopes", "").strip()

    if not auth_url or not client_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Credential must have auth_url and client_id set",
        )

    state = await create_oauth_state(session, credential_id)
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": _CALLBACK_URI,
        "state": state,
    }
    if scopes:
        params["scope"] = scopes

    return OAuthInitiateResponse(
        authorization_url=f"{auth_url}?{urlencode(params)}",
        state=state,
    )


@router.get("/oauth/callback")
async def oauth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    if error:
        return HTMLResponse(
            f"<h3>OAuth error: {error}</h3><p>{error_description}</p>",
            status_code=400,
        )
    if not code or not state:
        return HTMLResponse("<h3>Missing code or state</h3>", status_code=400)

    oauth_state = await consume_oauth_state(session, state)
    if not oauth_state:
        return HTMLResponse("<h3>Invalid or expired state</h3>", status_code=400)

    credential = await get_credential_by_id(session, oauth_state.credential_id)
    if not credential:
        return HTMLResponse("<h3>Credential not found</h3>", status_code=404)

    fields = decrypt_data(credential.encrypted_data)
    token_url = fields.get("token_url", "").strip()
    client_id = fields.get("client_id", "").strip()
    client_secret = fields.get("client_secret", "").strip()

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": _CALLBACK_URI,
                },
                headers={"Accept": "application/json"},
                timeout=10,
            )
            response.raise_for_status()
            token_data = response.json()
    except Exception as exc:
        return HTMLResponse(f"<h3>Token exchange failed</h3><p>{exc}</p>", status_code=502)

    # Merge tokens into the credential's encrypted data
    fields["_oauth_access_token"] = token_data.get("access_token", "")
    fields["_oauth_refresh_token"] = token_data.get("refresh_token", "")
    fields["_oauth_token_type"] = token_data.get("token_type", "")
    fields["_oauth_scope"] = token_data.get("scope", "")
    fields["_oauth_expires_in"] = str(token_data.get("expires_in", ""))
    await update_credential_data(session, credential, fields)

    return HTMLResponse(
        "<h3>✓ Authorized successfully</h3><p>You can close this window.</p>",
        status_code=200,
    )


@router.get(
    "/orgs/{org_id}/credentials/{credential_id}/oauth/status",
    response_model=OAuthTokenInfo,
)
async def oauth_status(
    org_id: str,
    credential_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    credential = await get_credential_by_id(session, credential_id)
    if not credential or credential.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    fields = decrypt_data(credential.encrypted_data)
    authorized = bool(fields.get("_oauth_access_token"))
    return OAuthTokenInfo(
        authorized=authorized,
        token_type=fields.get("_oauth_token_type") or None,
        scope=fields.get("_oauth_scope") or None,
    )
