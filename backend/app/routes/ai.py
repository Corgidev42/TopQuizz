from fastapi import APIRouter
import httpx

from app.config import settings

router = APIRouter()


@router.get("/ollama/models")
async def list_ollama_models():
    """
    Returns Ollama models available on the host (via settings.ollama_base_url).
    Expected Ollama endpoint: GET /api/tags
    """
    url = f"{settings.ollama_base_url.rstrip('/')}/api/tags"
    models: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json() or {}
            for m in data.get("models", []) or []:
                name = (m.get("name") or "").strip()
                if name:
                    models.append(name)
    except Exception:
        models = []

    # Dedupe while preserving order
    seen = set()
    ordered: list[str] = []
    for m in models:
        if m not in seen:
            ordered.append(m)
            seen.add(m)

    return {
        "ok": True,
        "base_url": settings.ollama_base_url,
        "models": ordered,
    }

