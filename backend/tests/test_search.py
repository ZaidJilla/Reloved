import os

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.core import auth as auth_module
from app.core.auth import get_user_client
from app.main import app


def _row(i: int) -> dict:
    return {
        "id": f"id-{i}",
        "title": f"Item {i}",
        "description": None,
        "price_cents": 1500,
        "category": "tops",
        "size": "M",
        "condition": "good",
        "listing_type": "resale",
        "status": "active",
        "created_at": "2026-01-01T00:00:00Z",
        "seller_id": "seller-1",
        "photo_url": None,
    }


class FakeClient:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def rpc(self, name, params):
        self.calls.append((name, params))
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=self.rows))


@pytest.fixture
def http():
    yield TestClient(app)
    app.dependency_overrides.clear()


def _use(fake):
    app.dependency_overrides[get_user_client] = lambda: fake


def test_maps_params_and_converts_dollars_to_cents(http):
    fake = FakeClient([_row(1)])
    _use(fake)
    r = http.get(
        "/search/listings",
        params={"q": "jacket", "min_price": 5, "max_price": 20.5, "size": "M"},
    )
    assert r.status_code == 200
    name, p = fake.calls[0]
    assert name == "search_listings"
    assert p["p_query"] == "jacket"
    assert p["p_min_price_cents"] == 500
    assert p["p_max_price_cents"] == 2050
    assert p["p_size"] == "M"
    assert p["p_category"] is None


def test_has_more_and_trims_extra_row(http):
    _use(FakeClient([_row(i) for i in range(3)]))
    body = http.get("/search/listings", params={"limit": 2}).json()
    assert len(body["results"]) == 2
    assert body["has_more"] is True


def test_no_more_when_rows_fit(http):
    _use(FakeClient([_row(1)]))
    body = http.get("/search/listings", params={"limit": 2}).json()
    assert body["has_more"] is False


def test_rejects_inverted_price_range(http):
    _use(FakeClient([]))
    r = http.get("/search/listings", params={"min_price": 30, "max_price": 10})
    assert r.status_code == 422


def test_rejects_bad_listing_type_and_limit(http):
    _use(FakeClient([]))
    assert http.get("/search/listings", params={"listing_type": "x"}).status_code == 422
    assert http.get("/search/listings", params={"limit": 500}).status_code == 422


def test_requires_bearer_token(http):
    assert http.get("/search/listings").status_code == 401


def test_invalid_token_is_401(http, monkeypatch):
    class Bad:
        auth = SimpleNamespace(get_user=lambda t: (_ for _ in ()).throw(ValueError("bad")))

    monkeypatch.setattr(auth_module, "create_client", lambda *a: Bad())
    r = http.get("/search/listings", headers={"Authorization": "Bearer nope"})
    assert r.status_code == 401
