from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from app.services import player_accounts as acct

router = APIRouter()

_ADMIN_ALLOWED_PREFIXES = ("127.", "10.", "172.16.", "172.17.", "172.18.", "172.19.",
                           "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
                           "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
                           "172.30.", "172.31.", "192.168.", "::1")


def _require_local(request: Request):
    client_ip = request.client.host if request.client else ""
    if not any(client_ip.startswith(p) for p in _ADMIN_ALLOWED_PREFIXES):
        raise HTTPException(status_code=403, detail="Admin réservé au réseau local")


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    display_name: str = Field(min_length=2, max_length=40)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileBody(BaseModel):
    display_name: str | None = Field(None, min_length=2, max_length=40)
    avatar_emoji: str | None = Field(None, max_length=8)


async def get_bearer_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Non authentifié")
    token = authorization[7:].strip()
    uid = await acct.resolve_auth_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Session invalide ou expirée")
    await acct.refresh_token_ttl(token)
    return uid


@router.post("/register")
async def register(body: RegisterBody):
    token, result = await acct.register_user(body.email, body.password, body.display_name)
    if token is None:
        msg = {
            "email_taken": "Cet email est déjà utilisé",
            "invalid_email": "Email invalide",
            "password_too_short": "Mot de passe trop court (6 car. min)",
            "name_too_short": "Pseudo trop court (2 car. min)",
            "db_unavailable": "Base de données indisponible — lance « docker compose up ».",
            "db_error": "Erreur interne, réessaie dans quelques instants.",
        }.get(str(result), "Erreur d'inscription")
        raise HTTPException(status_code=400, detail=msg)
    return {"token": token, "user": result}


@router.post("/login")
async def login(body: LoginBody):
    token, result = await acct.login_user(body.email, body.password)
    if token is None:
        msg = {
            "invalid_credentials": "Email ou mot de passe incorrect",
            "db_unavailable": "Base de données indisponible — lance « docker compose up ».",
            "db_error": "Erreur interne, réessaie dans quelques instants.",
        }.get(str(result), "Connexion impossible")
        raise HTTPException(status_code=401, detail=msg)
    return {"token": token, "user": result}


@router.get("/me")
async def me(uid: str = Depends(get_bearer_user_id)):
    user = await acct.get_user_by_id(uid)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return acct.public_user(user)


@router.patch("/me")
async def patch_me(body: UpdateProfileBody, uid: str = Depends(get_bearer_user_id)):
    if body.display_name is None and body.avatar_emoji is None:
        raise HTTPException(status_code=400, detail="Rien à mettre à jour")
    updated = await acct.update_user_profile(uid, body.display_name, body.avatar_emoji)
    if not updated:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return updated


@router.get("/leaderboard")
async def leaderboard(sort: str = "score", limit: int = 50):
    if sort not in ("score", "wins"):
        sort = "score"
    limit = max(1, min(limit, 100))
    return {"sort": sort, "entries": await acct.get_leaderboard(sort=sort, limit=limit)}


@router.get("/history")
async def history(uid: str = Depends(get_bearer_user_id), limit: int = 50):
    limit = max(1, min(limit, 100))
    return {"games": await acct.get_history(uid, limit=limit)}


# ---------------------------------------------------------------------------
# Admin endpoints (host-only, local network — no auth required)
# ---------------------------------------------------------------------------

@router.get("/admin/users")
async def admin_list_users(request: Request):
    _require_local(request)
    return {"users": await acct.list_all_users()}


class AdminUpdateBody(BaseModel):
    display_name: str | None = Field(None, min_length=2, max_length=40)
    avatar_emoji: str | None = Field(None, max_length=8)


@router.patch("/admin/users/{user_id}")
async def admin_update_user(request: Request, user_id: str, body: AdminUpdateBody):
    _require_local(request)
    if body.display_name is None and body.avatar_emoji is None:
        raise HTTPException(status_code=400, detail="Rien à mettre à jour")
    updated = await acct.update_user_profile(user_id, body.display_name, body.avatar_emoji)
    if not updated:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return updated


class ResetPasswordBody(BaseModel):
    new_password: str = Field(min_length=6)


@router.post("/admin/users/{user_id}/reset-password")
async def admin_reset_password(request: Request, user_id: str, body: ResetPasswordBody):
    _require_local(request)
    ok = await acct.admin_reset_password(user_id, body.new_password)
    if not ok:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable ou mot de passe invalide")
    return {"ok": True}


@router.delete("/admin/users/{user_id}")
async def admin_delete_user(request: Request, user_id: str):
    _require_local(request)
    ok = await acct.admin_delete_user(user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return {"ok": True}
