from typing import Annotated, Literal

from fastapi import APIRouter, Query, status

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.schemas import ModerateIn, ModerationResult, ReportCreated, ReportIn, ReportList
from app.services import moderation

router = APIRouter(tags=["moderation"])


@router.post("/reports", response_model=ReportCreated, status_code=status.HTTP_201_CREATED)
def create_report(data: ReportIn, viewer: CurrentUser, db: DbSession) -> ReportCreated:
    return moderation.create_report(db, viewer, data)


@router.get("/admin/reports", response_model=ReportList)
def admin_reports(
    _: AdminUser, db: DbSession, status: Annotated[Literal["open", "resolved"], Query()] = "open"
) -> ReportList:
    return moderation.list_reports(db, status)


@router.post("/admin/moderate", response_model=ModerationResult)
def admin_moderate(data: ModerateIn, _: AdminUser, db: DbSession) -> ModerationResult:
    return moderation.moderate(db, data)
