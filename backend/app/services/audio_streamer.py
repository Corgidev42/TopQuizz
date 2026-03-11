import os
import asyncio
import glob
from yt_dlp import YoutubeDL
from app.config import settings

class AudioStreamer:
    def __init__(self):
        self.download_path = os.path.join(settings.media_dir, "temp_blindtest")
        os.makedirs(self.download_path, exist_ok=True)

    async def search_and_download(self, query: str) -> str | None:
        """
        Search for a song on YouTube and download it as mp3.
        Returns the relative path to the file.
        """
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': f'{self.download_path}/%(id)s.%(ext)s',
            'quiet': True,
            'default_search': 'ytsearch1',
            'noplaylist': True,
        }

        loop = asyncio.get_event_loop()
        try:
            with YoutubeDL(ydl_opts) as ydl:
                # Run download in a separate thread to avoid blocking
                info = await loop.run_in_executor(None, lambda: ydl.extract_info(query, download=True))
                
                if 'entries' in info:
                    info = info['entries'][0]
                
                video_id = info['id']
                # yt-dlp might download as .webm or .m4a then convert to .mp3
                # The final filename will be video_id.mp3
                filename = f"{video_id}.mp3"
                filepath = os.path.join(self.download_path, filename)
                
                if os.path.exists(filepath):
                    return f"/media/temp_blindtest/{filename}"
                return None
        except Exception as e:
            print(f"[AudioStreamer] Error downloading {query}: {e}")
            return None

    def cleanup_old_files(self):
        """Remove old temporary files."""
        files = glob.glob(os.path.join(self.download_path, "*"))
        for f in files:
            try:
                os.remove(f)
            except Exception:
                pass

_instance: AudioStreamer | None = None

def get_audio_streamer() -> AudioStreamer:
    global _instance
    if _instance is None:
        _instance = AudioStreamer()
    return _instance
