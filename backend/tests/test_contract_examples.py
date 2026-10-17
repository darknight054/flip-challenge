"""The logged examples in tests/contract_examples are the API contract. These tests keep them honest:
every example must match a real route and validate against the same schemas the API uses."""

import json
import re
from pathlib import Path

import pytest
from pydantic import BaseModel, ValidationError

from app import schemas as s
from app.main import create_app

EXAMPLES_DIR = Path(__file__).resolve().parent / "contract_examples"

# example file -> (request body schema, success response schema)
SCHEMAS: dict[str, tuple[type[BaseModel] | None, type[BaseModel] | None]] = {
    "health": (None, s.Health),
    "topics.list": (None, s.TopicList),
    "auth.register": (s.RegisterIn, s.UserEnvelope),
    "auth.login": (s.LoginIn, s.UserEnvelope),
    "auth.logout": (None, None),
    "me.get": (None, s.UserEnvelope),
    "me.update": (s.MeUpdateIn, s.UserEnvelope),
    "me.unfollows": (None, s.UnfollowList),
    "users.get": (None, s.Profile),
    "users.posts": (None, s.PostPage),
    "users.unfollow": (None, s.UnfollowState),
    "users.unfollow.undo": (None, s.UnfollowState),
    "posts.create": (s.PostCreateIn, s.PostOut),
    "posts.get": (None, s.PostOut),
    "posts.update": (s.PostUpdateIn, s.PostOut),
    "posts.delete": (None, None),
    "posts.dislike": (s.DislikeIn, s.PostDislikeState),
    "posts.dislike.remove": (None, s.PostDislikeState),
    "comments.list": (None, s.CommentPage),
    "comments.create": (s.CommentCreateIn, s.CommentOut),
    "comments.update": (s.CommentUpdateIn, s.CommentOut),
    "comments.delete": (None, None),
    "comments.dislike": (None, s.CommentDislikeState),
    "comments.dislike.remove": (None, s.CommentDislikeState),
    "feed.get": (None, s.FeedPage),
    "feed.impressions": (s.ImpressionBatchIn, s.ImpressionResult),
    "algorithm.recipe": (None, s.Recipe),
    "algorithm.comparison": (None, s.Comparison),
    "reports.create": (s.ReportIn, s.ReportCreated),
    "admin.reports": (None, s.ReportList),
    "admin.moderate": (s.ModerateIn, s.ModerationResult),
}

EXAMPLES = {path.stem: json.loads(path.read_text()) for path in sorted(EXAMPLES_DIR.glob("*.json"))}
CASES = [(name, case) for name, example in EXAMPLES.items() for case in example["cases"]]


def _normalise(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "{}", path)


def test_every_example_has_a_schema_and_vice_versa() -> None:
    assert set(EXAMPLES) == set(SCHEMAS)


def test_every_example_matches_a_real_route() -> None:
    spec = create_app().openapi()
    routes = {(method.upper(), _normalise(path)) for path, ops in spec["paths"].items() for method in ops}
    for name, example in EXAMPLES.items():
        method, path = example["endpoint"].split(" ", 1)
        assert (method, _normalise(path)) in routes, f"{name}: {example['endpoint']} is not a real route"


@pytest.mark.parametrize(("name", "case"), CASES, ids=[f"{n}:{c['name']}" for n, c in CASES])
def test_example_validates(name: str, case: dict) -> None:
    request_schema, response_schema = SCHEMAS[name]
    status, body = case["response"]["status"], case["response"]["body"]
    request_body = case.get("request", {}).get("body")

    if status >= 400:
        s.ErrorResponse.model_validate(body)
        if body["error"]["code"] == "validation_error" and request_schema and request_body is not None:
            with pytest.raises(ValidationError):
                request_schema.model_validate(request_body)
        return

    if request_schema and request_body is not None:
        request_schema.model_validate(request_body)
    if status == 204:
        assert body is None
    else:
        assert response_schema is not None
        response_schema.model_validate(body)
