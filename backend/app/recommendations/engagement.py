"""A deliberately conventional, rich-get-richer ranker. Demo comparator only (Q22): never a feed mode."""

import math
from collections.abc import Sequence
from datetime import datetime

from app.recommendations.base import Candidate, RankedPost, ViewerHistory


class EngagementDemo:
    version = "engagement-demo"
    quotas: dict[str, float] = {}

    def build_slate(
        self,
        candidates: Sequence[Candidate],
        count: int,
        seed: int,
        now: datetime,
        history: ViewerHistory | None = None,
    ) -> list[RankedPost]:
        def score(c: Candidate) -> float:
            age_hours = max((now - c.created_at).total_seconds() / 3600, 0.0)
            return (
                1.0 * math.log1p(c.impressions)
                + 1.5 * math.log1p(c.author_impressions)
                + 0.8 * math.log1p(3 * c.distinct_commenters)
                - 0.002 * age_hours
            )

        ranked = sorted(candidates, key=lambda c: (-score(c), c.post_id))
        return [RankedPost(c.post_id, "popular") for c in ranked[:count]]
