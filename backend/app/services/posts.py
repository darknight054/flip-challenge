from datetime import datetime

from sqlmodel import Session, col, or_, select

from app.core.errors import ApiError, not_found
from app.core.time import utcnow
from app.models import Post, User
from app.schemas import PostCreateIn, PostOut, PostPage, PostUpdateIn
from app.services import cursors
from app.services.serializers import serialize_posts


def is_post_visible(post: Post | None) -> bool:
    return post is not None and post.deleted_at is None and post.moderation_status == "visible"


def get_visible_post(db: Session, post_id: int, viewer: User) -> Post:
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise not_found("Post")
    if post.moderation_status != "visible" and not viewer.is_admin:
        raise not_found("Post")
    return post


def get_own_post(db: Session, post_id: int, viewer: User, verb: str) -> Post:
    post = get_visible_post(db, post_id, viewer)
    if post.author_id != viewer.id:
        raise ApiError(403, "forbidden", f"You can only {verb} your own posts.")
    return post


def create_post(db: Session, viewer: User, data: PostCreateIn) -> PostOut:
    post = Post(author_id=viewer.id, body=data.body, topic=data.topic)
    db.add(post)
    db.commit()
    db.refresh(post)
    return serialize_posts(db, [post], viewer)[0]


def update_post(db: Session, viewer: User, post_id: int, data: PostUpdateIn) -> PostOut:
    post = get_own_post(db, post_id, viewer, "edit")
    if data.body is not None:
        post.body = data.body
    if data.topic is not None:
        post.topic = data.topic
    post.updated_at = utcnow()
    db.add(post)
    db.commit()
    db.refresh(post)
    return serialize_posts(db, [post], viewer)[0]


def delete_post(db: Session, viewer: User, post_id: int) -> None:
    post = get_own_post(db, post_id, viewer, "delete")
    post.deleted_at = utcnow()
    db.add(post)
    db.commit()


def list_user_posts(db: Session, viewer: User, author: User, cursor: str | None, limit: int) -> PostPage:
    """Newest first, keyset-paginated so new posts never shift later pages."""
    query = select(Post).where(
        Post.author_id == author.id,
        col(Post.deleted_at).is_(None),
        Post.moderation_status == "visible",
    )
    if cursor:
        data = cursors.decode(cursor)
        try:
            before_at, before_id = datetime.fromisoformat(data["t"]), int(data["i"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ApiError(
                422, "validation_error", "Check the highlighted fields.", {"cursor": "Invalid cursor."}
            ) from exc
        query = query.where(
            or_(col(Post.created_at) < before_at, (col(Post.created_at) == before_at) & (col(Post.id) < before_id))
        )
    posts = db.exec(query.order_by(col(Post.created_at).desc(), col(Post.id).desc()).limit(limit + 1)).all()
    page, more = posts[:limit], len(posts) > limit
    next_cursor = cursors.encode({"t": page[-1].created_at.isoformat(), "i": page[-1].id}) if more else None
    return PostPage(items=serialize_posts(db, page, viewer), next_cursor=next_cursor)
