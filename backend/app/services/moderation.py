from sqlmodel import Session, col, select

from app.core.errors import not_found
from app.models import Comment, Post, Report, User
from app.schemas import ModerateIn, ModerationResult, ReportCreated, ReportIn, ReportList, ReportOut
from app.services.comments import get_visible_comment
from app.services.posts import get_visible_post
from app.services.serializers import author_summary, users_by_id


def create_report(db: Session, viewer: User, data: ReportIn) -> ReportCreated:
    if data.subject_type == "post":
        get_visible_post(db, data.subject_id, viewer)
    else:
        get_visible_comment(db, data.subject_id, viewer)
    report = Report(
        reporter_id=viewer.id,
        subject_type=data.subject_type,
        subject_id=data.subject_id,
        reason=data.reason,
        note=data.note,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return ReportCreated(id=report.id, status="open")


def _subject(db: Session, subject_type: str, subject_id: int) -> Post | Comment | None:
    return db.get(Post if subject_type == "post" else Comment, subject_id)


def list_reports(db: Session, status: str) -> ReportList:
    reports = db.exec(
        select(Report).where(Report.status == status).order_by(col(Report.created_at).desc(), col(Report.id).desc())
    ).all()
    reporters = users_by_id(db, (r.reporter_id for r in reports))
    items = []
    for r in reports:
        subject = _subject(db, r.subject_type, r.subject_id)
        preview = subject.body[:80] if subject is not None and subject.deleted_at is None else "[deleted]"
        items.append(
            ReportOut(
                id=r.id,
                subject_type=r.subject_type,
                subject_id=r.subject_id,
                reason=r.reason,
                note=r.note,
                status=r.status,
                created_at=r.created_at,
                reporter=author_summary(reporters[r.reporter_id]),
                subject_preview=preview,
            )
        )
    return ReportList(items=items)


def moderate(db: Session, data: ModerateIn) -> ModerationResult:
    subject = _subject(db, data.subject_type, data.subject_id)
    if subject is None:
        raise not_found("Post" if data.subject_type == "post" else "Comment")
    subject.moderation_status = "hidden" if data.action == "hide" else "visible"
    db.add(subject)
    open_reports = db.exec(
        select(Report).where(
            Report.subject_type == data.subject_type, Report.subject_id == data.subject_id, Report.status == "open"
        )
    ).all()
    for report in open_reports:
        report.status = "resolved"
        db.add(report)
    db.commit()
    return ModerationResult(
        subject_type=data.subject_type, subject_id=data.subject_id, moderation_status=subject.moderation_status
    )
