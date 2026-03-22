import os
import shutil
import asyncio
from yt_dlp import YoutubeDL
from app.config import settings


class AudioStreamer:
    def __init__(self):
        self.base_path = os.path.join(settings.media_dir, "temp_blindtest")
        os.makedirs(self.base_path, exist_ok=True)

    def _session_dir(self, game_id: str) -> str:
        path = os.path.join(self.base_path, game_id)
        os.makedirs(path, exist_ok=True)
        return path

    async def search_and_download(self, query: str, game_id: str = "default") -> str | None:
        """Search YouTube and download a 30s audio excerpt as mp3."""
        session_dir = self._session_dir(game_id)

        ydl_opts = {
            "format": "bestaudio/best",
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                },
            ],
            "outtmpl": f"{session_dir}/%(id)s.%(ext)s",
            "quiet": True,
            "default_search": "ytsearch1",
            "noplaylist": True,
            "download_ranges": _make_30s_range(),
            "force_keyframes_at_cuts": True,
        }

        loop = asyncio.get_event_loop()
        try:
            with YoutubeDL(ydl_opts) as ydl:
                info = await loop.run_in_executor(
                    None, lambda: ydl.extract_info(query, download=True)
                )

                if "entries" in info:
                    info = info["entries"][0]

                video_id = info["id"]
                filename = f"{video_id}.mp3"
                filepath = os.path.join(session_dir, filename)

                if os.path.exists(filepath):
                    return f"/media/temp_blindtest/{game_id}/{filename}"
                return None
        except Exception as e:
            print(f"[AudioStreamer] Error downloading {query}: {e}")
            return None

    def cleanup_session(self, game_id: str):
        """Remove all temp files for a specific game session."""
        session_dir = os.path.join(self.base_path, game_id)
        if os.path.isdir(session_dir):
            shutil.rmtree(session_dir, ignore_errors=True)
            print(f"[AudioStreamer] Cleaned up session {game_id}")

    def cleanup_all(self):
        """Remove all temporary blindtest files."""
        if os.path.isdir(self.base_path):
            for entry in os.listdir(self.base_path):
                full = os.path.join(self.base_path, entry)
                if os.path.isdir(full):
                    shutil.rmtree(full, ignore_errors=True)


def _make_30s_range():
    """Create a download_ranges callback that extracts 30s starting at 30s."""
    try:
        from yt_dlp.utils import download_range_func
        return download_range_func(None, [(30, 60)])
    except ImportError:
        return None


_instance: AudioStreamer | None = None


def get_audio_streamer() -> AudioStreamer:
    global _instance
    if _instance is None:
        _instance = AudioStreamer()
    return _instance
