"""Turns rows into contract DTOs, batch-loading counts so lists cost a fixed number of queries."""

from collections import defaultdict
from collections.abc import Iterable, Sequence

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.models import Comment, CommentDislike, Post, PostDislike, Unfollow, User
from app.schemas import (
    AuthorSummary,
    CommentOut,
    DislikeReasons,
    MeOut,
    PostOut,
    UserOut,
    ViewerDislike,
)


def author_summary(user: User) -> AuthorSummary:
    return AuthorSummary(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        is_synthetic=user.is_synthetic,
    )


def user_out(user: User) -> UserOut:
    return UserOut(**author_summary(user).model_dump(), bio=user.bio, created_at=user.created_at)


def me_out(user: User) -> MeOut:
    return MeOut(**user_out(user).model_dump(), is_admin=user.is_admin)


def users_by_id(db: Session, ids: Iterable[int]) -> dict[int, User]:
    ids = set(ids)
    if not ids:
        return {}
    return {u.id: u for u in db.exec(select(User).where(col(User.id).in_(ids))).all()}


def unfollowed_author_ids(db: Session, viewer_id: int) -> set[int]:
    return set(db.exec(select(Unfollow.author_id).where(Unfollow.viewer_id == viewer_id)).all())


def post_dislike_counts(db: Session, post_ids: Sequence[int]) -> dict[int, DislikeReasons]:
    counts: dict[int, dict[str, int]] = defaultdict(dict)
    if post_ids:
        rows = db.exec(
            select(PostDislike.post_id, PostDislike.reason, func.count())
            .where(col(PostDislike.post_id).in_(post_ids))
            .group_by(PostDislike.post_id, PostDislike.reason)
        ).all()
        for post_id, reason, n in rows:
            counts[post_id][reason or "none"] = n
    return {pid: DislikeReasons(**counts.get(pid, {})) for pid in post_ids}


def total(reasons: DislikeReasons) -> int:
    return reasons.disagree + reasons.low_effort + reasons.not_for_me + reasons.none


def serialize_posts(db: Session, posts: Sequence[Post], viewer: User) -> list[PostOut]:
    if not posts:
        return []
    ids = [p.id for p in posts]
    authors = users_by_id(db, (p.author_id for p in posts))
    reasons = post_dislike_counts(db, ids)
    replies = dict(
        db.exec(
            select(Comment.post_id, func.count())
            .where(
                col(Comment.post_id).in_(ids),
                col(Comment.deleted_at).is_(None),
                Comment.moderation_status == "visible",
            )
            .group_by(Comment.post_id)
        ).all()
    )
    mine = dict(
        db.exec(
            select(PostDislike.post_id, PostDislike.reason).where(
                PostDislike.user_id == viewer.id, col(PostDislike.post_id).in_(ids)
            )
        ).all()
    )
    unfollowed = unfollowed_author_ids(db, viewer.id)
    return [
        PostOut(
            id=p.id,
            author=author_summary(authors[p.author_id]),
            body=p.body,
            topic=p.topic,
            created_at=p.created_at,
            updated_at=p.updated_at,
            reply_count=replies.get(p.id, 0),
            dislike_count=total(reasons[p.id]),
            dislike_reasons=reasons[p.id],
            viewer_dislike=ViewerDislike(reason=mine[p.id]) if p.id in mine else None,
            viewer_has_unfollowed_author=p.author_id in unfollowed,
            is_own=p.author_id == viewer.id,
        )
        for p in posts
    ]


def comment_dislike_counts(db: Session, comment_ids: Sequence[int]) -> dict[int, int]:
    if not comment_ids:
        return {}
    return dict(
        db.exec(
            select(CommentDislike.comment_id, func.count())
            .where(col(CommentDislike.comment_id).in_(comment_ids))
            .group_by(CommentDislike.comment_id)
        ).all()
    )


def is_comment_visible(comment: Comment) -> bool:
    return comment.deleted_at is None and comment.moderation_status == "visible"


def serialize_comments(
    db: Session, top_level: Sequence[Comment], replies_by_parent: dict[int, list[Comment]], viewer: User
) -> list[CommentOut]:
    """Top-level comments with their replies. Removed comments become placeholders (only when they still
    have visible replies, so threads stay readable) and unfollowed authors are collapsed (Q11)."""
    every = [*top_level, *(r for rs in replies_by_parent.values() for r in rs)]
    ids = [c.id for c in every]
    authors = users_by_id(db, (c.author_id for c in every))
    dislikes = comment_dislike_counts(db, ids)
    mine = (
        set(
            db.exec(
                select(CommentDislike.comment_id).where(
                    CommentDislike.user_id == viewer.id, col(CommentDislike.comment_id).in_(ids)
                )
            ).all()
        )
        if ids
        else set()
    )
    unfollowed = unfollowed_author_ids(db, viewer.id)

    def one(c: Comment, replies: list[CommentOut]) -> CommentOut:
        visible = is_comment_visible(c)
        return CommentOut(
            id=c.id,
            post_id=c.post_id,
            parent_id=c.parent_id,
            author=author_summary(authors[c.author_id]) if visible else None,
            body=c.body if visible else "",
            deleted=not visible,
            created_at=c.created_at,
            updated_at=c.updated_at if visible else None,
            dislike_count=dislikes.get(c.id, 0) if visible else 0,
            viewer_disliked=c.id in mine and visible,
            is_own=visible and c.author_id == viewer.id,
            collapsed=visible and c.author_id in unfollowed,
            replies=replies,
        )

    out: list[CommentOut] = []
    for c in top_level:
        replies = [one(r, []) for r in replies_by_parent.get(c.id, []) if is_comment_visible(r)]
        if is_comment_visible(c) or replies:
            out.append(one(c, replies))
    return out
