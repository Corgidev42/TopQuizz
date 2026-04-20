"""Utilitaires HTTP (proxy nginx, corrélation)."""
from __future__ import annotations

from starlette.requests import Request


def client_ip(request: Request) -> str:
    """IP client réelle derrière nginx (X-Forwarded-For, X-Real-IP)."""
    xff = (request.headers.get("x-forwarded-for") or "").strip()
    if xff:
        return xff.split(",")[0].strip()[:45]
    rip = (request.headers.get("x-real-ip") or "").strip()
    if rip:
        return rip[:45]
    if request.client and request.client.host:
        return request.client.host[:45]
    return ""


def request_id_for(request: Request) -> str:
    rid = getattr(request.state, "request_id", None)
    if isinstance(rid, str) and rid:
        return rid
    return (request.headers.get("x-request-id") or "").strip() or "no-rid"
