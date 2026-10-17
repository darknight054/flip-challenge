from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.config import Settings, get_settings
from app.core.errors import error_body, install_error_handlers
from app.core.ratelimit import RateLimiter
from app.db.engine import make_engine
from app.recommendations.registry import FEED_VERSIONS
from app.routers import auth, comments, feed, me, meta, moderation, posts, users

UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    if settings.active_algorithm not in FEED_VERSIONS:
        raise ValueError(f"SD_ACTIVE_ALGORITHM must be one of {FEED_VERSIONS}, got {settings.active_algorithm!r}")
    app = FastAPI(
        title="Serendipity API",
        version=settings.version,
        docs_url="/api/docs" if settings.debug else None,
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    app.state.settings = settings
    app.state.engine = make_engine(settings.database_url)
    app.state.rate_limiter = RateLimiter()
    app.state.simulation_cache = None
    install_error_handlers(app)

    @app.middleware("http")
    async def csrf_guard(request: Request, call_next):
        # A custom header can't be sent cross-site without CORS, which is not enabled.
        if (
            request.method in UNSAFE_METHODS
            and request.url.path.startswith("/api/")
            and request.headers.get(settings.csrf_header) != settings.csrf_value
        ):
            return JSONResponse(
                status_code=403, content=error_body("csrf_failed", "Missing X-Serendipity-Client header.")
            )
        return await call_next(request)

    for module in (meta, auth, me, users, posts, comments, feed, moderation):
        app.include_router(module.router, prefix="/api/v1")
    return app


app = create_app()
