import logging
import socketio
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.config import settings
from app.http_utils import client_ip, request_id_for
from app.routes import game, host, media, ai, players
from app.services import audit_service
from app.services import db_store
from app.services.game_manager import game_manager
from app.sockets.events import register_events

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s [%(name)s] %(message)s",
)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Corrélation des logs / audit (header X-Request-ID réutilisable côté client)."""

    async def dispatch(self, request: Request, call_next):
        header_rid = (request.headers.get("x-request-id") or "").strip()
        rid = header_rid or uuid.uuid4().hex[:16]
        request.state.request_id = rid
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await db_store.get_pool()
        print("[Startup] PostgreSQL ready")
    except Exception as e:
        print(f"[Startup] PostgreSQL unavailable: {e} — accounts will fail until DB is up")
    await game_manager.init_redis()
    yield
    await db_store.close_pool()


fastapi_app = FastAPI(title="TopQuizz", lifespan=lifespan)


def _validation_errors_fr(errors: list) -> str:
    """Messages lisibles sur mobile (évite detail[] que certains clients n’affichent pas bien)."""
    parts: list[str] = []
    for err in errors:
        loc = err.get("loc") or ()
        field = str(loc[-1]) if loc else ""
        if field == "email":
            parts.append("Email invalide")
        elif field == "password":
            parts.append("Mot de passe : au moins 6 caractères")
        elif field == "display_name":
            parts.append("Pseudo : au moins 2 caractères")
        else:
            parts.append(str(err.get("msg", "Champ invalide")))
    seen_fields: set[str] = set()
    uniq: list[str] = []
    for p in parts:
        if p not in seen_fields:
            seen_fields.add(p)
            uniq.append(p)
    return " · ".join(uniq) if uniq else "Données invalides"


@fastapi_app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(
    request: Request, exc: RequestValidationError
):
    detail_fr = _validation_errors_fr(exc.errors())
    path = request.url.path
    if path in ("/api/players/register", "/api/players/login"):
        vkind = "register" if path.endswith("/register") else "login"
        await audit_service.record_auth_audit(
            request_id=request_id_for(request),
            kind=vkind,
            success=False,
            reason_code="validation_error",
            public_message=detail_fr,
            http_status=422,
            client_ip=client_ip(request),
            user_agent=(request.headers.get("user-agent") or "")[:400],
            email_raw=None,
            internal_detail=str(exc.errors())[:800],
        )
    return JSONResponse(
        status_code=422,
        content={"detail": detail_fr},
    )


fastapi_app.add_middleware(RequestIDMiddleware)
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
fastapi_app.include_router(players.router, prefix="/api/players", tags=["players"])

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
)

register_events(sio)

app = socketio.ASGIApp(sio, fastapi_app)
