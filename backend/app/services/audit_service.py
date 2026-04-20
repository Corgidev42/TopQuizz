"""
Journal d'audit des tentatives d'inscription / connexion (persisté en PostgreSQL).
Ne doit jamais faire échouer une requête utilisateur : best-effort uniquement.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Literal

from app.services.db_store import get_pool

logger = logging.getLogger("topquizz.audit")

AuthKind = Literal["register", "login"]


def mask_email_hint(email: str) -> str:
    """Masque le local-part pour le journal (ex. j***@gmail.com)."""
    e = (email or "").strip().lower()
    if "@" not in e:
        return ""
    local, _, domain = e.partition("@")
    domain = domain[:120]
    if not local:
        return f"*@{domain}"
    if len(local) == 1:
        return f"{local}*@{domain}"
    return f"{local[0]}***@{domain}"[:160]


def _truncate(s: str | None, n: int) -> str:
    if not s:
        return ""
    s = s.strip()
    return s if len(s) <= n else s[: n - 1] + "…"


async def record_auth_audit(
    *,
    request_id: str,
    kind: AuthKind,
    success: bool,
    reason_code: str | None,
    public_message: str | None,
    http_status: int,
    client_ip: str,
    user_agent: str,
    email_raw: str | None,
    internal_detail: str | None = None,
) -> None:
    try:
        pool = await get_pool()
    except Exception as e:
        logger.warning("audit skip: no pool (%s)", e)
        return

    now = int(time.time())
    email_hint = mask_email_hint(email_raw or "")
    row = (
        now,
        _truncate(request_id, 64),
        kind,
        success,
        _truncate(reason_code, 64) if reason_code else None,
        _truncate(public_message, 500) if public_message else None,
        http_status,
        _truncate(client_ip, 64),
        _truncate(user_agent, 400),
        _truncate(email_hint, 160) or None,
        _truncate(internal_detail, 800) if internal_detail else None,
    )
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO auth_audit_events (
                    created_at, request_id, kind, success, reason_code,
                    public_message, http_status, client_ip, user_agent,
                    email_hint, internal_detail
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                """,
                *row,
            )
    except Exception as e:
        logger.warning("audit insert failed: %s", e, exc_info=True)


async def list_auth_audit(
    *,
    limit: int = 100,
    offset: int = 0,
    kind: str | None = None,
    failures_only: bool = False,
) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    try:
        pool = await get_pool()
    except Exception:
        return []

    where: list[str] = []
    args: list[Any] = []
    if kind and kind in ("register", "login"):
        where.append(f"kind = ${len(args) + 1}")
        args.append(kind)
    if failures_only:
        where.append("success = FALSE")
    wh = ("WHERE " + " AND ".join(where)) if where else ""

    lim_idx = len(args) + 1
    args.extend([limit, offset])
    lim = f"${lim_idx} OFFSET ${lim_idx + 1}"
    q = f"""
        SELECT id, created_at, request_id, kind, success, reason_code,
               public_message, http_status, client_ip, user_agent,
               email_hint, internal_detail
        FROM auth_audit_events
        {wh}
        ORDER BY id DESC
        LIMIT {lim}
    """
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(q, *args)
        return [dict(r) for r in rows]
    except Exception as e:
        logger.warning("audit list failed: %s", e)
        return []
