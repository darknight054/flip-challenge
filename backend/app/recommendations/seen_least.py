"""seen-least-v1: baseline-v0 plus an "Outside your usual" pool (Q18, PLAN §3.3 v1-S).

The extra pool prefers topics and creators the viewer has seen least recently: it personalises *against*
the viewer's bubble. Its only input is `ViewerHistory` (the viewer's own impressions). Unfollows, dislikes
and other people's behaviour never reach it. Until the viewer has `min_views` recent views the pool stays
off and its slots fall back to the baseline pools.
"""

import random
from datetime import datetime

from app.recommendations.base import Candidate, ViewerHistory
from app.recommendations.baseline import BaselineV0, _jittered


class SeenLeastV1(BaselineV0):
    version = "seen-least-v1"

    def __init__(
        self,
        quotas: dict[str, float],
        share: float = 0.2,
        min_views: int = 5,
        cold_start_impressions: int = 5,
        discussion_min: int = 3,
    ) -> None:
        super().__init__(quotas, cold_start_impressions, discussion_min)
        # Baseline pools keep their proportions and make room for the new one.
        self.quotas = {code: q * (1 - share) for code, q in self.quotas.items()} | {"outside_your_usual": share}
        self.min_views = min_views

    def _pools(
        self, cands: list[Candidate], rng: random.Random, now: datetime, history: ViewerHistory | None
    ) -> dict[str, list[Candidate]]:
        pools = super()._pools(cands, rng, now, history)
        if history is not None and history.total >= self.min_views:
            pools["outside_your_usual"] = self._outside_your_usual(cands, rng, history)
        return pools

    def _outside_your_usual(
        self, cands: list[Candidate], rng: random.Random, history: ViewerHistory
    ) -> list[Candidate]:
        total = history.total

        def familiarity(c: Candidate) -> float:
            topic_share = history.topic_views.get(c.topic, 0) / total
            author_seen = min(history.author_views.get(c.author_id, 0), 5) / 5
            return topic_share + 0.5 * author_seen

        return _jittered(cands, familiarity, rng, 3.0)
