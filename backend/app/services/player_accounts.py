"""
Comptes joueurs persistés dans PostgreSQL.
Redis reste dédié aux sessions de jeu temps réel.
"""
from __future__ import annotations

import time
import uuid
from passlib.context import CryptContext

from app.services.db_store import get_pool

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
TOKEN_TTL_SEC = 30 * 24 * 3600  # 30 jours
HISTORY_MAX = 100


def _norm_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def public_user(row: dict) -> dict:
    return {
        "id": row["id"],
        "email": row["email"],
        "display_name": row.get("display_name", ""),
        "avatar_emoji": row.get("avatar_emoji") or "🎮",
        "games_played": row.get("games_played", 0),
        "total_score": row.get("total_score", 0),
        "wins": row.get("wins", 0),
        "created_at": row.get("created_at", 0),
    }


async def register_user(
    email: str, password: str, display_name: str
) -> tuple[str, dict] | tuple[None, str]:
    try:
        pool = await get_pool()
    except Exception as e:
        print(f"[player_accounts] DB unavailable: {e}")
        return None, "db_unavailable"

    email_n = _norm_email(email)
    if not email_n or "@" not in email_n:
        return None, "invalid_email"
    if len(password) < 6:
        return None, "password_too_short"
    name = display_name.strip()
    if len(name) < 2:
        return None, "name_too_short"

    try:
        async with pool.acquire() as conn:
            existing = await conn.fetchrow(
                "SELECT id FROM users WHERE email = $1", email_n
            )
            if existing:
                return None, "email_taken"

            uid = uuid.uuid4().hex
            now = int(time.time())
            password_hash = hash_password(password)

            await conn.execute(
                """
                INSERT INTO users (id, email, password_hash, display_name, avatar_emoji, created_at)
                VALUES ($1, $2, $3, $4, '🎮', $5)
                """,
                uid, email_n, password_hash, name, now,
            )

            token = uuid.uuid4().hex
            expires_at = now + TOKEN_TTL_SEC
            await conn.execute(
                "INSERT INTO player_sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
                token, uid, expires_at,
            )

        user = {
            "id": uid,
            "email": email_n,
            "display_name": name,
            "avatar_emoji": "🎮",
            "games_played": 0,
            "total_score": 0,
            "wins": 0,
            "created_at": now,
        }
        return token, public_user(user)

    except Exception as e:
        print(f"[player_accounts] register error: {e}")
        return None, "db_error"


async def login_user(
    email: str, password: str
) -> tuple[str, dict] | tuple[None, str]:
    try:
        pool = await get_pool()
    except Exception as e:
        print(f"[player_accounts] DB unavailable: {e}")
        return None, "db_unavailable"

    email_n = _norm_email(email)
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM users WHERE email = $1", email_n
            )
            if not row:
                return None, "invalid_credentials"

            if not verify_password(password, row["password_hash"]):
                return None, "invalid_credentials"

            token = uuid.uuid4().hex
            now = int(time.time())
            expires_at = now + TOKEN_TTL_SEC
            await conn.execute(
                "INSERT INTO player_sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
                token, row["id"], expires_at,
            )

        return token, public_user(dict(row))

    except Exception as e:
        print(f"[player_accounts] login error: {e}")
        return None, "db_error"


async def resolve_auth_token(token: str) -> str | None:
    if not token:
        return None
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            now = int(time.time())
            row = await conn.fetchrow(
                "SELECT user_id FROM player_sessions WHERE token = $1 AND expires_at > $2",
                token.strip(), now,
            )
            return row["user_id"] if row else None
    except Exception as e:
        print(f"[player_accounts] resolve_auth_token error: {e}")
        return None


async def refresh_token_ttl(token: str):
    try:
        pool = await get_pool()
        now = int(time.time())
        new_expiry = now + TOKEN_TTL_SEC
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE player_sessions SET expires_at = $1 WHERE token = $2",
                new_expiry, token.strip(),
            )
    except Exception as e:
        print(f"[player_accounts] refresh_token_ttl error: {e}")


async def get_user_by_id(uid: str) -> dict | None:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", uid)
            return dict(row) if row else None
    except Exception as e:
        print(f"[player_accounts] get_user_by_id error: {e}")
        return None


async def update_user_profile(
    uid: str, display_name: str | None, avatar_emoji: str | None
) -> dict | None:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", uid)
            if not row:
                return None

            updates = []
            values: list = []
            idx = 1

            if display_name is not None:
                dn = display_name.strip()
                if len(dn) >= 2:
                    updates.append(f"display_name = ${idx}")
                    values.append(dn)
                    idx += 1

            if avatar_emoji is not None:
                em = avatar_emoji.strip()
                if len(em) <= 8:
                    updates.append(f"avatar_emoji = ${idx}")
                    values.append(em or "🎮")
                    idx += 1

            if not updates:
                return public_user(dict(row))

            values.append(uid)
            await conn.execute(
                f"UPDATE users SET {', '.join(updates)} WHERE id = ${idx}",
                *values,
            )
            row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", uid)
            return public_user(dict(row)) if row else None

    except Exception as e:
        print(f"[player_accounts] update_user_profile error: {e}")
        return None


async def record_game_for_user(
    uid: str,
    game_id: str,
    pseudo_in_game: str,
    score: int,
    rank: int,
    total_players: int,
    won: bool,
):
    try:
        pool = await get_pool()
        now = int(time.time())
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO game_history (user_id, game_id, pseudo_in_game, score, rank, total_players, won, played_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """,
                uid, game_id, pseudo_in_game, score, rank, total_players, won, now,
            )
            await conn.execute(
                """
                UPDATE users SET
                    games_played = games_played + 1,
                    total_score  = total_score + $1,
                    wins         = wins + $2
                WHERE id = $3
                """,
                int(score), 1 if won else 0, uid,
            )
    except Exception as e:
        print(f"[player_accounts] record_game_for_user error: {e}")


async def get_leaderboard(sort: str = "score", limit: int = 50) -> list[dict]:
    try:
        pool = await get_pool()
        order_col = "total_score" if sort == "score" else "wins"
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT id, display_name, avatar_emoji, total_score, wins, games_played
                FROM users
                ORDER BY {order_col} DESC
                LIMIT $1
                """,
                limit,
            )
        out = []
        for i, row in enumerate(rows):
            out.append({
                "rank": i + 1,
                "display_name": row["display_name"],
                "avatar_emoji": row["avatar_emoji"] or "🎮",
                "total_score": row["total_score"],
                "wins": row["wins"],
                "games_played": row["games_played"],
                "sort_value": row[order_col],
            })
        return out
    except Exception as e:
        print(f"[player_accounts] get_leaderboard error: {e}")
        return []


async def get_history(uid: str, limit: int = 50) -> list[dict]:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT game_id, pseudo_in_game, score, rank, total_players, won, played_at
                FROM game_history
                WHERE user_id = $1
                ORDER BY played_at DESC
                LIMIT $2
                """,
                uid, limit,
            )
        return [
            {
                "game_id": r["game_id"],
                "pseudo_in_game": r["pseudo_in_game"],
                "score": r["score"],
                "rank": r["rank"],
                "total_players": r["total_players"],
                "won": r["won"],
                "at": r["played_at"],
            }
            for r in rows
        ]
    except Exception as e:
        print(f"[player_accounts] get_history error: {e}")
        return []


# ---------------------------------------------------------------------------
# Admin helpers
# ---------------------------------------------------------------------------

async def list_all_users() -> list[dict]:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM users ORDER BY created_at DESC"
            )
        return [public_user(dict(r)) for r in rows]
    except Exception as e:
        print(f"[player_accounts] list_all_users error: {e}")
        return []


async def admin_reset_password(uid: str, new_password: str) -> bool:
    if len(new_password) < 6:
        return False
    try:
        pool = await get_pool()
        new_hash = hash_password(new_password)
        async with pool.acquire() as conn:
            result = await conn.execute(
                "UPDATE users SET password_hash = $1 WHERE id = $2",
                new_hash, uid,
            )
        return result == "UPDATE 1"
    except Exception as e:
        print(f"[player_accounts] admin_reset_password error: {e}")
        return False


async def admin_delete_user(uid: str) -> bool:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            result = await conn.execute("DELETE FROM users WHERE id = $1", uid)
        return result == "DELETE 1"
    except Exception as e:
        print(f"[player_accounts] admin_delete_user error: {e}")
        return False
