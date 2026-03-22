"""
Comptes joueurs persistés dans Redis : email, mot de passe (bcrypt), avatar emoji, stats et historique.
"""
from __future__ import annotations

import json
import time
import uuid
from passlib.context import CryptContext

from app.services.redis_store import get_redis_store

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TOKEN_TTL_SEC = 30 * 24 * 3600  # 30 jours
HISTORY_MAX = 100
EMAIL_PREFIX = "acct:email:"
USER_PREFIX = "acct:user:"
TOKEN_PREFIX = "acct:tok:"
LB_SCORE = "acct:lb:score"
LB_WINS = "acct:lb:wins"
HIST_PREFIX = "acct:hist:"


def _norm_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


async def _redis():
    store = await get_redis_store()
    return store.client()


async def register_user(email: str, password: str, display_name: str) -> tuple[str, dict] | tuple[None, str]:
    r = await _redis()
    if not r:
        return None, "redis_unavailable"

    email_n = _norm_email(email)
    if not email_n or "@" not in email_n:
        return None, "invalid_email"
    if len(password) < 6:
        return None, "password_too_short"
    name = display_name.strip()
    if len(name) < 2:
        return None, "name_too_short"

    if await r.exists(f"{EMAIL_PREFIX}{email_n}"):
        return None, "email_taken"

    uid = uuid.uuid4().hex
    now = int(time.time())
    user = {
        "id": uid,
        "email": email_n,
        "password_hash": hash_password(password),
        "display_name": name,
        "avatar_emoji": "🎮",
        "games_played": 0,
        "total_score": 0,
        "wins": 0,
        "created_at": now,
    }
    pipe = r.pipeline()
    pipe.set(f"{USER_PREFIX}{uid}", json.dumps(user))
    pipe.set(f"{EMAIL_PREFIX}{email_n}", uid)
    await pipe.execute()

    token = uuid.uuid4().hex
    await r.set(f"{TOKEN_PREFIX}{token}", uid, ex=TOKEN_TTL_SEC)
    await r.zadd(LB_SCORE, {uid: 0})
    await r.zadd(LB_WINS, {uid: 0})

    pub = public_user(user)
    return token, pub


async def login_user(email: str, password: str) -> tuple[str, dict] | tuple[None, str]:
    r = await _redis()
    if not r:
        return None, "redis_unavailable"

    email_n = _norm_email(email)
    uid = await r.get(f"{EMAIL_PREFIX}{email_n}")
    if not uid:
        return None, "invalid_credentials"

    raw = await r.get(f"{USER_PREFIX}{uid}")
    if not raw:
        return None, "invalid_credentials"

    user = json.loads(raw)
    if not verify_password(password, user.get("password_hash", "")):
        return None, "invalid_credentials"

    token = uuid.uuid4().hex
    await r.set(f"{TOKEN_PREFIX}{token}", uid, ex=TOKEN_TTL_SEC)
    return token, public_user(user)


async def resolve_auth_token(token: str) -> str | None:
    if not token:
        return None
    r = await _redis()
    if not r:
        return None
    uid = await r.get(f"{TOKEN_PREFIX}{token.strip()}")
    return uid


async def refresh_token_ttl(token: str):
    r = await _redis()
    if r and token:
        await r.expire(f"{TOKEN_PREFIX}{token.strip()}", TOKEN_TTL_SEC)


async def get_user_by_id(uid: str) -> dict | None:
    r = await _redis()
    if not r:
        return None
    raw = await r.get(f"{USER_PREFIX}{uid}")
    if not raw:
        return None
    return json.loads(raw)


def public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "display_name": user.get("display_name", ""),
        "avatar_emoji": user.get("avatar_emoji") or "🎮",
        "games_played": user.get("games_played", 0),
        "total_score": user.get("total_score", 0),
        "wins": user.get("wins", 0),
        "created_at": user.get("created_at", 0),
    }


async def update_user_profile(uid: str, display_name: str | None, avatar_emoji: str | None) -> dict | None:
    user = await get_user_by_id(uid)
    if not user:
        return None
    if display_name is not None:
        dn = display_name.strip()
        if len(dn) >= 2:
            user["display_name"] = dn
    if avatar_emoji is not None:
        em = avatar_emoji.strip()
        if len(em) <= 8:
            user["avatar_emoji"] = em or "🎮"

    r = await _redis()
    if not r:
        return None
    await r.set(f"{USER_PREFIX}{uid}", json.dumps(user))
    return public_user(user)


async def record_game_for_user(
    uid: str,
    game_id: str,
    pseudo_in_game: str,
    score: int,
    rank: int,
    total_players: int,
    won: bool,
):
    """Met à jour stats + historique + leaderboards."""
    user = await get_user_by_id(uid)
    if not user:
        return

    user["games_played"] = user.get("games_played", 0) + 1
    user["total_score"] = user.get("total_score", 0) + int(score)
    if won:
        user["wins"] = user.get("wins", 0) + 1

    r = await _redis()
    if not r:
        return

    entry = {
        "game_id": game_id,
        "pseudo_in_game": pseudo_in_game,
        "score": score,
        "rank": rank,
        "total_players": total_players,
        "won": won,
        "at": int(time.time()),
    }
    hist_key = f"{HIST_PREFIX}{uid}"
    await r.lpush(hist_key, json.dumps(entry))
    await r.ltrim(hist_key, 0, HISTORY_MAX - 1)

    await r.set(f"{USER_PREFIX}{uid}", json.dumps(user))
    await r.zadd(LB_SCORE, {uid: user["total_score"]})
    await r.zadd(LB_WINS, {uid: user["wins"]})


async def get_leaderboard(sort: str = "score", limit: int = 50) -> list[dict]:
    r = await _redis()
    if not r:
        return []
    key = LB_SCORE if sort == "score" else LB_WINS
    # ZREVRANGE with scores
    rows = await r.zrevrange(key, 0, limit - 1, withscores=True)
    out: list[dict] = []
    rank = 1
    for uid, sc in rows:
        u = await get_user_by_id(uid)
        if not u:
            continue
        out.append(
            {
                "rank": rank,
                "display_name": u.get("display_name", "?"),
                "avatar_emoji": u.get("avatar_emoji") or "🎮",
                "total_score": u.get("total_score", 0),
                "wins": u.get("wins", 0),
                "games_played": u.get("games_played", 0),
                "sort_value": int(sc),
            }
        )
        rank += 1
    return out


async def get_history(uid: str, limit: int = 50) -> list[dict]:
    r = await _redis()
    if not r:
        return []
    items = await r.lrange(f"{HIST_PREFIX}{uid}", 0, limit - 1)
    result: list[dict] = []
    for raw in items:
        try:
            result.append(json.loads(raw))
        except Exception:
            pass
    return result


# ---------------------------------------------------------------------------
# Admin helpers
# ---------------------------------------------------------------------------

async def list_all_users() -> list[dict]:
    r = await _redis()
    if not r:
        return []
    keys = []
    cursor = "0"
    while True:
        cursor, batch = await r.scan(cursor=cursor, match=f"{USER_PREFIX}*", count=200)
        keys.extend(batch)
        if cursor == 0 or cursor == "0":
            break
    users: list[dict] = []
    for k in keys:
        raw = await r.get(k)
        if raw:
            try:
                users.append(public_user(json.loads(raw)))
            except Exception:
                pass
    users.sort(key=lambda u: u.get("created_at", 0), reverse=True)
    return users


async def admin_reset_password(uid: str, new_password: str) -> bool:
    if len(new_password) < 6:
        return False
    user = await get_user_by_id(uid)
    if not user:
        return False
    user["password_hash"] = hash_password(new_password)
    r = await _redis()
    if not r:
        return False
    await r.set(f"{USER_PREFIX}{uid}", json.dumps(user))
    return True


async def admin_delete_user(uid: str) -> bool:
    user = await get_user_by_id(uid)
    if not user:
        return False
    r = await _redis()
    if not r:
        return False
    email_n = _norm_email(user.get("email", ""))
    pipe = r.pipeline()
    pipe.delete(f"{USER_PREFIX}{uid}")
    if email_n:
        pipe.delete(f"{EMAIL_PREFIX}{email_n}")
    pipe.zrem(LB_SCORE, uid)
    pipe.zrem(LB_WINS, uid)
    pipe.delete(f"{HIST_PREFIX}{uid}")
    await pipe.execute()

    # Invalidate all tokens for this user (scan is acceptable for admin ops)
    tok_cursor = "0"
    while True:
        tok_cursor, tok_batch = await r.scan(
            cursor=tok_cursor, match=f"{TOKEN_PREFIX}*", count=500
        )
        for tk in tok_batch:
            val = await r.get(tk)
            if val == uid:
                await r.delete(tk)
        if tok_cursor == 0 or tok_cursor == "0":
            break
    return True
