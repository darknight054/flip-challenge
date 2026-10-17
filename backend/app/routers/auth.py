from fastapi import APIRouter, Request, Response, status

from app.core import ratelimit
from app.core.deps import AppSettings, CurrentUser, DbSession
from app.schemas import LoginIn, RegisterIn, UserEnvelope
from app.services import accounts
from app.services.serializers import me_out

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserEnvelope, status_code=status.HTTP_201_CREATED)
def register(
    data: RegisterIn, request: Request, response: Response, db: DbSession, settings: AppSettings
) -> UserEnvelope:
    ratelimit.enforce(request, "auth", ratelimit.client_ip(request))
    user = accounts.register(db, data)
    accounts.start_session(db, settings, user, response)
    return UserEnvelope(user=me_out(user))


@router.post("/login", response_model=UserEnvelope)
def login(data: LoginIn, request: Request, response: Response, db: DbSession, settings: AppSettings) -> UserEnvelope:
    ratelimit.enforce(request, "auth", ratelimit.client_ip(request))
    user = accounts.authenticate(db, data)
    accounts.start_session(db, settings, user, response)
    return UserEnvelope(user=me_out(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, db: DbSession, settings: AppSettings, _: CurrentUser) -> Response:
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    accounts.end_session(db, settings, request.cookies.get(settings.session_cookie_name), response)
    return response
