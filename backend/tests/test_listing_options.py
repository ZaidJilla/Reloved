import os

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")

import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.auth import UserContext, get_user_context
from app.core.listing_options import CATEGORIES, CONDITIONS, SIZES, canonical
from app.main import app
from tests.test_listings import FakeClient, LISTING_ROW

MIGRATIONS = Path(__file__).resolve().parents[2] / "supabase" / "migrations"


@pytest.fixture
def http():
    yield TestClient(app)
    app.dependency_overrides.clear()


def _as_user(tables):
    fake = FakeClient(tables)
    app.dependency_overrides[get_user_context] = lambda: UserContext(fake, "u1")
    return fake


def test_canonical_normalizes_case_and_aliases():
    assert canonical(" tops ", CATEGORIES, strict=True, field="category") == "Tops"
    assert canonical("like NEW", CONDITIONS, strict=True, field="condition") == "Like new"
    assert canonical("os", SIZES, strict=True, field="size") == "One Size"
    assert canonical("   ", CATEGORIES, strict=True, field="category") is None
    assert canonical(None, CATEGORIES, strict=True, field="category") is None


def test_canonical_strict_rejects_but_lenient_passes_through():
    with pytest.raises(ValueError, match="Allowed"):
        canonical("Hats", CATEGORIES, strict=True, field="category")
    assert canonical("Hats", CATEGORIES, strict=False, field="category") == "Hats"


def test_options_endpoint_is_public_and_not_shadowed(http):
    body = http.get("/listings/options").json()
    assert body["categories"] == list(CATEGORIES)
    assert body["listing_types"] == ["resale", "handmade"]


def test_create_normalizes_and_rejects_unknown(http):
    fake = _as_user({"profiles": [{"school_id": "northeastern"}], "listings": [LISTING_ROW]})
    ok = http.post(
        "/listings",
        json={"title": "x", "price": 5, "category": "tops", "size": "os", "condition": "good"},
    )
    assert ok.status_code == 201
    row = next(c for c in fake.log if c[1] == "insert")[2][0]
    assert (row["category"], row["size"], row["condition"]) == ("Tops", "One Size", "Good")

    bad = http.post("/listings", json={"title": "x", "price": 5, "category": "Hats"})
    assert bad.status_code == 422
    assert "Allowed" in bad.text


def test_patch_validates_options(http):
    _as_user({"profiles": [{"school_id": "northeastern"}], "listings": [LISTING_ROW]})
    assert http.patch("/listings/l1", json={"size": "huge"}).status_code == 422
    assert http.patch("/listings/l1", json={"size": None}).status_code == 200


def test_search_filters_are_case_insensitive_but_lenient(http):
    from app.core.auth import get_user_client
    from tests.test_search import FakeClient as SearchFake

    fake = SearchFake([])
    app.dependency_overrides[get_user_client] = lambda: fake
    assert http.get("/search/listings", params={"category": "tops", "size": "xl"}).status_code == 200
    params = fake.calls[0][1]
    assert (params["p_category"], params["p_size"]) == ("Tops", "XL")
    assert http.get("/search/listings", params={"category": "Hats"}).status_code == 200


def test_migration_003_matches_python_lists():
    sql = (MIGRATIONS / "003_listing_value_checks.sql").read_text()
    for field, allowed in [("category", CATEGORIES), ("condition", CONDITIONS), ("size", SIZES)]:
        block = re.search(rf"listings_{field}_check\s+check \((.*?)\) not valid", sql, re.S).group(1)
        assert set(re.findall(r"'([^']+)'", block)) == set(allowed), field
