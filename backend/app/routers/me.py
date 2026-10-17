from fastapi import APIRouter

from app.core.deps import AppSettings, CurrentUser, DbSession
from app.schemas import MeUpdateIn, UnfollowList, UserEnvelope, ViewMix
from app.services import algorithm, reactions
from app.services.serializers import me_out

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=UserEnvelope)
def get_me(user: CurrentUser) -> UserEnvelope:
    return UserEnvelope(user=me_out(user))


@router.patch("", response_model=UserEnvelope)
def update_me(data: MeUpdateIn, user: CurrentUser, db: DbSession) -> UserEnvelope:
    if data.display_name is not None:
        user.display_name = data.display_name
    if data.bio is not None:
        user.bio = data.bio
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserEnvelope(user=me_out(user))


@router.get("/unfollows", response_model=UnfollowList)
def my_unfollows(user: CurrentUser, db: DbSession) -> UnfollowList:
    return reactions.list_unfollows(db, user)


@router.get("/view-mix", response_model=ViewMix)
def my_view_mix(user: CurrentUser, db: DbSession, settings: AppSettings) -> ViewMix:
    return algorithm.view_mix(db, settings, user)
