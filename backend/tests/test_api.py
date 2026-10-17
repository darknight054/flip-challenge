import json
from pathlib import Path

from tests.conftest import API, PASSWORD, post

EXAMPLES_DIR = Path(__file__).resolve().parent / "contract_examples"


def example(name: str, case: str) -> dict:
    data = json.loads((EXAMPLES_DIR / f"{name}.json").read_text())
    return next(c for c in data["cases"] if c["name"] == case)


# --- auth and the contract's error envelope ---------------------------------------------------------


def test_register_login_logout_cycle(new_client, user_client) -> None:
    client, user = user_client("mara", display_name="Mara Lind")
    assert user["display_name"] == "Mara Lind" and user["is_admin"] is False and user["is_synthetic"] is False
    assert client.get(f"{API}/me").json()["user"]["username"] == "mara"

    assert client.post(f"{API}/auth/logout").status_code == 204
    assert client.get(f"{API}/me").status_code == 401

    other = new_client()
    assert other.post(f"{API}/auth/login", json={"username": "mara", "password": PASSWORD}).status_code == 200
    assert other.get(f"{API}/me").status_code == 200


def test_error_responses_match_logged_examples(new_client, user_client) -> None:
    user_client("tomas")
    client = new_client()

    taken = example("auth.register", "username taken")
    r = client.post(f"{API}/auth/register", json=taken["request"]["body"])
    assert (r.status_code, r.json()) == (taken["response"]["status"], taken["response"]["body"])

    invalid = example("auth.register", "validation")
    r = client.post(f"{API}/auth/register", json=invalid["request"]["body"])
    assert (r.status_code, r.json()) == (invalid["response"]["status"], invalid["response"]["body"])

    wrong = example("auth.login", "wrong password")
    r = client.post(f"{API}/auth/login", json={"username": "tomas", "password": "nope-nope-nope"})
    assert (r.status_code, r.json()) == (wrong["response"]["status"], wrong["response"]["body"])

    unauth = example("me.get", "not logged in")
    r = client.get(f"{API}/me")
    assert (r.status_code, r.json()) == (unauth["response"]["status"], unauth["response"]["body"])


def test_post_validation_matches_logged_example(user_client) -> None:
    client, _ = user_client("mara")
    case = example("posts.create", "missing topic and too long")
    r = client.post(f"{API}/posts", json=case["request"]["body"])
    assert (r.status_code, r.json()) == (case["response"]["status"], case["response"]["body"])


def test_state_changing_requests_need_the_csrf_header(app, user_client) -> None:
    from fastapi.testclient import TestClient

    with TestClient(app) as bare:
        r = bare.post(f"{API}/auth/register", json={"username": "mara", "password": PASSWORD})
        assert r.status_code == 403 and r.json()["error"]["code"] == "csrf_failed"
        assert bare.get(f"{API}/health").status_code == 200


def test_rate_limit_returns_retry_after(app, new_client) -> None:
    app.state.settings.rate_limits_enabled = True
    client = new_client()
    codes = [client.post(f"{API}/auth/login", json={"username": "x", "password": "y"}).status_code for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429
    last = client.post(f"{API}/auth/login", json={"username": "x", "password": "y"})
    assert last.json()["error"]["retry_after"] >= 1 and "Retry-After" in last.headers


# --- posts --------------------------------------------------------------------------------------


def test_post_crud_and_ownership(user_client) -> None:
    mara, _ = user_client("mara")
    tomas, _ = user_client("tomas")
    created = post(mara, "  First post.  ", "everyday_life")
    assert created["body"] == "First post." and created["is_own"] is True and created["dislike_count"] == 0

    assert tomas.get(f"{API}/posts/{created['id']}").json()["is_own"] is False
    r = tomas.patch(f"{API}/posts/{created['id']}", json={"body": "hijack"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "forbidden"
    assert tomas.delete(f"{API}/posts/{created['id']}").status_code == 403

    edited = mara.patch(f"{API}/posts/{created['id']}", json={"body": "Edited."}).json()
    assert edited["body"] == "Edited." and edited["updated_at"] is not None

    assert mara.delete(f"{API}/posts/{created['id']}").status_code == 204
    assert tomas.get(f"{API}/posts/{created['id']}").status_code == 404


def test_profile_posts_paginate_newest_first(user_client) -> None:
    mara, _ = user_client("mara")
    ids = [post(mara, f"Post {i}")["id"] for i in range(5)]
    first = mara.get(f"{API}/users/mara/posts", params={"limit": 3}).json()
    second = mara.get(f"{API}/users/mara/posts", params={"limit": 3, "cursor": first["next_cursor"]}).json()
    seen = [p["id"] for p in first["items"] + second["items"]]
    assert seen == sorted(ids, reverse=True) and second["next_cursor"] is None


# --- dislikes: public counts, never who (Q8, Q32) -----------------------------------------------------


def test_post_dislike_is_idempotent_and_reason_can_change(user_client) -> None:
    mara, _ = user_client("mara")
    tomas, _ = user_client("tomas")
    rin, _ = user_client("rin")
    p = post(mara)

    first = tomas.put(f"{API}/posts/{p['id']}/dislike", json={"reason": None}).json()
    again = tomas.put(f"{API}/posts/{p['id']}/dislike", json={"reason": None}).json()
    assert first == again and first["dislike_count"] == 1 and first["viewer_dislike"] == {"reason": None}

    changed = tomas.put(f"{API}/posts/{p['id']}/dislike", json={"reason": "disagree"}).json()
    assert changed["dislike_count"] == 1
    assert changed["dislike_reasons"] == {"disagree": 1, "low_effort": 0, "not_for_me": 0, "none": 0}

    rin.put(f"{API}/posts/{p['id']}/dislike", json={"reason": "not_for_me"})
    seen_by_author = mara.get(f"{API}/posts/{p['id']}").json()
    assert seen_by_author["dislike_count"] == 2 and seen_by_author["viewer_dislike"] is None
    assert "tomas" not in json.dumps(seen_by_author["dislike_reasons"])

    removed = tomas.delete(f"{API}/posts/{p['id']}/dislike").json()
    assert removed["dislike_count"] == 1 and removed["viewer_dislike"] is None

    r = mara.put(f"{API}/posts/{p['id']}/dislike", json={"reason": None})
    assert r.status_code == 403 and r.json()["error"]["code"] == "own_content"


# --- comments -----------------------------------------------------------------------------------


def test_comment_threads(user_client) -> None:
    mara, _ = user_client("mara")
    tomas, _ = user_client("tomas")
    kit, _ = user_client("kit")
    p = post(mara)
    url = f"{API}/posts/{p['id']}/comments"

    top = tomas.post(url, json={"body": "Did they change the protocol?"}).json()
    reply = mara.post(url, json={"body": "Same protocol.", "parent_id": top["id"]}).json()
    deeper = kit.post(url, json={"body": "Deeper", "parent_id": reply["id"]})
    assert deeper.status_code == 422 and deeper.json()["error"]["code"] == "reply_depth"

    kit_comment = kit.post(url, json={"body": "Sample was tiny."}).json()
    mara.put(f"{API}/users/kit/unfollow")
    assert mara.put(f"{API}/comments/{top['id']}/dislike").json() == {
        "comment_id": top["id"],
        "dislike_count": 1,
        "viewer_disliked": True,
    }

    thread = mara.get(url).json()["items"]
    assert [c["id"] for c in thread] == [top["id"], kit_comment["id"]]
    assert thread[0]["replies"][0]["id"] == reply["id"] and thread[0]["replies"][0]["is_own"] is True
    assert thread[1]["collapsed"] is True  # Q11: unfollowed author's comment collapses, isn't removed
    assert mara.get(f"{API}/posts/{p['id']}").json()["reply_count"] == 3

    # Deleting a comment that has replies leaves a placeholder so the thread still reads.
    assert tomas.delete(f"{API}/comments/{top['id']}").status_code == 204
    thread = mara.get(url).json()["items"]
    assert thread[0]["deleted"] is True and thread[0]["author"] is None and thread[0]["body"] == ""
    assert thread[0]["replies"][0]["id"] == reply["id"]


# --- unfollows and profiles (Q9, Q31) ---------------------------------------------------------------


def test_unfollow_is_idempotent_and_undoable(user_client) -> None:
    mara, _ = user_client("mara")
    user_client("kit")

    r = mara.put(f"{API}/users/mara/unfollow")
    assert r.status_code == 422 and r.json()["error"]["code"] == "self_unfollow"

    first = mara.put(f"{API}/users/kit/unfollow").json()
    assert mara.put(f"{API}/users/kit/unfollow").json() == first and first["unfollowed"] is True
    assert [i["user"]["username"] for i in mara.get(f"{API}/me/unfollows").json()["items"]] == ["kit"]

    profile = mara.get(f"{API}/users/kit").json()
    assert profile["viewer_has_unfollowed"] is True and profile["unfollowed_at"] == first["unfollowed_at"]
    assert not {"followers", "following", "followers_count", "following_count"} & set(profile["user"])

    assert mara.delete(f"{API}/users/kit/unfollow").json()["unfollowed"] is False
    assert mara.get(f"{API}/me/unfollows").json()["items"] == []
    assert mara.get(f"{API}/users/mara").json()["is_self"] is True
    assert mara.get(f"{API}/users/nobody").status_code == 404


# --- reports and moderation ---------------------------------------------------------------------


def test_reports_and_admin_moderation(user_client, db) -> None:
    from app.models import User

    mara, _ = user_client("mara")
    tomas, _ = user_client("tomas")
    admin, admin_user = user_client("boss")
    row = db.get(User, admin_user["id"])
    row.is_admin = True
    db.add(row)
    db.commit()

    p = post(tomas)
    assert (
        mara.post(f"{API}/reports", json={"subject_type": "post", "subject_id": p["id"], "reason": "spam"}).json()[
            "status"
        ]
        == "open"
    )
    assert mara.get(f"{API}/admin/reports").status_code == 403

    queue = admin.get(f"{API}/admin/reports").json()["items"]
    assert queue[0]["subject_id"] == p["id"] and queue[0]["reporter"]["username"] == "mara"

    hidden = admin.post(f"{API}/admin/moderate", json={"subject_type": "post", "subject_id": p["id"], "action": "hide"})
    assert hidden.json()["moderation_status"] == "hidden"
    assert mara.get(f"{API}/posts/{p['id']}").status_code == 404
    assert admin.get(f"{API}/admin/reports").json()["items"] == []
    assert all(i["post"]["id"] != p["id"] for i in mara.get(f"{API}/feed").json()["items"])


def test_public_meta_endpoints(new_client) -> None:
    client = new_client()
    assert client.get(f"{API}/health").json()["status"] == "ok"
    assert [t["slug"] for t in client.get(f"{API}/topics").json()["items"]][:2] == ["science", "tech"]
    recipe = client.get(f"{API}/algorithm/recipe").json()
    assert [p["share"] for p in recipe["pools"]] == [0.3, 0.3, 0.2, 0.2]
    assert client.get(f"{API}/algorithm/comparison").status_code == 401
