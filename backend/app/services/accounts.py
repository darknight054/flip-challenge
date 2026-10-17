from datetime import timedelta

from fastapi import Response
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.config import Settings
from app.core.errors import ApiError, not_found
from app.core.security import hash_password, hash_token, new_session_token, verify_password
from app.core.time import utcnow
from app.models import AuthSession, User
from app.schemas import LoginIn, RegisterIn


def get_active_user(db: Session, username: str) -> User:
    user = db.exec(select(User).where(User.username == username)).first()
    if user is None or user.status != "active":
        raise not_found("User")
    return user


def register(db: Session, data: RegisterIn) -> User:
    if db.exec(select(User.id).where(User.username == data.username)).first() is not None:
        raise ApiError(409, "username_taken", "That username is taken.")
    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        display_name=data.display_name or data.username,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:  # lost a race for the same username
        db.rollback()
        raise ApiError(409, "username_taken", "That username is taken.") from exc
    db.refresh(user)
    return user


def authenticate(db: Session, data: LoginIn) -> User:
    user = db.exec(select(User).where(User.username == data.username.lower())).first()
    if user is None or user.status != "active" or not verify_password(user.password_hash, data.password):
        raise ApiError(401, "invalid_credentials", "That username and password don't match.")
    return user


def start_session(db: Session, settings: Settings, user: User, response: Response) -> None:
    token = new_session_token()
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=utcnow() + timedelta(days=settings.session_ttl_days),
        )
    )
    db.commit()
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=settings.session_ttl_days * 86400,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )


def end_session(db: Session, settings: Settings, token: str | None, response: Response) -> None:
    if token:
        session = db.exec(select(AuthSession).where(AuthSession.token_hash == hash_token(token))).first()
        if session is not None:
            db.delete(session)
            db.commit()
    response.delete_cookie(settings.session_cookie_name, path="/")
