from collections import defaultdict

from sqlmodel import Session, col, select

from app.core.errors import ApiError, not_found
from app.core.time import utcnow
from app.models import Comment, User
from app.schemas import CommentCreateIn, CommentOut, CommentPage, CommentUpdateIn
from app.services import cursors
from app.services.posts import get_visible_post
from app.services.serializers import is_comment_visible, serialize_comments


def _replies_for(db: Session, parent_ids: list[int]) -> dict[int, list[Comment]]:
    replies: dict[int, list[Comment]] = defaultdict(list)
    if parent_ids:
        rows = db.exec(
            select(Comment)
            .where(col(Comment.parent_id).in_(parent_ids))
            .order_by(col(Comment.created_at), col(Comment.id))
        ).all()
        for r in rows:
            replies[r.parent_id].append(r)
    return replies


def list_comments(db: Session, viewer: User, post_id: int, cursor: str | None, limit: int) -> CommentPage:
    """Top-level comments oldest first (offset cursor: new comments only ever append), replies inline."""
    get_visible_post(db, post_id, viewer)
    offset = cursors.decode(cursor).get("o", 0) if cursor else 0
    if not isinstance(offset, int) or offset < 0:
        raise ApiError(422, "validation_error", "Check the highlighted fields.", {"cursor": "Invalid cursor."})
    top = db.exec(
        select(Comment)
        .where(Comment.post_id == post_id, col(Comment.parent_id).is_(None))
        .order_by(col(Comment.created_at), col(Comment.id))
        .offset(offset)
        .limit(limit + 1)
    ).all()
    page, more = list(top[:limit]), len(top) > limit
    items = serialize_comments(db, page, _replies_for(db, [c.id for c in page]), viewer)
    return CommentPage(items=items, next_cursor=cursors.encode({"o": offset + limit}) if more else None)


def _reply_out(db: Session, viewer: User, reply: Comment) -> CommentOut:
    parent = db.get(Comment, reply.parent_id)
    out = serialize_comments(db, [parent], {parent.id: [reply]}, viewer)
    return next(r for r in out[0].replies if r.id == reply.id)


def serialize_single(db: Session, viewer: User, comment: Comment) -> CommentOut:
    if comment.parent_id is None:
        return serialize_comments(db, [comment], _replies_for(db, [comment.id]), viewer)[0]
    return _reply_out(db, viewer, comment)


def get_visible_comment(db: Session, comment_id: int, viewer: User) -> Comment:
    comment = db.get(Comment, comment_id)
    if comment is None or not is_comment_visible(comment):
        raise not_found("Comment")
    get_visible_post(db, comment.post_id, viewer)
    return comment


def create_comment(db: Session, viewer: User, post_id: int, data: CommentCreateIn) -> CommentOut:
    get_visible_post(db, post_id, viewer)
    if data.parent_id is not None:
        parent = db.get(Comment, data.parent_id)
        if parent is None or parent.post_id != post_id or not is_comment_visible(parent):
            raise not_found("Comment")
        if parent.parent_id is not None:
            raise ApiError(422, "reply_depth", "Replies only go one level deep.")
    comment = Comment(post_id=post_id, author_id=viewer.id, parent_id=data.parent_id, body=data.body)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return serialize_single(db, viewer, comment)


def _own_comment(db: Session, viewer: User, comment_id: int, verb: str) -> Comment:
    comment = get_visible_comment(db, comment_id, viewer)
    if comment.author_id != viewer.id:
        raise ApiError(403, "forbidden", f"You can only {verb} your own comments.")
    return comment


def update_comment(db: Session, viewer: User, comment_id: int, data: CommentUpdateIn) -> CommentOut:
    comment = _own_comment(db, viewer, comment_id, "edit")
    comment.body = data.body
    comment.updated_at = utcnow()
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return serialize_single(db, viewer, comment)


def delete_comment(db: Session, viewer: User, comment_id: int) -> None:
    comment = _own_comment(db, viewer, comment_id, "delete")
    comment.deleted_at = utcnow()
    db.add(comment)
    db.commit()
