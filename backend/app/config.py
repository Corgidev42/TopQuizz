import os
import socket
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    gemini_fallback_models: str = "gemini-2.0-flash"
    ollama_enabled: bool = False
    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "qwen3.5:9b"
    host: str = "0.0.0.0"
    port: int = 8000
    media_dir: str = "/app/media"
    redis_url: str = "redis://localhost:6379/0"
    database_url: str = "postgresql://topquizz:topquizz@postgres:5432/topquizz"
    # Jeton optionnel : header X-TopQuizz-Admin-Token pour accéder aux routes /admin
    # depuis une IP non locale (ex. téléphone hors Wi-Fi du labo).
    admin_token: str = Field(default="", validation_alias="TOPQUIZZ_ADMIN_TOKEN")

    @property
    def local_ip(self) -> str:
        # Correction: Forcer l'IP locale pour QR code
        forced_ip = os.getenv("TOPQUIZZ_LOCAL_IP")
        if forced_ip:
            return forced_ip
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"

    class Config:
        env_file = ".env"


settings = Settings()
