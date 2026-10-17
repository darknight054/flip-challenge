from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession
from app.schemas import PostPage, Profile, UnfollowState
from app.services import accounts, posts, reactions
from app.services.serializers import user_out

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{username}", response_model=Profile)
def get_profile(username: str, viewer: CurrentUser, db: DbSession) -> Profile:
    user = accounts.get_active_user(db, username)
    row = reactions.unfollow_of(db, viewer, user)
    return Profile(
        user=user_out(user),
        is_self=user.id == viewer.id,
        viewer_has_unfollowed=row is not None,
        unfollowed_at=row.created_at if row else None,
    )


@router.get("/{username}/posts", response_model=PostPage)
def get_user_posts(
    username: str,
    viewer: CurrentUser,
    db: DbSession,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=30)] = 20,
) -> PostPage:
    return posts.list_user_posts(db, viewer, accounts.get_active_user(db, username), cursor, limit)


@router.put("/{username}/unfollow", response_model=UnfollowState)
def unfollow(username: str, viewer: CurrentUser, db: DbSession) -> UnfollowState:
    return reactions.unfollow(db, viewer, username)


@router.delete("/{username}/unfollow", response_model=UnfollowState)
def undo_unfollow(username: str, viewer: CurrentUser, db: DbSession) -> UnfollowState:
    return reactions.undo_unfollow(db, viewer, username)
