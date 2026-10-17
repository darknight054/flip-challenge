from typing import Literal

TopicSlug = Literal[
    "science",
    "tech",
    "politics_society",
    "culture_arts",
    "sport",
    "food",
    "places_travel",
    "work_money",
    "health",
    "everyday_life",
]

# Fixed order shown in the composer (Q19).
TOPICS: list[tuple[str, str]] = [
    ("science", "Science"),
    ("tech", "Tech"),
    ("politics_society", "Politics & Society"),
    ("culture_arts", "Culture & Arts"),
    ("sport", "Sport"),
    ("food", "Food"),
    ("places_travel", "Places & Travel"),
    ("work_money", "Work & Money"),
    ("health", "Health"),
    ("everyday_life", "Everyday Life"),
]

TOPIC_SLUGS = frozenset(slug for slug, _ in TOPICS)
