import os
from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get("/list")
async def list_media():
    media_dir = os.path.join(settings.media_dir, "blindtest")
    if not os.path.exists(media_dir):
        return {"files": []}
    files = [
        f
        for f in os.listdir(media_dir)
        if f.lower().endswith((".mp3", ".mp4", ".wav", ".m4a"))
    ]
    return {"files": sorted(files)}
