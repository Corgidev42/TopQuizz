import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routes import game, host, media, ai
from app.sockets.events import register_events

fastapi_app = FastAPI(title="TopQuizz")

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fastapi_app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")

fastapi_app.include_router(game.router, prefix="/api/game", tags=["game"])
fastapi_app.include_router(host.router, prefix="/api/host", tags=["host"])
fastapi_app.include_router(media.router, prefix="/api/media", tags=["media"])
fastapi_app.include_router(ai.router, prefix="/api/ai", tags=["ai"])

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
)

register_events(sio)

app = socketio.ASGIApp(sio, fastapi_app)
