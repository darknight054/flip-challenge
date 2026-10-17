from collections.abc import Callable, Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

import app.models  # noqa: F401  (registers tables)
from app.core.config import Settings
from app.main import create_app

API = "/api/v1"
CSRF = {"X-Serendipity-Client": "web"}
PASSWORD = "correct-horse-9"


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}", rate_limits_enabled=False)


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    application = create_app(settings)
    SQLModel.metadata.create_all(application.state.engine)
    return application


@pytest.fixture
def db(app: FastAPI) -> Iterator[Session]:
    with Session(app.state.engine) as session:
        yield session


@pytest.fixture
def new_client(app: FastAPI) -> Iterator[Callable[[], TestClient]]:
    """Each client has its own cookie jar, so each one can be a different logged-in user."""
    clients: list[TestClient] = []

    def make() -> TestClient:
        client = TestClient(app, headers=CSRF)
        clients.append(client)
        return client

    yield make
    for client in clients:
        client.close()


@pytest.fixture
def user_client(new_client) -> Callable[..., tuple[TestClient, dict]]:
    def make(username: str, **extra) -> tuple[TestClient, dict]:
        client = new_client()
        response = client.post(f"{API}/auth/register", json={"username": username, "password": PASSWORD, **extra})
        assert response.status_code == 201, response.text
        return client, response.json()["user"]

    return make


def post(client: TestClient, body: str = "Something worth saying.", topic: str = "science") -> dict:
    response = client.post(f"{API}/posts", json={"body": body, "topic": topic})
    assert response.status_code == 201, response.text
    return response.json()
