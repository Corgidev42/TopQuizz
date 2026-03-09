from fastapi import APIRouter

from app.services.game_manager import game_manager

router = APIRouter()


@router.get("/sessions")
async def list_sessions():
    return {
        gid: {
            "phase": s.phase.value,
            "player_count": len(s.players),
        }
        for gid, s in game_manager.sessions.items()
    }
