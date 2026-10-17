# Serendipity

**Everyone starts connected. You decide what disappears. The algorithm gives unfamiliar voices a fair chance.**

Built for the Edinburgh AI "Flip the Script" hackathon. Serendipity flips three things about social media:

- **Following → unfollowing.** Everyone follows everyone from day one, so every profile has "1bn+ followers". The only relationship action is Unfollow.
- **Likes → dislikes.** The only reaction is Dislike, with an optional reason: Disagree, Low effort or Not for me. Counts are public, but nobody is ever shown who disliked.
- **Engagement feed → fair-attention feed.** The feed mixes fresh, underexposed, discussed and random posts, and tells you why each one is there. It never ranks by popularity, never uses who you unfollowed or what you disliked, and it ends ("You're caught up").

## Run it locally

Requires [uv](https://docs.astral.sh/uv/), Node 20+ and pnpm.

```bash
# API on http://localhost:8000 (docs at /api/docs)
cd backend
uv sync
uv run alembic upgrade head
uv run python -m scripts.seed --reset     # sample community; log in as demo / serendipity-demo
uv run fastapi dev app/main.py

# Web app on http://localhost:3000 (proxies /api/v1 to the API)
cd frontend
pnpm install
pnpm dev
```

Switch the feed recommender with `SD_ACTIVE_ALGORITHM=seen-least-v1` (or `baseline-v0`, the default) in `backend/.env`, then restart the API.

Tests: `cd backend && uv run pytest` · Lint: `uv run ruff check .` and `pnpm lint`.

## Repository

| Path | What |
| --- | --- |
| `backend/` | FastAPI + SQLModel + SQLite, Alembic migrations, recommender (`app/recommendations/`), seed loader |
| `frontend/` | Next.js App Router + Tailwind + shadcn/ui, Frutiger Aero theme |
| `backend/tests/contract_examples/` | Logged request/response examples for every endpoint; the backend tests validate them against the real schemas |

