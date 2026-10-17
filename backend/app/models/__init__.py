"""SQLModel tables. Importing this package registers every table on SQLModel.metadata."""

from datetime import datetime

from sqlalchemy import CheckConstraint, Index, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.core.time import utcnow


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(max_length=20, unique=True, index=True)
    password_hash: str
    display_name: str = Field(max_length=40)
    bio: str = Field(default="", max_length=160)
    avatar_url: str | None = None
    is_admin: bool = False
    is_synthetic: bool = False
    status: str = Field(default="active", max_length=16)
    created_at: datetime = Field(default_factory=utcnow)


class AuthSession(SQLModel, table=True):
    __tablename__ = "sessions"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    token_hash: str = Field(unique=True, index=True)
    created_at: datetime = Field(default_factory=utcnow)
    expires_at: datetime


class Post(SQLModel, table=True):
    __tablename__ = "posts"
    __table_args__ = (
        Index("ix_posts_created", "created_at", "id"),
        Index("ix_posts_author_created", "author_id", "created_at"),
        Index("ix_posts_topic_created", "topic", "created_at"),
    )

    id: int | None = Field(default=None, primary_key=True)
    author_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    body: str = Field(max_length=500)
    topic: str = Field(max_length=32)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime | None = None
    deleted_at: datetime | None = None
    moderation_status: str = Field(default="visible", max_length=16)


class Comment(SQLModel, table=True):
    __tablename__ = "comments"
    __table_args__ = (Index("ix_comments_post_created", "post_id", "created_at"),)

    id: int | None = Field(default=None, primary_key=True)
    post_id: int = Field(foreign_key="posts.id", ondelete="CASCADE")
    author_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    parent_id: int | None = Field(default=None, foreign_key="comments.id", ondelete="CASCADE", index=True)
    body: str = Field(max_length=300)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime | None = None
    deleted_at: datetime | None = None
    moderation_status: str = Field(default="visible", max_length=16)


class Unfollow(SQLModel, table=True):
    """The entire social graph. Used only as a feed filter (PLAN §1.2 rule 2)."""

    __tablename__ = "unfollows"
    __table_args__ = (
        UniqueConstraint("viewer_id", "author_id", name="uq_unfollows_viewer_author"),
        CheckConstraint("viewer_id != author_id", name="ck_unfollows_not_self"),
    )

    id: int | None = Field(default=None, primary_key=True)
    viewer_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    author_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    created_at: datetime = Field(default_factory=utcnow)


class PostDislike(SQLModel, table=True):
    __tablename__ = "post_dislikes"
    __table_args__ = (UniqueConstraint("user_id", "post_id", name="uq_post_dislikes_user_post"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    post_id: int = Field(foreign_key="posts.id", ondelete="CASCADE", index=True)
    reason: str | None = Field(default=None, max_length=16)  # disagree | low_effort | not_for_me
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime | None = None


class CommentDislike(SQLModel, table=True):
    __tablename__ = "comment_dislikes"
    __table_args__ = (UniqueConstraint("user_id", "comment_id", name="uq_comment_dislikes_user_comment"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    comment_id: int = Field(foreign_key="comments.id", ondelete="CASCADE", index=True)
    created_at: datetime = Field(default_factory=utcnow)


class FeedSession(SQLModel, table=True):
    __tablename__ = "feed_sessions"

    id: str = Field(primary_key=True, max_length=40)
    viewer_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    created_at: datetime = Field(default_factory=utcnow)
    expires_at: datetime
    algorithm_version: str = Field(max_length=40)
    random_seed: int


class FeedDelivery(SQLModel, table=True):
    __tablename__ = "feed_deliveries"
    __table_args__ = (
        UniqueConstraint("feed_session_id", "post_id", name="uq_feed_deliveries_session_post"),
        Index("ix_feed_deliveries_viewer_post", "viewer_id", "post_id"),
        Index("ix_feed_deliveries_session_page", "feed_session_id", "page"),
    )

    id: int | None = Field(default=None, primary_key=True)
    feed_session_id: str = Field(foreign_key="feed_sessions.id", ondelete="CASCADE")
    viewer_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    post_id: int = Field(foreign_key="posts.id", ondelete="CASCADE", index=True)
    page: int
    position: int
    reason_code: str = Field(max_length=32)
    delivered_at: datetime = Field(default_factory=utcnow)


class Impression(SQLModel, table=True):
    """A post that was actually on screen (>=50% visible for >=1 s). Served != seen."""

    __tablename__ = "impressions"
    __table_args__ = (UniqueConstraint("viewer_id", "post_id", name="uq_impressions_viewer_post"),)

    id: int | None = Field(default=None, primary_key=True)
    viewer_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    post_id: int = Field(foreign_key="posts.id", ondelete="CASCADE", index=True)
    feed_session_id: str | None = Field(default=None, foreign_key="feed_sessions.id", ondelete="SET NULL")
    position: int | None = None
    first_visible_at: datetime = Field(default_factory=utcnow)


class Report(SQLModel, table=True):
    __tablename__ = "reports"

    id: int | None = Field(default=None, primary_key=True)
    reporter_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    subject_type: str = Field(max_length=16)  # post | comment
    subject_id: int
    reason: str = Field(max_length=16)  # spam | abuse | other
    note: str | None = Field(default=None, max_length=300)
    status: str = Field(default="open", max_length=16, index=True)
    created_at: datetime = Field(default_factory=utcnow)


__all__ = [
    "AuthSession",
    "Comment",
    "CommentDislike",
    "FeedDelivery",
    "FeedSession",
    "Impression",
    "Post",
    "PostDislike",
    "Report",
    "Unfollow",
    "User",
]
