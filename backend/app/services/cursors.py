import base64
import json
from typing import Any

from app.core.errors import ApiError


def encode(data: dict[str, Any]) -> str:
    raw = json.dumps(data, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode(cursor: str) -> dict[str, Any]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded.encode()))
        if not isinstance(data, dict):
            raise ValueError
        return data
    except ValueError as exc:
        raise ApiError(422, "validation_error", "Check the highlighted fields.", {"cursor": "Invalid cursor."}) from exc
