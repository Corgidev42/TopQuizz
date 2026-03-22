from fastapi import APIRouter

from app.services.game_manager import game_manager, DEFAULT_PRESETS
from app.config import settings

router = APIRouter()


@router.get("/info")
async def get_game_info():
    return {
        "local_ip": settings.local_ip,
        "frontend_url": f"https://{settings.local_ip}",
        "backend_url": f"https://{settings.local_ip}",
    }


@router.get("/presets")
async def get_presets():
    return [p.model_dump() for p in DEFAULT_PRESETS]


@router.get("/{game_id}")
async def get_game_state(game_id: str):
    session = game_manager.get_session(game_id.upper())
    if not session:
        return {"error": "Game not found"}
    return session.to_dict()
