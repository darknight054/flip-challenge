from app.core.config import Settings
from app.core.errors import ApiError
from app.recommendations.base import Recommender
from app.recommendations.baseline import BaselineV0
from app.recommendations.seen_least import SeenLeastV1

# Feed-eligible recommenders only. A new version goes here after it passes the counterfactual tests.
FEED_VERSIONS = ("baseline-v0", "seen-least-v1")


def get_recommender(version: str, settings: Settings) -> Recommender:
    if version == "baseline-v0":
        return BaselineV0(settings.feed_quotas, settings.cold_start_impressions, settings.discussion_min_commenters)
    if version == "seen-least-v1":
        return SeenLeastV1(
            settings.feed_quotas,
            share=settings.seen_least_share,
            min_views=settings.seen_least_min_views,
            cold_start_impressions=settings.cold_start_impressions,
            discussion_min=settings.discussion_min_commenters,
        )
    raise ApiError(422, "validation_error", "Unknown algorithm.", {"algo": f"Use one of: {', '.join(FEED_VERSIONS)}."})
