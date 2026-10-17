"""Side-by-side simulation for the "How it works" page (Q22).

Every ranker serves `viewers` neutral viewers in turn on the same posts. Exposure feeds back between
viewers, so a rich-get-richer ranker concentrates attention while baseline-v0 spreads it.
"""

from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import datetime

from app.recommendations.base import Candidate, RankedPost, Recommender


def gini(values: Sequence[float]) -> float:
    xs = sorted(values)
    n, total = len(xs), sum(xs)
    if n == 0 or total == 0:
        return 0.0
    weighted = sum((i + 1) * x for i, x in enumerate(xs))
    return (2 * weighted) / (n * total) - (n + 1) / n


@dataclass(frozen=True)
class SimulationResult:
    shown: list[RankedPost]
    attention_gap: float
    topics_covered: int
    distinct_creators: int


def simulate(
    recommender: Recommender,
    candidates: Sequence[Candidate],
    now: datetime,
    viewers: int = 50,
    slate_size: int = 20,
    shown: int = 10,
) -> SimulationResult:
    by_id = {c.post_id: c for c in candidates}
    post_views: Counter[int] = Counter()
    author_views: Counter[int] = Counter()
    exposure: Counter[int] = Counter({c.author_id: 0 for c in candidates})
    first: list[RankedPost] = []

    for viewer in range(viewers):
        current = [
            replace(
                c,
                impressions=c.impressions + post_views[c.post_id],
                author_impressions=c.author_impressions + author_views[c.author_id],
            )
            for c in candidates
        ]
        slate = recommender.build_slate(current, slate_size, seed=viewer, now=now)
        if viewer == 0:
            first = slate[:shown]
        for item in slate:
            author = by_id[item.post_id].author_id
            post_views[item.post_id] += 1
            author_views[author] += 1
            exposure[author] += 1

    shown_posts = [by_id[item.post_id] for item in first]
    return SimulationResult(
        shown=first,
        attention_gap=round(gini(list(exposure.values())), 2),
        topics_covered=len({c.topic for c in shown_posts}),
        distinct_creators=len({c.author_id for c in shown_posts}),
    )
