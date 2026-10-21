import os

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")

import pytest
from fastapi.testclient import TestClient

from app.core.auth import UserContext, get_user_context
from app.main import app
from tests.test_listings import LISTING_ROW, PHOTO_BASE, FakeClient

GOOD = PHOTO_BASE + "l1-123.jpg"


@pytest.fixture
def http():
    yield TestClient(app)
    app.dependency_overrides.clear()


def _as_user(tables):
    fake = FakeClient(tables)
    app.dependency_overrides[get_user_context] = lambda: UserContext(fake, "u1")
    return fake


def _tables(photos=(), owned=True):
    return {
        "profiles": [{"school_id": "northeastern"}],
        # _require_editable and get_listing both read this table
        "listings": [LISTING_ROW] if owned else [],
        "listing_photos": list(photos),
    }


def test_add_photo_appends_after_existing(http):
    fake = _as_user(_tables([{"id": "p1", "sort_order": 0}, {"id": "p2", "sort_order": 4}]))
    r = http.post("/listings/l1/photos", json={"photo_url": GOOD})
    assert r.status_code == 201
    row = next(c for c in fake.log if c[0] == "listing_photos" and c[1] == "insert")[2][0]
    assert row == {"listing_id": "l1", "photo_url": GOOD, "sort_order": 5}


@pytest.mark.parametrize(
    "url",
    [
        "https://evil.example.com/a.jpg",
        "http://localhost/storage/v1/object/public/other-bucket/a.jpg",
        PHOTO_BASE + "../secret.jpg",
        PHOTO_BASE + "a b.jpg",
        "a.jpg",
    ],
)
def test_add_photo_rejects_foreign_urls(http, url):
    _as_user(_tables())
    assert http.post("/listings/l1/photos", json={"photo_url": url}).status_code == 422


def test_add_photo_limit(http):
    _as_user(_tables([{"id": f"p{i}", "sort_order": i} for i in range(6)]))
    r = http.post("/listings/l1/photos", json={"photo_url": GOOD})
    assert r.status_code == 409


def test_add_photo_404_when_not_owner_or_not_active(http):
    _as_user(_tables(owned=False))
    assert http.post("/listings/l1/photos", json={"photo_url": GOOD}).status_code == 404


def test_create_listing_rejects_foreign_photo_urls(http):
    _as_user(_tables())
    r = http.post("/listings", json={"title": "x", "price": 5, "photo_urls": ["https://evil.example.com/a.jpg"]})
    assert r.status_code == 422


def test_delete_photo(http):
    fake = _as_user(_tables([{"id": "p1"}]))
    assert http.delete("/listings/l1/photos/p1").status_code == 204
    assert ("listing_photos", "eq", ("id", "p1")) in fake.log
    assert ("listing_photos", "eq", ("listing_id", "l1")) in fake.log


def test_delete_photo_404_cases(http):
    _as_user(_tables([]))  # owned listing, but no such photo
    assert http.delete("/listings/l1/photos/nope").status_code == 404
    _as_user(_tables([{"id": "p1"}], owned=False))  # not the owner
    assert http.delete("/listings/l1/photos/p1").status_code == 404


def test_photo_routes_require_auth(http):
    assert http.post("/listings/l1/photos", json={"photo_url": GOOD}).status_code == 401
    assert http.delete("/listings/l1/photos/p1").status_code == 401


def test_detail_includes_photo_ids(http):
    row = {**LISTING_ROW, "listing_photos": [{"id": "p1", "photo_url": GOOD, "sort_order": 0}]}
    _as_user({"profiles": [{"school_id": "northeastern"}], "listings": [row]})
    assert http.get("/listings/l1").json()["photos"][0]["id"] == "p1"
