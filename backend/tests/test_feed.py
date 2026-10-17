"""Feed invariants from PLAN §1.6 and §3.4, including the no-clustering counterfactual tests."""

from datetime import timedelta

from sqlmodel import select

from app.core.time import utcnow
from app.models import FeedDelivery, User
from app.recommendations.registry import get_recommender
from app.services.feed import eligible_candidates
from tests.conftest import API, post

TOPICS = ["science", "tech", "food", "sport", "health", "culture_arts"]


def populate(user_client, authors: int = 6, posts_each: int = 4) -> dict:
    clients = {}
    for a in range(authors):
        client, _ = user_client(f"author{a}")
        clients[f"author{a}"] = client
        for i in range(posts_each):
            post(client, f"Post {i} by author{a}", TOPICS[(a + i) % len(TOPICS)])
    return clients


def read_whole_feed(client, limit: int = 5) -> list[dict]:
    pages, cursor = [], None
    while True:
        params = {"limit": limit, **({"cursor": cursor} if cursor else {})}
        page = client.get(f"{API}/feed", params=params).json()
        pages.append(page)
        if page["end_of_feed"]:
            return pages
        cursor = page["next_cursor"]


def ids(pages: list[dict]) -> list[int]:
    return [item["post"]["id"] for page in pages for item in page["items"]]


def test_everyone_is_visible_by_default_including_brand_new_authors(user_client) -> None:
    populate(user_client)
    newcomer, _ = user_client("newcomer")
    first = post(newcomer, "Hello, first post.", "everyday_life")
    viewer, _ = user_client("viewer")

    pages = read_whole_feed(viewer)
    seen = ids(pages)
    assert len(seen) == len(set(seen)) == 25  # every post, no duplicates
    assert first["id"] in seen
    assert pages[-1]["next_cursor"] is None
    assert {i["reason_code"] for p in pages for i in p["items"]} <= {"fresh", "underexposed", "discussion", "wildcard"}

    caught_up = viewer.get(f"{API}/feed").json()  # new session, nothing left
    assert caught_up["items"] == [] and caught_up["end_of_feed"] is True


def test_own_posts_are_not_in_your_feed(user_client) -> None:
    populate(user_client, authors=2, posts_each=2)
    viewer, _ = user_client("viewer")
    own = post(viewer, "Mine")
    assert own["id"] not in ids(read_whole_feed(viewer))


def test_unfollow_removes_only_that_author(user_client, db) -> None:
    populate(user_client)
    viewer, _ = user_client("viewer")
    viewer.put(f"{API}/users/author0/unfollow")
    authors = {item["post"]["author"]["username"] for page in read_whole_feed(viewer) for item in page["items"]}
    assert "author0" not in authors and authors == {f"author{a}" for a in range(1, 6)}


def test_disliked_post_stays_in_place_but_is_not_served_again(user_client) -> None:
    populate(user_client)
    viewer, _ = user_client("viewer")
    first = viewer.get(f"{API}/feed", params={"limit": 5}).json()
    cursor = first["next_cursor"]
    second = viewer.get(f"{API}/feed", params={"limit": 5, "cursor": cursor}).json()
    target = second["items"][2]["post"]["id"]
    viewer.put(f"{API}/posts/{target}/dislike", json={"reason": "disagree"})

    # Replaying the page (a refetch) keeps the disliked post exactly where it was (Q6).
    replay = viewer.get(f"{API}/feed", params={"limit": 5, "cursor": cursor}).json()
    assert ids([replay]) == ids([second])
    assert replay["items"][2]["post"]["viewer_dislike"] == {"reason": "disagree"}

    later = read_whole_feed_from(viewer, second["next_cursor"])
    assert target not in ids(later)
    assert target not in ids([viewer.get(f"{API}/feed").json()])  # nor in a brand-new session


def read_whole_feed_from(client, cursor: str, limit: int = 5) -> list[dict]:
    pages = []
    while cursor:
        page = client.get(f"{API}/feed", params={"limit": limit, "cursor": cursor}).json()
        pages.append(page)
        cursor = page["next_cursor"]
    return pages


def test_page_replay_is_stable(user_client) -> None:
    populate(user_client)
    viewer, _ = user_client("viewer")
    first = viewer.get(f"{API}/feed", params={"limit": 5}).json()
    second = viewer.get(f"{API}/feed", params={"limit": 5, "cursor": first["next_cursor"]}).json()
    again = viewer.get(f"{API}/feed", params={"limit": 5, "cursor": first["next_cursor"]}).json()
    assert ids([second]) == ids([again]) and not set(ids([first])) & set(ids([second]))


def test_cursor_belongs_to_its_viewer(user_client) -> None:
    populate(user_client, authors=2, posts_each=4)
    alice, _ = user_client("alice")
    bob, _ = user_client("bob")
    cursor = alice.get(f"{API}/feed", params={"limit": 2}).json()["next_cursor"]
    r = bob.get(f"{API}/feed", params={"cursor": cursor})
    assert r.status_code == 422 and r.json()["error"]["fields"] == {"cursor": "Invalid cursor."}


def test_impressions_are_deduplicated_and_ignore_own_posts(user_client) -> None:
    populate(user_client, authors=2, posts_each=2)
    viewer, _ = user_client("viewer")
    own = post(viewer, "Mine")
    page = viewer.get(f"{API}/feed").json()
    first, second = page["items"][0]["post"]["id"], page["items"][1]["post"]["id"]
    body = {"session_id": page["session_id"], "items": [{"post_id": first, "position": 0}]}
    assert viewer.post(f"{API}/feed/impressions", json=body).json() == {"accepted": 1, "duplicates": 0}
    body["items"] += [{"post_id": second, "position": 1}, {"post_id": own["id"], "position": None}]
    assert viewer.post(f"{API}/feed/impressions", json=body).json() == {"accepted": 1, "duplicates": 1}


def test_served_but_unseen_posts_resurface_after_24_hours(user_client, db, app) -> None:
    populate(user_client, authors=2, posts_each=2)
    viewer, viewer_user = user_client("viewer")
    page = viewer.get(f"{API}/feed").json()
    seen_id, unseen_id = page["items"][0]["post"]["id"], page["items"][1]["post"]["id"]
    viewer.post(f"{API}/feed/impressions", json={"session_id": page["session_id"], "items": [{"post_id": seen_id}]})
    assert viewer.get(f"{API}/feed").json()["items"] == []

    for delivery in db.exec(select(FeedDelivery).where(FeedDelivery.viewer_id == viewer_user["id"])).all():
        delivery.delivered_at = utcnow() - timedelta(hours=25)
        db.add(delivery)
    db.commit()
    resurfaced = set(ids([viewer.get(f"{API}/feed").json()]))
    assert unseen_id in resurfaced and seen_id not in resurfaced


# --- the counterfactual tests (PLAN §3.4): no clustering through unfollows or dislikes ---------------


def test_same_eligible_pool_gives_identical_ranking_regardless_of_history(user_client, db, app) -> None:
    clients = populate(user_client)
    alice, _ = user_client("alice")
    bob, _ = user_client("bob")
    # Alice unfollows author0; Bob dislikes every one of author0's posts instead. Different histories,
    # identical eligible pools. Bob also unfollows someone with no posts, which must change nothing.
    alice.put(f"{API}/users/author0/unfollow")
    for p in clients["author0"].get(f"{API}/users/author0/posts").json()["items"]:
        bob.put(f"{API}/posts/{p['id']}/dislike", json={"reason": "disagree"})
    user_client("silent")
    bob.put(f"{API}/users/silent/unfollow")

    now = utcnow()
    users = {u.username: u for u in db.exec(select(User)).all()}
    pool_a = eligible_candidates(db, users["alice"], None, now, app.state.settings)
    pool_b = eligible_candidates(db, users["bob"], None, now, app.state.settings)
    assert pool_a == pool_b

    recommender = get_recommender("baseline-v0", app.state.settings)
    for seed in range(5):
        assert recommender.build_slate(pool_a, 10, seed, now) == recommender.build_slate(pool_b, 10, seed, now)


def test_one_viewers_actions_never_change_another_viewers_pool(user_client, db, app) -> None:
    populate(user_client)
    alice, _ = user_client("alice")
    user_client("bob")
    now = utcnow()
    bob = db.exec(select(User).where(User.username == "bob")).one()
    before = eligible_candidates(db, bob, None, now, app.state.settings)

    alice.put(f"{API}/users/author1/unfollow")
    for item in alice.get(f"{API}/feed", params={"limit": 5}).json()["items"][:3]:
        alice.put(f"{API}/posts/{item['post']['id']}/dislike", json={"reason": "low_effort"})

    after = eligible_candidates(db, bob, None, now, app.state.settings)
    # Alice's feed deliveries change global delivery counts (exposure), but nothing she *did* — unfollows or
    # dislikes — can alter which posts Bob may see or how they're described.
    strip = lambda pool: [(c.post_id, c.author_id, c.topic, c.impressions) for c in pool]  # noqa: E731
    assert strip(before) == strip(after)
