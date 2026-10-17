"""Builds viewer-independent `Candidate` features from the database."""

from collections import Counter
from datetime import datetime

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.models import Comment, FeedDelivery, Impression, Post, User
from app.recommendations.base import Candidate


def visible_posts_query():
    return (
        select(Post)
        .join(User, col(User.id) == col(Post.author_id))
        .where(col(Post.deleted_at).is_(None), Post.moderation_status == "visible", User.status == "active")
    )


def load_candidates(
    db: Session, exclude_post_ids: set[int] | None = None, exclude_author_ids: set[int] | None = None
) -> list[Candidate]:
    posts = db.exec(visible_posts_query()).all()
    if not posts:
        return []

    impressions = dict(db.exec(select(Impression.post_id, func.count()).group_by(Impression.post_id)).all())
    deliveries = dict(db.exec(select(FeedDelivery.post_id, func.count()).group_by(FeedDelivery.post_id)).all())

    author_of = {p.id: p.author_id for p in posts}
    author_impressions: Counter[int] = Counter()
    for post_id, n in impressions.items():
        if post_id in author_of:
            author_impressions[author_of[post_id]] += n
    author_posts: Counter[int] = Counter(p.author_id for p in posts)
    first_post: dict[int, tuple[datetime, int]] = {}
    for p in posts:
        key = (p.created_at, p.id)
        if p.author_id not in first_post or key < first_post[p.author_id]:
            first_post[p.author_id] = key

    commenters: dict[int, set[int]] = {}
    rows = db.exec(
        select(Comment.post_id, Comment.author_id).where(
            col(Comment.deleted_at).is_(None), Comment.moderation_status == "visible"
        )
    ).all()
    for post_id, author_id in rows:
        if author_of.get(post_id) not in (None, author_id):
            commenters.setdefault(post_id, set()).add(author_id)

    exclude_post_ids = exclude_post_ids or set()
    exclude_author_ids = exclude_author_ids or set()
    return [
        Candidate(
            post_id=p.id,
            author_id=p.author_id,
            topic=p.topic,
            created_at=p.created_at,
            impressions=impressions.get(p.id, 0),
            deliveries=deliveries.get(p.id, 0),
            author_impressions=author_impressions[p.author_id],
            author_post_count=author_posts[p.author_id],
            is_first_post=first_post[p.author_id][1] == p.id,
            distinct_commenters=len(commenters.get(p.id, ())),
        )
        for p in posts
        if p.id not in exclude_post_ids and p.author_id not in exclude_author_ids
    ]
