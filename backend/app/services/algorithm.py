import time

from fastapi import Request
from sqlmodel import Session

from app.core.config import Settings
from app.core.time import utcnow
from app.recommendations.comparison import simulate
from app.recommendations.engagement import EngagementDemo
from app.recommendations.features import load_candidates
from app.recommendations.registry import get_recommender
from app.schemas import (
    Comparison,
    ComparisonDataset,
    ComparisonSlot,
    Pool,
    RankerMetrics,
    RankerOut,
    Recipe,
    SlotAuthor,
)
from app.services.serializers import users_by_id

POOL_COPY = {
    "fresh": ("Fresh", "New posts and new voices."),
    "underexposed": ("Underexposed", "Voices few people have seen."),
    "discussion": ("Discussion", "Replies from 3+ different people."),
    "wildcard": ("Wildcard", "Picked at random."),
}
NEVER_USED = [
    "Likes (there are none)",
    "Who you unfollowed",
    "Who disliked what",
    "Dislike counts",
    "Popularity of any kind",
]
SIMULATED_VIEWERS = 50
SLATE_SIZE = 10
CACHE_SECONDS = 300


def recipe(settings: Settings) -> Recipe:
    return Recipe(
        active_version=settings.active_algorithm,
        pools=[
            Pool(code=code, label=POOL_COPY[code][0], share=share, description=POOL_COPY[code][1])
            for code, share in settings.feed_quotas.items()
            if code in POOL_COPY
        ],
        never_used=NEVER_USED,
    )


def comparison(db: Session, settings: Settings, request: Request) -> Comparison:
    cached = getattr(request.app.state, "comparison_cache", None)
    if cached and time.monotonic() - cached[0] < CACHE_SECONDS:
        return cached[1]

    candidates = load_candidates(db)
    now = utcnow()
    by_id = {c.post_id: c for c in candidates}
    authors = users_by_id(db, {c.author_id for c in candidates})
    rankers = [
        ("engagement-demo", "Engagement-style", True, EngagementDemo()),
        (settings.active_algorithm, "Serendipity", False, get_recommender(settings.active_algorithm, settings)),
    ]
    out: list[RankerOut] = []
    for key, label, demo_only, recommender in rankers:
        result = simulate(recommender, candidates, now, viewers=SIMULATED_VIEWERS, slate_size=20, shown=SLATE_SIZE)
        slots = []
        for position, item in enumerate(result.shown):
            author = authors[by_id[item.post_id].author_id]
            slots.append(
                ComparisonSlot(
                    position=position,
                    post_id=item.post_id,
                    topic=by_id[item.post_id].topic,
                    author=SlotAuthor(
                        username=author.username, display_name=author.display_name, is_synthetic=author.is_synthetic
                    ),
                )
            )
        out.append(
            RankerOut(
                key=key,
                label=label,
                demo_only=demo_only,
                slots=slots,
                metrics=RankerMetrics(
                    attention_gap=result.attention_gap,
                    topics_covered=result.topics_covered,
                    distinct_creators=result.distinct_creators,
                ),
            )
        )

    value = Comparison(
        dataset=ComparisonDataset(posts=len(candidates), creators=len(authors), simulated_viewers=SIMULATED_VIEWERS),
        slate_size=SLATE_SIZE,
        rankers=out,
    )
    request.app.state.comparison_cache = (time.monotonic(), value)
    return value
