"""The recommender contract (PLAN §3.2, Q21).

A recommender only ever sees `Candidate` objects: viewer-independent, global features of posts that are
already eligible for the viewer. Unfollows and dislikes are applied *before* this point as filters, so no
recommender can use them as ranking signals. That is what makes the counterfactual test in
tests/test_feed.py meaningful.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True, slots=True)
class Candidate:
    post_id: int
    author_id: int
    topic: str
    created_at: datetime
    impressions: int  # verified, deduplicated views by anyone
    deliveries: int  # times served in any feed (fallback while impressions are sparse)
    author_impressions: int  # total verified views across the author's posts
    author_post_count: int
    is_first_post: bool  # the author's earliest visible post (cold start)
    distinct_commenters: int  # people other than the author with visible comments


@dataclass(frozen=True, slots=True)
class ViewerHistory:
    """The viewer's own recent views by topic and author: the only per-viewer input a recommender may use.

    Built from impressions alone (what was actually on screen), never from unfollows or dislikes, and it is
    used to push the viewer *away* from what they've already seen (Q18).
    """

    topic_views: Mapping[str, int]
    author_views: Mapping[int, int]

    @property
    def total(self) -> int:
        return sum(self.topic_views.values())


@dataclass(frozen=True, slots=True)
class RankedPost:
    post_id: int
    reason_code: str


class Recommender(Protocol):
    version: str
    quotas: dict[str, float]  # pool code -> share of each page

    def build_slate(
        self,
        candidates: Sequence[Candidate],
        count: int,
        seed: int,
        now: datetime,
        history: ViewerHistory | None = None,
    ) -> list[RankedPost]: ...
