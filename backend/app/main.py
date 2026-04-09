import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers.auth import router as auth_router
from .routers.orgs import router as orgs_router
from .routers.setup import router as setup_router

app = FastAPI(title="Pulse ID Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(setup_router)
app.include_router(auth_router)
app.include_router(orgs_router)


@app.on_event("startup")
async def on_startup() -> None:
    await init_db()
