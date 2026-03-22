import json
import redis.asyncio as aioredis

from app.config import settings

SESSION_TTL = 7200  # 2 hours


class RedisStore:
    def __init__(self):
        self._redis: aioredis.Redis | None = None

    async def connect(self):
        self._redis = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
        )
        try:
            await self._redis.ping()
            print("[Redis] Connected")
        except Exception as e:
            print(f"[Redis] Connection failed: {e}")
            self._redis = None

    @property
    def available(self) -> bool:
        return self._redis is not None

    async def save_session(self, game_id: str, session_dict: dict):
        if not self._redis:
            return
        key = f"session:{game_id}"
        await self._redis.set(key, json.dumps(session_dict), ex=SESSION_TTL)

    async def load_session(self, game_id: str) -> dict | None:
        if not self._redis:
            return None
        key = f"session:{game_id}"
        data = await self._redis.get(key)
        if data:
            return json.loads(data)
        return None

    async def delete_session(self, game_id: str):
        if not self._redis:
            return
        await self._redis.delete(f"session:{game_id}")

    async def list_session_ids(self) -> list[str]:
        if not self._redis:
            return []
        keys = await self._redis.keys("session:*")
        return [k.replace("session:", "") for k in keys]

    async def save_token_mapping(self, game_id: str, token: str, pseudo: str):
        """Map a player token to their pseudo for rejoin lookups."""
        if not self._redis:
            return
        key = f"token:{game_id}:{token}"
        await self._redis.set(key, pseudo, ex=SESSION_TTL)

    async def get_token_pseudo(self, game_id: str, token: str) -> str | None:
        if not self._redis:
            return None
        return await self._redis.get(f"token:{game_id}:{token}")

    async def save_host_token(self, game_id: str, token: str):
        if not self._redis:
            return
        await self._redis.set(f"host_token:{game_id}", token, ex=SESSION_TTL)

    async def get_host_token(self, game_id: str) -> str | None:
        if not self._redis:
            return None
        return await self._redis.get(f"host_token:{game_id}")

    async def save_tv_token(self, game_id: str, token: str):
        if not self._redis:
            return
        await self._redis.set(f"tv_token:{game_id}", token, ex=SESSION_TTL)

    async def get_tv_token(self, game_id: str) -> str | None:
        if not self._redis:
            return None
        return await self._redis.get(f"tv_token:{game_id}")


_store: RedisStore | None = None


async def get_redis_store() -> RedisStore:
    global _store
    if _store is None:
        _store = RedisStore()
        await _store.connect()
    return _store
