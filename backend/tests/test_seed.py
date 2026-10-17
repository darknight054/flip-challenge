import json
from pathlib import Path

import pytest
from sqlalchemy import func
from sqlmodel import select

from app.models import Comment, Impression, PostDislike, User
from scripts.seed import load, validate

USERS = [
    {
        "username": "tomas",
        "display_name": "Tomas Reyes",
        "bio": "Lab tech.",
        "joined_days_ago": 10,
        "exposure_tier": "famous",
    },
    {"username": "rin", "display_name": "Rin Sato", "bio": "", "joined_days_ago": 5, "exposure_tier": "moderate"},
    {"username": "kit", "display_name": "Kit Lowe", "bio": "", "joined_days_ago": 1, "exposure_tier": "new"},
]
POSTS = [
    {
        "key": "p001",
        "author": "tomas",
        "topic": "science",
        "body": "Half the effect size.",
        "hours_ago": 30,
        "seen_by": 2,
        "dislikes": {"disagree": 1, "low_effort": 0, "not_for_me": 0, "none": 1},
    },
    {
        "key": "p002",
        "author": "kit",
        "topic": "food",
        "body": "First post!",
        "hours_ago": 3,
        "seen_by": 0,
        "dislikes": {},
    },
]
COMMENTS = [
    {
        "key": "c0001",
        "post": "p001",
        "author": "rin",
        "parent": None,
        "body": "Which sample?",
        "minutes_after_post": 40,
        "dislikes": 1,
    },
    {
        "key": "c0002",
        "post": "p001",
        "author": "tomas",
        "parent": "c0001",
        "body": "The second one.",
        "minutes_after_post": 70,
        "dislikes": 0,
    },
]


def write(dir_: Path, users=USERS, posts=POSTS, comments=COMMENTS) -> Path:
    for name, rows in (("users", users), ("posts", posts), ("comments", comments)):
        (dir_ / f"{name}.jsonl").write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    return dir_


def test_load_expands_engagement_deterministically(tmp_path, db) -> None:
    result = load(db, write(tmp_path))
    assert result == {
        "users": 3,
        "posts": 2,
        "comments": 2,
        "impressions": 2,
        "post_dislikes": 2,
        "comment_dislikes": 1,
    }
    assert db.exec(select(func.count()).select_from(Impression)).one() == 2
    reasons = sorted(str(r) for r in db.exec(select(PostDislike.reason)).all())
    assert reasons == ["None", "disagree"]
    reply = db.exec(select(Comment).where(Comment.body == "The second one.")).one()
    assert reply.parent_id is not None
    accounts = {u.username: u for u in db.exec(select(User)).all()}
    assert accounts["admin"].is_admin and not accounts["demo"].is_synthetic and accounts["tomas"].is_synthetic


def test_validation_catches_bad_references() -> None:
    bad = [{**COMMENTS[1], "parent": "c9999"}]
    assert any("parent" in e for e in validate(USERS, POSTS, bad))
    assert any("dislikes" in e for e in validate(USERS, [{**POSTS[0], "seen_by": 0}], []))
    assert any("reserved" in e for e in validate([{**USERS[0], "username": "admin"}], [], []))


def test_invalid_data_refuses_to_load(tmp_path, db) -> None:
    with pytest.raises(SystemExit):
        load(db, write(tmp_path, posts=[{**POSTS[0], "topic": "astrology"}]))


def test_comments_file_is_optional(tmp_path, db) -> None:
    write(tmp_path)
    (tmp_path / "comments.jsonl").unlink()
    result = load(db, tmp_path)
    assert result["posts"] == 2 and result["comments"] == 0 and result["comment_dislikes"] == 0
