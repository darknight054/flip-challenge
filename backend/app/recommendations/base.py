"""The recommender contract (PLAN §3.2, Q21).

A recommender only ever sees `Candidate` objects: viewer-independent, global features of posts that are
already eligible for the viewer. Unfollows and dislikes are applied *before* this point as filters, so no
recommender can use them as ranking signals. That is what makes the counterfactual test in
tests/test_feed_invariants.py meaningful.
"""

from collections.abc import Sequence
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
class RankedPost:
    post_id: int
    reason_code: str


class Recommender(Protocol):
    version: str

    def build_slate(
        self, candidates: Sequence[Candidate], count: int, seed: int, now: datetime
    ) -> list[RankedPost]: ...
