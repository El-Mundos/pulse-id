from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import get_session, init_db
from .routers.auth import router as auth_router
from .routers.credentials import router as credentials_router
from .routers.orgs import router as orgs_router

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


@app.on_event("startup")
async def on_startup() -> None:
    await init_db()
    # Seed builtin credential templates
    from .crud import seed_builtin_templates
    async for session in get_session():
        await seed_builtin_templates(session)
        break
