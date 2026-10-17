from datetime import timedelta

from app.core.time import utcnow
from app.recommendations.base import Candidate
from app.recommendations.baseline import BaselineV0, quota_counts
from app.recommendations.comparison import gini, simulate
from app.recommendations.engagement import EngagementDemo

NOW = utcnow()
QUOTAS = {"fresh": 0.3, "underexposed": 0.3, "discussion": 0.2, "wildcard": 0.2}
TOPICS = ["science", "tech", "food", "sport", "health"]


def candidate(post_id: int, author_id: int, **overrides) -> Candidate:
    values = dict(
        post_id=post_id,
        author_id=author_id,
        topic=TOPICS[post_id % len(TOPICS)],
        created_at=NOW - timedelta(hours=post_id),
        impressions=0,
        deliveries=0,
        author_impressions=0,
        author_post_count=3,
        is_first_post=False,
        distinct_commenters=0,
    )
    return Candidate(**{**values, **overrides})


def community() -> list[Candidate]:
    """40 authors x 3 posts. Authors 0-4 are 'famous' (heavily seen); every 7th post has a discussion."""
    out = []
    for author in range(40):
        famous = author < 5
        for i in range(3):
            pid = author * 3 + i
            out.append(
                candidate(
                    pid,
                    author,
                    impressions=40 if famous else (pid % 4),
                    author_impressions=120 if famous else 6,
                    distinct_commenters=4 if pid % 7 == 0 else 0,
                )
            )
    return out


def test_quota_counts_split_exactly() -> None:
    assert quota_counts(QUOTAS, 20) == {"fresh": 6, "underexposed": 6, "discussion": 4, "wildcard": 4}
    for n in range(1, 31):
        assert sum(quota_counts(QUOTAS, n).values()) == n


def test_slate_is_deterministic_per_seed_and_varies_across_seeds() -> None:
    rec, pool = BaselineV0(QUOTAS), community()
    a = rec.build_slate(pool, 20, seed=7, now=NOW)
    assert a == rec.build_slate(list(reversed(pool)), 20, seed=7, now=NOW)  # input order doesn't matter
    assert any(rec.build_slate(pool, 20, seed=s, now=NOW) != a for s in range(8, 12))


def test_one_post_per_author_and_no_adjacent_topics_when_possible() -> None:
    slate = BaselineV0(QUOTAS).build_slate(community(), 20, seed=3, now=NOW)
    by_id = {c.post_id: c for c in community()}
    authors = [by_id[r.post_id].author_id for r in slate]
    topics = [by_id[r.post_id].topic for r in slate]
    assert len(slate) == 20 and len(set(authors)) == 20
    assert all(a != b for a, b in zip(topics, topics[1:], strict=False))


def test_first_posts_get_a_cold_start_slot() -> None:
    pool = [*community(), candidate(999, 99, is_first_post=True, created_at=NOW - timedelta(hours=30))]
    for seed in range(10):
        assert 999 in {r.post_id for r in BaselineV0(QUOTAS).build_slate(pool, 20, seed=seed, now=NOW)}


def test_fills_the_page_when_few_authors_remain() -> None:
    pool = [candidate(i, author_id=i % 2) for i in range(6)]
    assert len(BaselineV0(QUOTAS).build_slate(pool, 5, seed=1, now=NOW)) == 5


def test_baseline_spreads_attention_where_engagement_concentrates_it() -> None:
    pool = community()
    baseline = simulate(BaselineV0(QUOTAS), pool, NOW, viewers=30)
    engagement = simulate(EngagementDemo(), pool, NOW, viewers=30)
    assert baseline.attention_gap < engagement.attention_gap
    assert baseline.distinct_creators >= engagement.distinct_creators


def test_gini() -> None:
    assert gini([1, 1, 1, 1]) == 0.0
    assert gini([0, 0, 0, 10]) == 0.75
    assert gini([]) == 0.0
