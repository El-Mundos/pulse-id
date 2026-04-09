from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import get_session, init_db
from .routers.auth import router as auth_router
from .routers.credentials import router as credentials_router
from .routers.ldap_router import router as ldap_router
from .routers.oauth import router as oauth_router
from .routers.orgs import router as orgs_router
from .routers.settings import router as settings_router

app = FastAPI(title="Pulse ID Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(orgs_router)
app.include_router(credentials_router)
app.include_router(oauth_router)
app.include_router(ldap_router)
app.include_router(settings_router)


@app.on_event("startup")
async def on_startup() -> None:
    await init_db()
    from .crud import seed_builtin_templates
    async for session in get_session():
        await seed_builtin_templates(session)
        break
