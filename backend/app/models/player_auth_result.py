"""Résultat typé des opérations d'inscription / connexion (API stable côté routes)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class PlayerAuthResult:
    ok: bool
    token: str | None = None
    user: dict[str, Any] | None = None
    error_code: str | None = None
    """Code machine (email_taken, db_error, …)."""
    audit_detail: str | None = None
    """Contexte technique pour journal admin (jamais exposé au client tel quel)."""
