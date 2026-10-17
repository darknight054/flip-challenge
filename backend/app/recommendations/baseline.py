"""baseline-v0: four pools with quotas, then per-slate diversification (PLAN §3.2)."""

import random
from collections import Counter, defaultdict
from collections.abc import Callable, Sequence
from datetime import datetime

from app.recommendations.base import Candidate, RankedPost, ViewerHistory

POOL_ORDER = ("fresh", "underexposed", "discussion", "wildcard")
# Where to look when a pool runs dry. Labels stay honest: an item is tagged with the pool it came from.
FALLBACK_ORDER = ("fresh", "wildcard", "underexposed", "discussion", "outside_your_usual")


def _age_hours(candidate: Candidate, now: datetime) -> float:
    return max((now - candidate.created_at).total_seconds() / 3600, 0.0)


def _jittered(
    items: list[Candidate], key: Callable[[Candidate], float], rng: random.Random, spread: float
) -> list[Candidate]:
    """Sort by `key` ascending, with seeded jitter so sessions differ without losing the ordering's intent."""
    ranked = sorted(items, key=lambda c: (key(c), c.post_id))
    return [c for _, c in sorted(((i + rng.random() * spread, c) for i, c in enumerate(ranked)), key=lambda t: t[0])]


def quota_counts(quotas: dict[str, float], count: int) -> dict[str, int]:
    """Largest-remainder split of `count` slots across pools."""
    total = sum(quotas.values()) or 1.0
    raw = {code: count * share / total for code, share in quotas.items()}
    counts = {code: int(value) for code, value in raw.items()}
    order = list(quotas)
    leftovers = sorted(raw, key=lambda code: (-(raw[code] - counts[code]), order.index(code)))
    for code in leftovers[: count - sum(counts.values())]:
        counts[code] += 1
    return counts


def avoid_adjacent_topics(items: list[tuple[Candidate, str]]) -> list[tuple[Candidate, str]]:
    out = list(items)
    for i in range(1, len(out)):
        if out[i][0].topic != out[i - 1][0].topic:
            continue
        for j in range(i + 1, len(out)):
            if out[j][0].topic != out[i - 1][0].topic:
                out[i], out[j] = out[j], out[i]
                break
    return out


class BaselineV0:
    version = "baseline-v0"

    def __init__(self, quotas: dict[str, float], cold_start_impressions: int = 5, discussion_min: int = 3) -> None:
        self.quotas = {code: quotas.get(code, 0.0) for code in POOL_ORDER}
        self.cold_start_impressions = cold_start_impressions
        self.discussion_min = discussion_min

    # --- pools: each returns an ordered list of candidates --------------------------------------

    def _fresh(self, cands: list[Candidate], rng: random.Random, now: datetime) -> list[Candidate]:
        cold = [c for c in cands if c.is_first_post and c.impressions < self.cold_start_impressions]
        cold_ids = {c.post_id for c in cold}
        recent = [c for c in cands if c.post_id not in cold_ids]
        by_age = lambda c: _age_hours(c, now)  # noqa: E731
        return _jittered(cold, by_age, rng, 2.0) + _jittered(recent, by_age, rng, 4.0)

    def _underexposed(self, cands: list[Candidate], rng: random.Random, now: datetime) -> list[Candidate]:
        def exposure_rate(c: Candidate) -> float:
            # Fewest verified views relative to age; served-but-unseen counts a little while views are sparse.
            post_rate = (c.impressions + 0.3 * c.deliveries) / max(_age_hours(c, now), 6.0)
            creator_load = c.author_impressions / max(c.author_post_count, 1)
            return post_rate + 0.02 * creator_load

        return _jittered(cands, exposure_rate, rng, 3.0)

    def _discussion(self, cands: list[Candidate], rng: random.Random, now: datetime) -> list[Candidate]:
        talking = [c for c in cands if c.distinct_commenters >= self.discussion_min]
        return _jittered(talking, lambda c: -c.distinct_commenters + _age_hours(c, now) / 240, rng, 2.0)

    def _wildcard(self, cands: list[Candidate], rng: random.Random, _now: datetime) -> list[Candidate]:
        by_topic: dict[str, list[Candidate]] = defaultdict(list)
        for c in cands:
            by_topic[c.topic].append(c)
        topics = sorted(by_topic)
        rng.shuffle(topics)
        for topic in topics:
            rng.shuffle(by_topic[topic])
        out: list[Candidate] = []
        while any(by_topic[t] for t in topics):
            out.extend(by_topic[t].pop() for t in topics if by_topic[t])
        return out

    def _pools(
        self, cands: list[Candidate], rng: random.Random, now: datetime, history: ViewerHistory | None
    ) -> dict[str, list[Candidate]]:
        return {
            "fresh": self._fresh(cands, rng, now),
            "underexposed": self._underexposed(cands, rng, now),
            "discussion": self._discussion(cands, rng, now),
            "wildcard": self._wildcard(cands, rng, now),
        }

    # --- slate assembly ---------------------------------------------------------------------------

    def build_slate(
        self,
        candidates: Sequence[Candidate],
        count: int,
        seed: int,
        now: datetime,
        history: ViewerHistory | None = None,
    ) -> list[RankedPost]:
        cands = sorted(candidates, key=lambda c: c.post_id)
        if not cands or count <= 0:
            return []
        rng = random.Random(seed)
        pools = self._pools(cands, rng, now, history)
        slots = [code for code, n in quota_counts(self.quotas, count).items() for _ in range(n)]
        rng.shuffle(slots)

        used: set[int] = set()
        per_author: Counter[int] = Counter()
        picked: list[tuple[Candidate, str]] = []

        def take(code: str, author_limit: int | None) -> Candidate | None:
            for c in pools.get(code, ()):
                if c.post_id in used:
                    continue
                if author_limit is not None and per_author[c.author_id] >= author_limit:
                    continue
                return c
            return None

        for slot in slots[: min(count, len(cands))]:
            choice: tuple[Candidate, str] | None = None
            # One post per author per page if possible, then relax rather than leave a hole.
            for limit in (1, 2, None):
                for code in (slot, *(f for f in FALLBACK_ORDER if f != slot)):
                    c = take(code, limit)
                    if c is not None:
                        choice = (c, code)
                        break
                if choice:
                    break
            if choice is None:
                break
            used.add(choice[0].post_id)
            per_author[choice[0].author_id] += 1
            picked.append(choice)

        return [RankedPost(c.post_id, code) for c, code in avoid_adjacent_topics(picked)]
