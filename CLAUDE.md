# Repo conventions

## Layout
- `backend/`: FastAPI + SQLModel + SQLite, Alembic migrations, recommender in `app/recommendations/`.
- `frontend/`: Next.js 16 App Router + Tailwind + shadcn/ui (Frutiger Aero theme).
- `docs/`: **all** planning documents live here, and the folder is git-ignored. Don't put documents anywhere else; `README.md` at the root is the only exception.

## Decisions workflow
- Open questions go in `docs/QUESTIONS.md`, each with a recommendation. An unanswered question means the recommendation is accepted. Don't assume: when something is ambiguous, add a question rather than deciding silently.
- `docs/PLAN.md` reflects the accepted decisions. Update it when a decision changes.

## Tooling
- Python: **uv only** (no pip, venv or requirements.txt). Run `uv run pytest`, `uv run ruff check .` and `uv run ruff format .` from `backend/`.
- Frontend: **pnpm only**. Run `pnpm lint` and `pnpm build` from `frontend/`. Next.js 16 differs from older versions: read `frontend/AGENTS.md` and `node_modules/next/dist/docs/` before writing Next-specific code.
- Schema changes go through Alembic migrations (`uv run alembic revision --autogenerate`), never `create_all` outside tests.
- Seed data: `uv run python -m scripts.seed --reset`. Bulk seed content is generated in a separate session from `docs/SEED_SPEC.md`; don't hand-write it inside a build session.

## API contract
- `docs/API_CONTRACT.md` plus `backend/tests/contract_examples/*.json` define the API. Change the contract doc, the examples and `app/schemas` together. `tests/test_contract_examples.py` fails if they drift apart.
- State-changing requests need the header `X-Serendipity-Client: web`. Errors always use the `{"error": {code, message, fields?}}` envelope.

## Recommender rules (non-negotiable)
- Unfollows and dislikes are **filters only**. They must never become ranking features, similarity signals or global creator scores. Recommenders receive viewer-independent `Candidate` features plus, at most, the viewer's own recent views (`ViewerHistory`, built from impressions only).
- The active version comes from `SD_ACTIVE_ALGORITHM` (validated at startup). New algorithms are new versions behind the `Recommender` interface (`app/recommendations/registry.py`). Change one thing at a time, and a version may only be activated after it passes the counterfactual tests in `backend/tests/test_feed.py`.
- No likes, follows, follower counts from data, trending or "people you may know". The profile's "1bn+ followers" is a frontend constant.

## Git
- Commit or push only when asked. Never commit `docs/`, `.env` files or `*.db`.
