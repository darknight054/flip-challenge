from app.core.config import Settings
from app.core.errors import ApiError
from app.recommendations.base import Recommender
from app.recommendations.baseline import BaselineV0

# Feed-eligible recommenders only. A new version goes here after it passes the counterfactual tests.
FEED_VERSIONS = ("baseline-v0",)


def get_recommender(version: str, settings: Settings) -> Recommender:
    if version == "baseline-v0":
        return BaselineV0(settings.feed_quotas, settings.cold_start_impressions, settings.discussion_min_commenters)
    raise ApiError(422, "validation_error", "Unknown algorithm.", {"algo": f"Use one of: {', '.join(FEED_VERSIONS)}."})
