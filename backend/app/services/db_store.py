"""
Connexion PostgreSQL (asyncpg) et initialisation du schéma.
Séparé de Redis qui reste dédié aux sessions de jeu temps réel.
"""
from __future__ import annotations

import asyncpg
from app.config import settings

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        await _init_schema(_pool)
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def _init_schema(pool: asyncpg.Pool):
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                avatar_emoji TEXT NOT NULL DEFAULT '🎮',
                games_played INTEGER NOT NULL DEFAULT 0,
                total_score INTEGER NOT NULL DEFAULT 0,
                wins INTEGER NOT NULL DEFAULT 0,
                created_at BIGINT NOT NULL
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_total_score ON users(total_score DESC)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_wins ON users(wins DESC)
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS player_sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at BIGINT NOT NULL
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON player_sessions(user_id)
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS game_history (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                game_id TEXT NOT NULL,
                pseudo_in_game TEXT NOT NULL,
                score INTEGER NOT NULL DEFAULT 0,
                rank INTEGER NOT NULL DEFAULT 1,
                total_players INTEGER NOT NULL DEFAULT 1,
                won BOOLEAN NOT NULL DEFAULT FALSE,
                played_at BIGINT NOT NULL
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_history_user_id ON game_history(user_id)
        """)
    print("[DB] PostgreSQL schema ready")
