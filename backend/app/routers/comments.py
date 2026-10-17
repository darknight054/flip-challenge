from fastapi import APIRouter, Response, status

from app.core.deps import CurrentUser, DbSession
from app.schemas import CommentDislikeState, CommentOut, CommentUpdateIn
from app.services import comments, reactions

router = APIRouter(prefix="/comments", tags=["comments"])


@router.patch("/{comment_id}", response_model=CommentOut)
def update_comment(comment_id: int, data: CommentUpdateIn, viewer: CurrentUser, db: DbSession) -> CommentOut:
    return comments.update_comment(db, viewer, comment_id, data)


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(comment_id: int, viewer: CurrentUser, db: DbSession) -> Response:
    comments.delete_comment(db, viewer, comment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{comment_id}/dislike", response_model=CommentDislikeState)
def dislike_comment(comment_id: int, viewer: CurrentUser, db: DbSession) -> CommentDislikeState:
    return reactions.set_comment_dislike(db, viewer, comment_id)


@router.delete("/{comment_id}/dislike", response_model=CommentDislikeState)
def remove_comment_dislike(comment_id: int, viewer: CurrentUser, db: DbSession) -> CommentDislikeState:
    return reactions.remove_comment_dislike(db, viewer, comment_id)
