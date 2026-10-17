"""Load seed fixtures from seed/data/*.jsonl (generated in a separate session; spec in docs/SEED_SPEC.md).

    uv run python -m scripts.seed [--reset] [--data DIR]

Validates the files, then expands the compact engagement numbers (`seen_by`, `dislikes`) into real
impression and dislike rows with a fixed random seed, so every load produces the same database.
Also creates two non-synthetic accounts: `demo` (for trying the app) and `admin` (moderation).
"""

import argparse
import json
import os
import random
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from sqlmodel import Session, SQLModel, select

import app.models  # noqa: F401  (registers tables)
from app.core.config import BACKEND_DIR, get_settings
from app.core.security import hash_password
from app.core.time import utcnow
from app.core.topics import TOPIC_SLUGS
from app.db.engine import make_engine
from app.models import Comment, CommentDislike, Impression, Post, PostDislike, User
from app.schemas import USERNAME_RE

DATA_DIR = BACKEND_DIR / "seed" / "data"
TIERS = {"famous", "moderate", "quiet", "new"}
REASONS = ("disagree", "low_effort", "not_for_me", "none")
RESERVED = {"admin", "demo"}


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if line.strip():
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise SystemExit(f"{path.name}:{number}: invalid JSON ({exc.msg})") from exc
    return rows


def validate(users: list[dict], posts: list[dict], comments: list[dict]) -> list[str]:
    errors: list[str] = []
    names = [u.get("username") for u in users]
    if len(set(names)) != len(names):
        errors.append("duplicate usernames")
    by_name = {u["username"]: u for u in users if "username" in u}
    for u in users:
        name = u.get("username", "?")
        if not USERNAME_RE.fullmatch(str(name)) or name in RESERVED:
            errors.append(f"user {name}: bad or reserved username")
        if u.get("exposure_tier") not in TIERS:
            errors.append(f"user {name}: unknown exposure_tier")
        if not 1 <= len(u.get("display_name", "")) <= 40 or len(u.get("bio", "")) > 160:
            errors.append(f"user {name}: display_name/bio length")

    post_keys = {}
    for p in posts:
        key = p.get("key", "?")
        if key in post_keys:
            errors.append(f"post {key}: duplicate key")
        post_keys[key] = p
        author = by_name.get(p.get("author"))
        if author is None:
            errors.append(f"post {key}: unknown author {p.get('author')}")
            continue
        if p.get("topic") not in TOPIC_SLUGS:
            errors.append(f"post {key}: unknown topic")
        if not 1 <= len(p.get("body", "")) <= 500:
            errors.append(f"post {key}: body length")
        if not 0 <= p.get("seen_by", -1) < len(users):
            errors.append(f"post {key}: seen_by out of range")
        dislikes = p.get("dislikes", {})
        if set(dislikes) - set(REASONS) or sum(dislikes.values()) > p.get("seen_by", 0):
            errors.append(f"post {key}: dislikes must use known reasons and total <= seen_by")
        if p.get("hours_ago", 0) < 1:
            errors.append(f"post {key}: hours_ago must be >= 1")

    comment_keys: dict[str, dict] = {}
    for c in comments:
        key = c.get("key", "?")
        post = post_keys.get(c.get("post"))
        if key in comment_keys:
            errors.append(f"comment {key}: duplicate key")
        if post is None or c.get("author") not in by_name:
            errors.append(f"comment {key}: unknown post or author")
            continue
        parent_key = c.get("parent")
        if parent_key is not None:
            parent = comment_keys.get(parent_key)
            if parent is None or parent["post"] != c["post"] or parent.get("parent") is not None:
                errors.append(f"comment {key}: parent must be an earlier top-level comment on the same post")
        if not 1 <= len(c.get("body", "")) <= 300:
            errors.append(f"comment {key}: body length")
        if not 0 <= c.get("dislikes", 0) <= 5:
            errors.append(f"comment {key}: dislikes out of range")
        comment_keys[key] = c
    return errors


def reset(db: Session) -> None:
    connection = db.connection()
    for table in reversed(SQLModel.metadata.sorted_tables):
        connection.execute(table.delete())
    db.commit()


def load(db: Session, data_dir: Path, *, rng_seed: int = 1337, now: datetime | None = None) -> dict[str, int]:
    users = read_jsonl(data_dir / "users.jsonl")
    posts = read_jsonl(data_dir / "posts.jsonl")
    comments_file = data_dir / "comments.jsonl"  # optional: the demo community can start without comments
    comments = read_jsonl(comments_file) if comments_file.exists() else []
    errors = validate(users, posts, comments)
    if errors:
        raise SystemExit("Seed data is invalid:\n  " + "\n  ".join(errors[:50]))

    rng = random.Random(rng_seed)
    now = now or utcnow()
    seed_password = hash_password(os.environ.get("SD_SEED_PASSWORD", "serendipity-demo"))

    # Accounts must exist before their oldest post.
    oldest_post_hours: dict[str, int] = defaultdict(int)
    for p in posts:
        oldest_post_hours[p["author"]] = max(oldest_post_hours[p["author"]], p["hours_ago"])
    rows: dict[str, User] = {}
    for u in users:
        joined = now - timedelta(days=u["joined_days_ago"], hours=rng.randint(0, 20))
        joined = min(joined, now - timedelta(hours=oldest_post_hours[u["username"]] + 1))
        rows[u["username"]] = User(
            username=u["username"],
            password_hash=seed_password,
            display_name=u["display_name"],
            bio=u.get("bio", ""),
            is_synthetic=True,
            created_at=joined,
        )
    db.add(User(username="demo", password_hash=seed_password, display_name="Demo Visitor", created_at=now))
    admin_password = hash_password(os.environ.get("SD_ADMIN_PASSWORD", "serendipity-admin"))
    db.add(User(username="admin", password_hash=admin_password, display_name="Moderator", is_admin=True))
    db.add_all(rows.values())
    db.flush()

    post_rows: dict[str, Post] = {}
    for p in posts:
        created = now - timedelta(hours=p["hours_ago"], minutes=rng.randint(0, 59))
        post_rows[p["key"]] = Post(author_id=rows[p["author"]].id, body=p["body"], topic=p["topic"], created_at=created)
    db.add_all(post_rows.values())
    db.flush()

    # Expand exposure: `seen_by` other seed users saw the post; dislikes come from people who saw it.
    usernames = sorted(rows)
    counts = {"impressions": 0, "post_dislikes": 0, "comment_dislikes": 0}
    for p in posts:
        post = post_rows[p["key"]]
        others = [n for n in usernames if n != p["author"]]
        viewers = rng.sample(others, min(p["seen_by"], len(others)))
        window = max(5, min(p["hours_ago"] * 60, 48 * 60))
        for name in viewers:
            seen_at = min(post.created_at + timedelta(minutes=rng.randint(5, window)), now)
            db.add(Impression(viewer_id=rows[name].id, post_id=post.id, first_visible_at=seen_at))
        reasons = [r for r in REASONS for _ in range(p.get("dislikes", {}).get(r, 0))]
        rng.shuffle(reasons)
        for name, reason in zip(rng.sample(viewers, len(reasons)), reasons, strict=True):
            db.add(PostDislike(user_id=rows[name].id, post_id=post.id, reason=None if reason == "none" else reason))
        counts["impressions"] += len(viewers)
        counts["post_dislikes"] += len(reasons)

    comment_rows: dict[str, Comment] = {}
    for top_level in (True, False):  # parents first so replies can reference their ids
        batch = []
        for c in comments:
            if (c.get("parent") is None) != top_level:
                continue
            post = post_rows[c["post"]]
            created = min(post.created_at + timedelta(minutes=c["minutes_after_post"]), now - timedelta(minutes=1))
            parent = comment_rows[c["parent"]] if c.get("parent") else None
            if parent is not None:
                created = max(created, parent.created_at + timedelta(minutes=1))
            row = Comment(
                post_id=post.id,
                author_id=rows[c["author"]].id,
                parent_id=parent.id if parent else None,
                body=c["body"],
                created_at=min(created, now),
            )
            comment_rows[c["key"]] = row
            batch.append(row)
        db.add_all(batch)
        db.flush()

    for c in comments:
        others = [n for n in usernames if n != c["author"]]
        for name in rng.sample(others, min(c.get("dislikes", 0), len(others))):
            db.add(CommentDislike(user_id=rows[name].id, comment_id=comment_rows[c["key"]].id))
            counts["comment_dislikes"] += 1

    db.commit()
    return {"users": len(rows), "posts": len(post_rows), "comments": len(comment_rows), **counts}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--reset", action="store_true", help="delete all existing rows first")
    parser.add_argument("--data", type=Path, default=DATA_DIR, help="directory with the three .jsonl files")
    args = parser.parse_args()

    engine = make_engine(get_settings().database_url)
    with Session(engine) as db:
        if args.reset:
            reset(db)
        elif db.exec(select(User.id)).first() is not None:
            sys.exit("Database already has data. Re-run with --reset to replace it.")
        result = load(db, args.data)
    print("Seeded: " + ", ".join(f"{n} {k}" for k, n in result.items()))
    print("Log in as demo / serendipity-demo (or any seed user with the same password); admin / serendipity-admin.")


if __name__ == "__main__":
    main()
