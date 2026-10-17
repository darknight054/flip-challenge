from typing import Annotated

from fastapi import APIRouter, Query, Request, Response, status

from app.core import ratelimit
from app.core.deps import CurrentUser, DbSession
from app.schemas import (
    CommentCreateIn,
    CommentOut,
    CommentPage,
    DislikeIn,
    PostCreateIn,
    PostDislikeState,
    PostOut,
    PostUpdateIn,
)
from app.services import comments, posts, reactions
from app.services.serializers import serialize_posts

router = APIRouter(prefix="/posts", tags=["posts"])


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(data: PostCreateIn, request: Request, viewer: CurrentUser, db: DbSession) -> PostOut:
    ratelimit.enforce(request, "posts", viewer.id)
    return posts.create_post(db, viewer, data)


@router.get("/{post_id}", response_model=PostOut)
def get_post(post_id: int, viewer: CurrentUser, db: DbSession) -> PostOut:
    return serialize_posts(db, [posts.get_visible_post(db, post_id, viewer)], viewer)[0]


@router.patch("/{post_id}", response_model=PostOut)
def update_post(post_id: int, data: PostUpdateIn, viewer: CurrentUser, db: DbSession) -> PostOut:
    return posts.update_post(db, viewer, post_id, data)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: int, viewer: CurrentUser, db: DbSession) -> Response:
    posts.delete_post(db, viewer, post_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{post_id}/dislike", response_model=PostDislikeState)
def dislike_post(post_id: int, data: DislikeIn, viewer: CurrentUser, db: DbSession) -> PostDislikeState:
    return reactions.set_post_dislike(db, viewer, post_id, data.reason)


@router.delete("/{post_id}/dislike", response_model=PostDislikeState)
def remove_post_dislike(post_id: int, viewer: CurrentUser, db: DbSession) -> PostDislikeState:
    return reactions.remove_post_dislike(db, viewer, post_id)


@router.get("/{post_id}/comments", response_model=CommentPage)
def list_comments(
    post_id: int,
    viewer: CurrentUser,
    db: DbSession,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 50,
) -> CommentPage:
    return comments.list_comments(db, viewer, post_id, cursor, limit)


@router.post("/{post_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def create_comment(
    post_id: int, data: CommentCreateIn, request: Request, viewer: CurrentUser, db: DbSession
) -> CommentOut:
    ratelimit.enforce(request, "comments", viewer.id)
    return comments.create_comment(db, viewer, post_id, data)
