"""Dislikes and unfollows: the only two social actions in Serendipity."""

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.core.errors import ApiError
from app.core.time import utcnow
from app.models import CommentDislike, PostDislike, Unfollow, User
from app.schemas import (
    CommentDislikeState,
    DislikeReason,
    PostDislikeState,
    UnfollowItem,
    UnfollowList,
    UnfollowState,
    ViewerDislike,
)
from app.services.accounts import get_active_user
from app.services.comments import get_visible_comment
from app.services.posts import get_visible_post
from app.services.serializers import author_summary, post_dislike_counts, total, users_by_id

# --- post dislikes ----------------------------------------------------------------------------------


def _post_state(db: Session, viewer: User, post_id: int) -> PostDislikeState:
    reasons = post_dislike_counts(db, [post_id])[post_id]
    mine = db.exec(select(PostDislike).where(PostDislike.user_id == viewer.id, PostDislike.post_id == post_id)).first()
    return PostDislikeState(
        post_id=post_id,
        dislike_count=total(reasons),
        dislike_reasons=reasons,
        viewer_dislike=ViewerDislike(reason=mine.reason) if mine else None,
    )


def set_post_dislike(db: Session, viewer: User, post_id: int, reason: DislikeReason | None) -> PostDislikeState:
    post = get_visible_post(db, post_id, viewer)
    if post.author_id == viewer.id:
        raise ApiError(403, "own_content", "You can't dislike your own post.")
    existing = db.exec(
        select(PostDislike).where(PostDislike.user_id == viewer.id, PostDislike.post_id == post_id)
    ).first()
    if existing is None:
        db.add(PostDislike(user_id=viewer.id, post_id=post_id, reason=reason))
    elif existing.reason != reason:
        existing.reason = reason
        existing.updated_at = utcnow()
        db.add(existing)
    db.commit()
    return _post_state(db, viewer, post_id)


def remove_post_dislike(db: Session, viewer: User, post_id: int) -> PostDislikeState:
    get_visible_post(db, post_id, viewer)
    existing = db.exec(
        select(PostDislike).where(PostDislike.user_id == viewer.id, PostDislike.post_id == post_id)
    ).first()
    if existing is not None:
        db.delete(existing)
        db.commit()
    return _post_state(db, viewer, post_id)


# --- comment dislikes -------------------------------------------------------------------------------


def _comment_state(db: Session, viewer: User, comment_id: int) -> CommentDislikeState:
    count = db.exec(select(func.count()).where(CommentDislike.comment_id == comment_id)).one()
    mine = db.exec(
        select(CommentDislike.id).where(CommentDislike.user_id == viewer.id, CommentDislike.comment_id == comment_id)
    ).first()
    return CommentDislikeState(comment_id=comment_id, dislike_count=count, viewer_disliked=mine is not None)


def set_comment_dislike(db: Session, viewer: User, comment_id: int) -> CommentDislikeState:
    comment = get_visible_comment(db, comment_id, viewer)
    if comment.author_id == viewer.id:
        raise ApiError(403, "own_content", "You can't dislike your own comment.")
    existing = db.exec(
        select(CommentDislike).where(CommentDislike.user_id == viewer.id, CommentDislike.comment_id == comment_id)
    ).first()
    if existing is None:
        db.add(CommentDislike(user_id=viewer.id, comment_id=comment_id))
        db.commit()
    return _comment_state(db, viewer, comment_id)


def remove_comment_dislike(db: Session, viewer: User, comment_id: int) -> CommentDislikeState:
    get_visible_comment(db, comment_id, viewer)
    existing = db.exec(
        select(CommentDislike).where(CommentDislike.user_id == viewer.id, CommentDislike.comment_id == comment_id)
    ).first()
    if existing is not None:
        db.delete(existing)
        db.commit()
    return _comment_state(db, viewer, comment_id)


# --- unfollows --------------------------------------------------------------------------------------


def _unfollow_row(db: Session, viewer: User, author: User) -> Unfollow | None:
    return db.exec(select(Unfollow).where(Unfollow.viewer_id == viewer.id, Unfollow.author_id == author.id)).first()


def unfollow(db: Session, viewer: User, username: str) -> UnfollowState:
    author = get_active_user(db, username)
    if author.id == viewer.id:
        raise ApiError(422, "self_unfollow", "You can't unfollow yourself.")
    row = _unfollow_row(db, viewer, author)
    if row is None:
        row = Unfollow(viewer_id=viewer.id, author_id=author.id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return UnfollowState(username=author.username, unfollowed=True, unfollowed_at=row.created_at)


def undo_unfollow(db: Session, viewer: User, username: str) -> UnfollowState:
    author = get_active_user(db, username)
    row = _unfollow_row(db, viewer, author)
    if row is not None:
        db.delete(row)
        db.commit()
    return UnfollowState(username=author.username, unfollowed=False, unfollowed_at=None)


def unfollow_of(db: Session, viewer: User, author: User) -> Unfollow | None:
    return None if viewer.id == author.id else _unfollow_row(db, viewer, author)


def list_unfollows(db: Session, viewer: User) -> UnfollowList:
    rows = db.exec(
        select(Unfollow)
        .where(Unfollow.viewer_id == viewer.id)
        .order_by(col(Unfollow.created_at).desc(), col(Unfollow.id).desc())
    ).all()
    users = users_by_id(db, (r.author_id for r in rows))
    return UnfollowList(
        items=[
            UnfollowItem(user=author_summary(users[r.author_id]), unfollowed_at=r.created_at)
            for r in rows
            if users[r.author_id].status == "active"
        ]
    )
