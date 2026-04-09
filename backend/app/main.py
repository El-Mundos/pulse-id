from fastapi import FastAPI

from .db import init_db
from .routers.auth import router as auth_router
from .routers.orgs import router as orgs_router
from .routers.setup import router as setup_router

app = FastAPI(title="Pulse ID Backend")
app.include_router(setup_router)
app.include_router(auth_router)
app.include_router(orgs_router)


@app.on_event("startup")
async def on_startup() -> None:
    await init_db()
