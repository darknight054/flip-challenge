from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    """Raised anywhere in the app; rendered as the contract's error envelope."""

    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        fields: dict[str, str] | None = None,
        retry_after: int | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields
        self.retry_after = retry_after


def not_found(what: str) -> ApiError:
    return ApiError(404, "not_found", f"{what} not found.")


def error_body(
    code: str, message: str, fields: dict[str, str] | None = None, retry_after: int | None = None
) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if fields is not None:
        error["fields"] = fields
    if retry_after is not None:
        error["retry_after"] = retry_after
    return {"error": error}


# Friendly messages for pydantic errors that don't come from our own validators.
_MISSING = {
    "topic": "Pick a topic.",
    "body": "Write something first.",
    "username": "Pick a username.",
    "password": "Enter a password.",
}
_BAD_CHOICE = {
    "topic": "Pick a topic.",
    "reason": "Pick Disagree, Low effort or Not for me.",
    "subject_type": "Use post or comment.",
    "action": "Use hide or restore.",
    "status": "Use open or resolved.",
}


def _field_name(loc: tuple[Any, ...]) -> str:
    parts = [str(p) for p in loc[1:] if not isinstance(p, int)] if len(loc) > 1 else []
    return ".".join(parts) or "_body"


def _friendly(error: dict[str, Any], field: str) -> str:
    kind = error.get("type", "")
    leaf = field.rsplit(".", 1)[-1]
    if kind == "missing":
        return _MISSING.get(leaf, "This field is required.")
    if kind == "value_error":
        return str(error.get("msg", "")).removeprefix("Value error, ")
    if kind in ("literal_error", "enum"):
        return _BAD_CHOICE.get(leaf, "Pick one of the allowed values.")
    if kind == "json_invalid":
        return "Send valid JSON."
    if kind == "too_long":
        return "Too many items."
    return "Invalid value."


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after is not None else None
        return JSONResponse(
            status_code=exc.status,
            content=error_body(exc.code, exc.message, exc.fields, exc.retry_after),
            headers=headers,
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields: dict[str, str] = {}
        for error in exc.errors():
            field = _field_name(tuple(error.get("loc", ())))
            fields.setdefault(field, _friendly(error, field))
        return JSONResponse(
            status_code=422,
            content=error_body("validation_error", "Check the highlighted fields.", fields),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {401: "unauthenticated", 403: "forbidden", 404: "not_found"}.get(exc.status_code, "error")
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return JSONResponse(status_code=exc.status_code, content=error_body(code, message))
