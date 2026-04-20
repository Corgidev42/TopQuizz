"""
Conftest: stub les modules non installés localement (asyncpg, redis, etc.)
pour permettre de lancer les tests sans le container Docker.
"""
import sys
import types
from unittest.mock import MagicMock


def _stub_module(name: str):
    """Crée un module stub récursivement."""
    parts = name.split(".")
    full = ""
    for part in parts:
        full = f"{full}.{part}" if full else part
        if full not in sys.modules:
            sys.modules[full] = types.ModuleType(full)


# Stubs pour les dépendances Docker-only
for mod in [
    "asyncpg",
    "redis",
    "redis.asyncio",
    "redis.exceptions",
    "socketio",
    "google",
    "google.generativeai",
    "yt_dlp",
    "PIL",
    "PIL.Image",
    "thefuzz",
    "thefuzz.fuzz",
    "httpx",
    "aiofiles",
    "pydantic_settings",
]:
    _stub_module(mod)

# pydantic_settings.BaseSettings minimal stub
class _BaseSettings:
    def __init__(self, **kwargs):
        pass
    class Config:
        env_file = ".env"

base_settings_mod = sys.modules.get("pydantic_settings", types.ModuleType("pydantic_settings"))
base_settings_mod.BaseSettings = _BaseSettings  # type: ignore
sys.modules["pydantic_settings"] = base_settings_mod
