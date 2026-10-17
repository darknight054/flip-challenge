import time
from dataclasses import dataclass

from fastapi import Request
from sqlmodel import Session, col, select

from app.core.config import Settings
from app.core.time import utcnow
from app.core.topics import TOPICS
from app.models import Post, User
from app.recommendations.base import Candidate
from app.recommendations.comparison import SimulationResult, simulate
from app.recommendations.engagement import EngagementDemo
from app.recommendations.features import load_candidates
from app.recommendations.registry import get_recommender
from app.schemas import (
    Comparison,
    ComparisonDataset,
    ComparisonSlot,
    Pool,
    PoolPreview,
    PoolPreviewList,
    RankerMetrics,
    RankerOut,
    Recipe,
    SimCreator,
    SimRanker,
    Simulation,
    SlotAuthor,
    TopicViews,
    ViewMix,
)
from app.services.feed import eligible_candidates, viewer_history
from app.services.serializers import serialize_posts, users_by_id

POOL_COPY = {
    "fresh": ("Fresh", "New posts and new voices."),
    "underexposed": ("Underexposed", "Voices few people have seen."),
    "discussion": ("Discussion", "Replies from 3+ different people."),
    "wildcard": ("Wildcard", "Picked at random."),
    "outside_your_usual": ("Outside your usual", "Topics and voices you've seen least lately."),
}
NEVER_USED = [
    "Likes (there are none)",
    "Who you unfollowed",
    "Who disliked what",
    "Popularity of any kind",
]
SIMULATED_VIEWERS = 50
SIMULATED_SLATE = 20
SLATE_SIZE = 10
PREVIEW_PER_POOL = 3
CACHE_SECONDS = 300


def recipe(settings: Settings) -> Recipe:
    return Recipe(
        active_version=settings.active_algorithm,
        pools=[
            Pool(code=code, label=POOL_COPY[code][0], share=round(share, 4), description=POOL_COPY[code][1])
            for code, share in get_recommender(settings.active_algorithm, settings).quotas.items()
            if code in POOL_COPY and share > 0
        ],
        never_used=NEVER_USED,
    )


@dataclass(frozen=True)
class _Run:
    key: str
    label: str
    demo_only: bool
    result: SimulationResult


@dataclass(frozen=True)
class _Simulations:
    candidates: list[Candidate]
    authors: dict[int, User]
    runs: list[_Run]


def _simulations(db: Session, settings: Settings, request: Request) -> _Simulations:
    """Engagement-style vs the active recommender on the same posts, cached for a few minutes (Q22)."""
    cached = getattr(request.app.state, "simulation_cache", None)
    if cached and time.monotonic() - cached[0] < CACHE_SECONDS:
        return cached[1]
    candidates = load_candidates(db)
    now = utcnow()
    rankers = [
        ("engagement-demo", "Engagement-style", True, EngagementDemo()),
        (settings.active_algorithm, "Serendipity", False, get_recommender(settings.active_algorithm, settings)),
    ]
    runs = [
        _Run(key, label, demo_only, simulate(rec, candidates, now, SIMULATED_VIEWERS, SIMULATED_SLATE, SLATE_SIZE))
        for key, label, demo_only, rec in rankers
    ]
    value = _Simulations(candidates, users_by_id(db, {c.author_id for c in candidates}), runs)
    request.app.state.simulation_cache = (time.monotonic(), value)
    return value


def comparison(db: Session, settings: Settings, request: Request) -> Comparison:
    sims = _simulations(db, settings, request)
    by_id = {c.post_id: c for c in sims.candidates}

    def slot(position: int, post_id: int) -> ComparisonSlot:
        author = sims.authors[by_id[post_id].author_id]
        return ComparisonSlot(
            position=position,
            post_id=post_id,
            topic=by_id[post_id].topic,
            author=SlotAuthor(
                username=author.username, display_name=author.display_name, is_synthetic=author.is_synthetic
            ),
        )

    return Comparison(
        dataset=ComparisonDataset(
            posts=len(sims.candidates), creators=len(sims.authors), simulated_viewers=SIMULATED_VIEWERS
        ),
        slate_size=SLATE_SIZE,
        rankers=[
            RankerOut(
                key=run.key,
                label=run.label,
                demo_only=run.demo_only,
                slots=[slot(i, item.post_id) for i, item in enumerate(run.result.shown)],
                metrics=RankerMetrics(
                    attention_gap=run.result.attention_gap,
                    topics_covered=run.result.topics_covered,
                    distinct_creators=run.result.distinct_creators,
                ),
            )
            for run in sims.runs
        ],
    )


def simulation(db: Session, settings: Settings, request: Request) -> Simulation:
    """Viewer-by-viewer slates for the animated comparison on "How it works"."""
    sims = _simulations(db, settings, request)
    return Simulation(
        viewers=SIMULATED_VIEWERS,
        slate_size=SIMULATED_SLATE,
        creators=[
            SimCreator(id=u.id, username=u.username, display_name=u.display_name)
            for u in sorted(sims.authors.values(), key=lambda u: u.id)
        ],
        rankers=[
            SimRanker(key=run.key, label=run.label, demo_only=run.demo_only, slates=run.result.slates)
            for run in sims.runs
        ],
    )


def pool_preview(db: Session, settings: Settings, viewer: User) -> PoolPreviewList:
    """What each pool of the active recipe would pick from *this viewer's* eligible posts right now.
    Read-only: nothing is delivered or recorded."""
    now = utcnow()
    recommender = get_recommender(settings.active_algorithm, settings)
    pools = recommender.preview_pools(
        eligible_candidates(db, viewer, None, now, settings),
        now,
        viewer_history(db, viewer, now, settings),
        seed=viewer.id,
    )
    used: set[int] = set()
    out = []
    for code, share in recommender.quotas.items():
        if code not in POOL_COPY or share <= 0:
            continue
        picks = [c.post_id for c in pools.get(code, []) if c.post_id not in used][:PREVIEW_PER_POOL]
        used.update(picks)
        rows = {p.id: p for p in db.exec(select(Post).where(col(Post.id).in_(picks))).all()} if picks else {}
        out.append(
            PoolPreview(
                code=code,
                label=POOL_COPY[code][0],
                share=round(share, 4),
                description=POOL_COPY[code][1],
                posts=serialize_posts(db, [rows[pid] for pid in picks], viewer),
            )
        )
    return PoolPreviewList(active_version=settings.active_algorithm, pools=out)


def view_mix(db: Session, settings: Settings, viewer: User) -> ViewMix:
    history = viewer_history(db, viewer, utcnow(), settings)
    order = {slug: i for i, (slug, _) in enumerate(TOPICS)}
    topics = sorted(TOPICS, key=lambda t: (-history.topic_views.get(t[0], 0), order[t[0]]))
    return ViewMix(
        window_days=settings.seen_least_window_days,
        total_views=history.total,
        min_views=settings.seen_least_min_views,
        topics=[TopicViews(slug=slug, label=label, views=history.topic_views.get(slug, 0)) for slug, label in topics],
    )
