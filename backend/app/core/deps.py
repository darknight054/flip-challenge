from typing import Annotated

from fastapi import Depends, Request
from sqlmodel import Session, select

from app.core import ratelimit
from app.core.config import Settings
from app.core.errors import ApiError
from app.core.security import hash_token
from app.core.time import utcnow
from app.db.engine import get_db
from app.models import AuthSession, User

DbSession = Annotated[Session, Depends(get_db)]


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


AppSettings = Annotated[Settings, Depends(get_app_settings)]


def optional_user(request: Request, db: DbSession, settings: AppSettings) -> User | None:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    row = db.exec(
        select(AuthSession, User)
        .join(User, User.id == AuthSession.user_id)
        .where(AuthSession.token_hash == hash_token(token), AuthSession.expires_at > utcnow())
    ).first()
    if row is None or row[1].status != "active":
        return None
    return row[1]


def current_user(request: Request, user: Annotated[User | None, Depends(optional_user)]) -> User:
    if user is None:
        raise ApiError(401, "unauthenticated", "Log in to continue.")
    ratelimit.enforce(request, "user", user.id)
    return user


CurrentUser = Annotated[User, Depends(current_user)]


def admin_user(user: CurrentUser) -> User:
    if not user.is_admin:
        raise ApiError(403, "forbidden", "Admins only.")
    return user


AdminUser = Annotated[User, Depends(admin_user)]
