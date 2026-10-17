"""Feed sessions, stable pagination, eligibility filtering and impressions (PLAN §3.2)."""

import secrets
from collections import Counter
from datetime import datetime, timedelta

from sqlmodel import Session, col, or_, select

from app.core.config import Settings
from app.core.errors import ApiError
from app.core.time import utcnow
from app.models import FeedDelivery, FeedSession, Impression, Post, PostDislike, User
from app.recommendations.base import Candidate, ViewerHistory
from app.recommendations.features import load_candidates
from app.recommendations.registry import FEED_VERSIONS, get_recommender
from app.schemas import FeedItem, FeedPage, ImpressionBatchIn, ImpressionResult
from app.services import cursors
from app.services.posts import is_post_visible
from app.services.serializers import serialize_posts, unfollowed_author_ids

REASON_TEXT = {
    "fresh": "A new post or a new voice.",
    "underexposed": "A voice few people have seen yet.",
    "discussion": "Several different people are replying to this.",
    "wildcard": "Picked at random from posts you haven't seen.",
    "outside_your_usual": "A topic or voice you haven't seen much of lately.",
}


def viewer_history(db: Session, viewer: User, now: datetime, settings: Settings) -> ViewerHistory:
    """The viewer's own views over the last few days, from impressions only (Q18)."""
    since = now - timedelta(days=settings.seen_least_window_days)
    rows = db.exec(
        select(Post.topic, Post.author_id)
        .join(Impression, col(Impression.post_id) == col(Post.id))
        .where(Impression.viewer_id == viewer.id, col(Impression.first_visible_at) > since)
    ).all()
    return ViewerHistory(
        topic_views=dict(Counter(topic for topic, _ in rows)),
        author_views=dict(Counter(author for _, author in rows)),
    )


def eligible_candidates(
    db: Session, viewer: User, session_id: str | None, now: datetime, settings: Settings
) -> list[Candidate]:
    """Everything the viewer may still be shown. Unfollows and dislikes act here, as filters only."""
    unfollowed = unfollowed_author_ids(db, viewer.id)
    disliked = set(db.exec(select(PostDislike.post_id).where(PostDislike.user_id == viewer.id)).all())
    seen = set(db.exec(select(Impression.post_id).where(Impression.viewer_id == viewer.id)).all())
    cutoff = now - timedelta(hours=settings.resurface_unseen_after_hours)
    recently_served = set(
        db.exec(
            select(FeedDelivery.post_id).where(
                FeedDelivery.viewer_id == viewer.id,
                or_(col(FeedDelivery.delivered_at) > cutoff, FeedDelivery.feed_session_id == session_id),
            )
        ).all()
    )
    return load_candidates(
        db,
        exclude_post_ids=disliked | seen | recently_served,
        exclude_author_ids=unfollowed | {viewer.id},
    )


def _invalid_cursor() -> ApiError:
    return ApiError(422, "validation_error", "Check the highlighted fields.", {"cursor": "Invalid cursor."})


def _page_seed(session_seed: int, page: int) -> int:
    return (session_seed * 1_000_003 + page) % 2**31


def _open_session(
    db: Session, viewer: User, cursor: str | None, algo: str | None, settings: Settings, now: datetime
) -> tuple[FeedSession, int]:
    if cursor:
        data = cursors.decode(cursor)
        session = db.get(FeedSession, str(data.get("s", "")))
        page = data.get("p")
        if session is None or session.viewer_id != viewer.id or not isinstance(page, int) or page < 0:
            raise _invalid_cursor()
        return session, page
    version = algo or settings.active_algorithm
    if version not in FEED_VERSIONS:
        get_recommender(version, settings)  # raises the contract's validation error
    session = FeedSession(
        id=f"fs_{secrets.token_hex(8)}",
        viewer_id=viewer.id,
        expires_at=now + timedelta(hours=settings.feed_session_ttl_hours),
        algorithm_version=version,
        random_seed=secrets.randbelow(2**31),
    )
    db.add(session)
    db.commit()
    return session, 0


def get_feed_page(
    db: Session, settings: Settings, viewer: User, cursor: str | None, limit: int, algo: str | None = None
) -> FeedPage:
    now = utcnow()
    session, page = _open_session(db, viewer, cursor, algo, settings, now)

    stored = db.exec(
        select(FeedDelivery)
        .where(FeedDelivery.feed_session_id == session.id, FeedDelivery.page == page)
        .order_by(col(FeedDelivery.position))
    ).all()
    if stored:  # replaying a page (refetch): same posts, same order, fresh counts
        ranked = [(d.post_id, d.reason_code) for d in stored]
        remaining = len(eligible_candidates(db, viewer, session.id, now, settings))
    else:
        candidates = eligible_candidates(db, viewer, session.id, now, settings)
        recommender = get_recommender(session.algorithm_version, settings)
        history = viewer_history(db, viewer, now, settings)
        slate = recommender.build_slate(
            candidates, limit, seed=_page_seed(session.random_seed, page), now=now, history=history
        )
        for position, item in enumerate(slate):
            db.add(
                FeedDelivery(
                    feed_session_id=session.id,
                    viewer_id=viewer.id,
                    post_id=item.post_id,
                    page=page,
                    position=position,
                    reason_code=item.reason_code,
                    delivered_at=now,
                )
            )
        db.commit()
        ranked = [(item.post_id, item.reason_code) for item in slate]
        remaining = len(candidates) - len(slate)

    ids = [post_id for post_id, _ in ranked]
    posts = {p.id: p for p in db.exec(select(Post).where(col(Post.id).in_(ids))).all()} if ids else {}
    unfollowed = unfollowed_author_ids(db, viewer.id)
    kept = [
        (posts[post_id], code)
        for post_id, code in ranked
        if is_post_visible(posts.get(post_id)) and posts[post_id].author_id not in unfollowed
    ]
    serialized = serialize_posts(db, [post for post, _ in kept], viewer)
    items = [
        FeedItem(post=out, reason_code=code, reason_text=REASON_TEXT.get(code, "Picked for this feed."))
        for out, (_, code) in zip(serialized, kept, strict=True)
    ]
    end = remaining <= 0
    return FeedPage(
        items=items,
        session_id=session.id,
        next_cursor=None if end else cursors.encode({"s": session.id, "p": page + 1}),
        end_of_feed=end,
        algorithm_version=session.algorithm_version,
    )


def record_impressions(db: Session, viewer: User, data: ImpressionBatchIn) -> ImpressionResult:
    session_id = None
    if data.session_id:
        session = db.get(FeedSession, data.session_id)
        if session is not None and session.viewer_id == viewer.id:
            session_id = session.id

    ids = {item.post_id for item in data.items}
    authors = dict(db.exec(select(Post.id, Post.author_id).where(col(Post.id).in_(ids))).all()) if ids else {}
    already = (
        set(
            db.exec(
                select(Impression.post_id).where(Impression.viewer_id == viewer.id, col(Impression.post_id).in_(ids))
            ).all()
        )
        if ids
        else set()
    )
    accepted = duplicates = 0
    for item in data.items:
        # Unknown posts and your own posts are ignored: own posts never count as exposure (Q14).
        if item.post_id not in authors or authors[item.post_id] == viewer.id:
            continue
        if item.post_id in already:
            duplicates += 1
            continue
        already.add(item.post_id)
        db.add(
            Impression(viewer_id=viewer.id, post_id=item.post_id, feed_session_id=session_id, position=item.position)
        )
        accepted += 1
    db.commit()
    return ImpressionResult(accepted=accepted, duplicates=duplicates)
