"""Request and response DTOs. These mirror docs/API_CONTRACT.md exactly.

Response models forbid extra keys so the contract tests in tests/test_contract_examples.py catch drift
in either direction.
"""

import re
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator

from app.core.time import as_utc
from app.core.topics import TopicSlug

UTCDateTime = Annotated[datetime, AfterValidator(as_utc)]
DislikeReason = Literal["disagree", "low_effort", "not_for_me"]
ReasonCode = Literal["fresh", "underexposed", "discussion", "wildcard", "outside_your_usual", "contested"]

USERNAME_RE = re.compile(r"^[a-z0-9_]{3,20}$")


class Schema(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _strip(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


def _text(value: str, *, max_len: int, too_long: str, empty: str) -> str:
    if not value:
        raise ValueError(empty)
    if len(value) > max_len:
        raise ValueError(too_long)
    return value


# --- errors -------------------------------------------------------------------------------------


class ErrorDetail(Schema):
    code: str
    message: str
    fields: dict[str, str] | None = None
    retry_after: int | None = None


class ErrorResponse(Schema):
    error: ErrorDetail


# --- users ----------------------------------------------------------------------------------------


class AuthorSummary(Schema):
    id: int
    username: str
    display_name: str
    avatar_url: str | None
    is_synthetic: bool


class UserOut(AuthorSummary):
    bio: str
    created_at: UTCDateTime


class MeOut(UserOut):
    is_admin: bool


class UserEnvelope(Schema):
    user: MeOut


class Profile(Schema):
    user: UserOut
    is_self: bool
    viewer_has_unfollowed: bool
    unfollowed_at: UTCDateTime | None


class RegisterIn(Schema):
    username: str
    password: str
    display_name: str | None = None

    _strip_fields = field_validator("username", "display_name", mode="before")(_strip)

    @field_validator("username")
    @classmethod
    def _username(cls, value: str) -> str:
        if not USERNAME_RE.fullmatch(value):
            raise ValueError("Use 3-20 lowercase letters, numbers or underscores.")
        return value

    @field_validator("password")
    @classmethod
    def _password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Use at least 8 characters.")
        if len(value) > 128:
            raise ValueError("Use at most 128 characters.")
        return value

    @field_validator("display_name")
    @classmethod
    def _display_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _text(
            value, max_len=40, too_long="Display names can be at most 40 characters.", empty="Enter a display name."
        )


class LoginIn(Schema):
    username: str
    password: str

    _strip_username = field_validator("username", mode="before")(_strip)


class MeUpdateIn(Schema):
    display_name: str | None = None
    bio: str | None = None

    _strip_fields = field_validator("display_name", "bio", mode="before")(_strip)

    @field_validator("display_name")
    @classmethod
    def _display_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _text(
            value, max_len=40, too_long="Display names can be at most 40 characters.", empty="Enter a display name."
        )

    @field_validator("bio")
    @classmethod
    def _bio(cls, value: str | None) -> str | None:
        if value is not None and len(value) > 160:
            raise ValueError("Bios can be at most 160 characters.")
        return value


class UnfollowState(Schema):
    username: str
    unfollowed: bool
    unfollowed_at: UTCDateTime | None


class UnfollowItem(Schema):
    user: AuthorSummary
    unfollowed_at: UTCDateTime


class UnfollowList(Schema):
    items: list[UnfollowItem]


# --- posts ----------------------------------------------------------------------------------------


class DislikeReasons(Schema):
    disagree: int = 0
    low_effort: int = 0
    not_for_me: int = 0
    none: int = 0


class ViewerDislike(Schema):
    reason: DislikeReason | None


class PostOut(Schema):
    id: int
    author: AuthorSummary
    body: str
    topic: TopicSlug
    created_at: UTCDateTime
    updated_at: UTCDateTime | None
    reply_count: int
    dislike_count: int
    dislike_reasons: DislikeReasons
    viewer_dislike: ViewerDislike | None
    viewer_has_unfollowed_author: bool
    is_own: bool


class PostPage(Schema):
    items: list[PostOut]
    next_cursor: str | None


def _post_body(value: str) -> str:
    return _text(value, max_len=500, too_long="Posts can be at most 500 characters.", empty="Write something first.")


class PostCreateIn(Schema):
    body: str
    topic: TopicSlug

    _strip_body = field_validator("body", mode="before")(_strip)
    _check_body = field_validator("body")(_post_body)


class PostUpdateIn(Schema):
    body: str | None = None
    topic: TopicSlug | None = None

    _strip_body = field_validator("body", mode="before")(_strip)

    @field_validator("body")
    @classmethod
    def _body(cls, value: str | None) -> str | None:
        return None if value is None else _post_body(value)


class DislikeIn(Schema):
    reason: DislikeReason | None = None


class PostDislikeState(Schema):
    post_id: int
    dislike_count: int
    dislike_reasons: DislikeReasons
    viewer_dislike: ViewerDislike | None


# --- comments -------------------------------------------------------------------------------------


class CommentOut(Schema):
    id: int
    post_id: int
    parent_id: int | None
    author: AuthorSummary | None
    body: str
    deleted: bool
    created_at: UTCDateTime
    updated_at: UTCDateTime | None
    dislike_count: int
    viewer_disliked: bool
    is_own: bool
    collapsed: bool
    replies: list["CommentOut"]


class CommentPage(Schema):
    items: list[CommentOut]
    next_cursor: str | None


def _comment_body(value: str) -> str:
    return _text(value, max_len=300, too_long="Comments can be at most 300 characters.", empty="Write something first.")


class CommentCreateIn(Schema):
    body: str
    parent_id: int | None = None

    _strip_body = field_validator("body", mode="before")(_strip)
    _check_body = field_validator("body")(_comment_body)


class CommentUpdateIn(Schema):
    body: str

    _strip_body = field_validator("body", mode="before")(_strip)
    _check_body = field_validator("body")(_comment_body)


class CommentDislikeState(Schema):
    comment_id: int
    dislike_count: int
    viewer_disliked: bool


# --- feed -----------------------------------------------------------------------------------------


class FeedItem(Schema):
    post: PostOut
    reason_code: ReasonCode
    reason_text: str


class FeedPage(Schema):
    items: list[FeedItem]
    session_id: str
    next_cursor: str | None
    end_of_feed: bool
    algorithm_version: str


class ImpressionItem(Schema):
    post_id: int
    position: int | None = None


class ImpressionBatchIn(Schema):
    session_id: str | None = None
    items: list[ImpressionItem] = Field(max_length=50)


class ImpressionResult(Schema):
    accepted: int
    duplicates: int


# --- algorithm ------------------------------------------------------------------------------------


class Pool(Schema):
    code: ReasonCode
    label: str
    share: float
    description: str


class Recipe(Schema):
    active_version: str
    pools: list[Pool]
    never_used: list[str]


class SlotAuthor(Schema):
    username: str
    display_name: str
    is_synthetic: bool


class ComparisonSlot(Schema):
    position: int
    post_id: int
    topic: TopicSlug
    author: SlotAuthor


class RankerMetrics(Schema):
    attention_gap: float
    topics_covered: int
    distinct_creators: int


class RankerOut(Schema):
    key: str
    label: str
    demo_only: bool
    slots: list[ComparisonSlot]
    metrics: RankerMetrics


class ComparisonDataset(Schema):
    posts: int
    creators: int
    simulated_viewers: int


class Comparison(Schema):
    dataset: ComparisonDataset
    slate_size: int
    rankers: list[RankerOut]


# --- reports and moderation -----------------------------------------------------------------------


class ReportIn(Schema):
    subject_type: Literal["post", "comment"]
    subject_id: int
    reason: Literal["spam", "abuse", "other"]
    note: str | None = None

    _strip_note = field_validator("note", mode="before")(_strip)

    @field_validator("note")
    @classmethod
    def _note(cls, value: str | None) -> str | None:
        if value is not None and len(value) > 300:
            raise ValueError("Notes can be at most 300 characters.")
        return value or None


class ReportCreated(Schema):
    id: int
    status: Literal["open", "resolved"]


class ReportOut(Schema):
    id: int
    subject_type: Literal["post", "comment"]
    subject_id: int
    reason: Literal["spam", "abuse", "other"]
    note: str | None
    status: Literal["open", "resolved"]
    created_at: UTCDateTime
    reporter: AuthorSummary
    subject_preview: str


class ReportList(Schema):
    items: list[ReportOut]


class ModerateIn(Schema):
    subject_type: Literal["post", "comment"]
    subject_id: int
    action: Literal["hide", "restore"]


class ModerationResult(Schema):
    subject_type: Literal["post", "comment"]
    subject_id: int
    moderation_status: Literal["hidden", "visible"]


# --- meta -----------------------------------------------------------------------------------------


class Health(Schema):
    status: Literal["ok"]
    version: str


class TopicOut(Schema):
    slug: TopicSlug
    label: str


class TopicList(Schema):
    items: list[TopicOut]
