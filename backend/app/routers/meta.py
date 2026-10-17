from fastapi import APIRouter, Request

from app.core.deps import AppSettings, CurrentUser, DbSession
from app.core.topics import TOPICS
from app.schemas import Comparison, Health, Recipe, TopicList, TopicOut
from app.services import algorithm

router = APIRouter(tags=["meta"])


@router.get("/health", response_model=Health)
def health(settings: AppSettings) -> Health:
    return Health(status="ok", version=settings.version)


@router.get("/topics", response_model=TopicList)
def topics() -> TopicList:
    return TopicList(items=[TopicOut(slug=slug, label=label) for slug, label in TOPICS])


@router.get("/algorithm/recipe", response_model=Recipe)
def recipe(settings: AppSettings) -> Recipe:
    return algorithm.recipe(settings)


@router.get("/algorithm/comparison", response_model=Comparison)
def comparison(request: Request, db: DbSession, settings: AppSettings, _: CurrentUser) -> Comparison:
    return algorithm.comparison(db, settings, request)
