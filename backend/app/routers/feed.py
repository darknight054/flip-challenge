from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import AppSettings, CurrentUser, DbSession
from app.schemas import FeedPage, ImpressionBatchIn, ImpressionResult
from app.services import feed

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("", response_model=FeedPage)
def get_feed(
    viewer: CurrentUser,
    db: DbSession,
    settings: AppSettings,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=30)] = 20,
    algo: str | None = None,
) -> FeedPage:
    # `algo` lets developers try another recommender version; ignored outside debug (Q21).
    return feed.get_feed_page(db, settings, viewer, cursor, limit, algo if settings.debug else None)


@router.post("/impressions", response_model=ImpressionResult, status_code=status.HTTP_202_ACCEPTED)
def post_impressions(data: ImpressionBatchIn, viewer: CurrentUser, db: DbSession) -> ImpressionResult:
    return feed.record_impressions(db, viewer, data)
