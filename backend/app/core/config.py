from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SD_", env_file=".env", extra="ignore")

    version: str = "0.1.0"
    debug: bool = True
    database_url: str = f"sqlite:///{BACKEND_DIR / 'serendipity.db'}"

    session_cookie_name: str = "sd_session"
    session_ttl_days: int = 30
    cookie_secure: bool = False
    csrf_header: str = "X-Serendipity-Client"
    csrf_value: str = "web"
    rate_limits_enabled: bool = True

    # Recommender settings (PLAN §3.2, Q21). Quotas are config, not constants.
    active_algorithm: str = "baseline-v0"
    feed_quotas: dict[str, float] = {"fresh": 0.3, "underexposed": 0.3, "discussion": 0.2, "wildcard": 0.2}
    feed_session_ttl_hours: int = 6
    resurface_unseen_after_hours: int = 24
    cold_start_impressions: int = 5
    discussion_min_commenters: int = 3


@lru_cache
def get_settings() -> Settings:
    return Settings()
