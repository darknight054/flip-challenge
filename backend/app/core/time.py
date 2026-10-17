from datetime import UTC, datetime


def utcnow() -> datetime:
    """Timezone-aware UTC, second precision. SQLModel stores it as UTC and returns aware values."""
    return datetime.now(UTC).replace(microsecond=0)


def as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
