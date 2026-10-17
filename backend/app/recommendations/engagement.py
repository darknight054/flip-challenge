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
        return [RankedPost(c.post_id, "popular") for c in self._ranked(candidates, now)[:count]]

    def preview_pools(
        self, candidates: Sequence[Candidate], now: datetime, history: ViewerHistory | None = None, seed: int = 0
    ) -> dict[str, list[Candidate]]:
        return {"popular": self._ranked(candidates, now)}

    @staticmethod
    def _ranked(candidates: Sequence[Candidate], now: datetime) -> list[Candidate]:
        def score(c: Candidate) -> float:
            age_hours = max((now - c.created_at).total_seconds() / 3600, 0.0)
            return (
                1.0 * math.log1p(c.impressions)
                + 1.5 * math.log1p(c.author_impressions)
                + 0.8 * math.log1p(3 * c.distinct_commenters)
                - 0.002 * age_hours
            )

        return sorted(candidates, key=lambda c: (-score(c), c.post_id))
