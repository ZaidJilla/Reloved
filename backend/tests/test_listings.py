import os

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.core.auth import UserContext, get_user_context
from app.main import app

LISTING_ROW = {
    "id": "l1",
    "title": "Flannel",
    "description": None,
    "price_cents": 2000,
    "category": "Tops",
    "size": "M",
    "condition": "Good",
    "listing_type": "resale",
    "status": "active",
    "created_at": "2026-01-01T00:00:00Z",
    "seller_id": "u1",
    "listing_photos": [
        {"photo_url": "b.jpg", "sort_order": 1},
        {"photo_url": "a.jpg", "sort_order": 0},
    ],
    "profiles": {"full_name": "Zaid"},
}


PHOTO_BASE = "http://localhost/storage/v1/object/public/listing-photos/"


class FakeQuery:
    """Chainable stand-in for supabase's query builder; records the calls."""

    def __init__(self, table, data, log):
        self.table, self.data, self.log = table, data, log

    def __getattr__(self, op):
        def call(*args, **kwargs):
            self.log.append((self.table, op, args))
            return self

        return call

    def execute(self):
        return SimpleNamespace(data=self.data)


class FakeClient:
    def __init__(self, tables):
        self.tables, self.log = tables, []

    def table(self, name):
        return FakeQuery(name, self.tables.get(name, []), self.log)


@pytest.fixture
def http():
    yield TestClient(app)
    app.dependency_overrides.clear()


def _as_user(tables):
    fake = FakeClient(tables)
    app.dependency_overrides[get_user_context] = lambda: UserContext(fake, "u1")
    return fake


def test_get_listing_returns_sorted_photos_and_seller(http):
    _as_user({"profiles": [{"school_id": "northeastern"}], "listings": [LISTING_ROW]})
    body = http.get("/listings/l1").json()
    assert body["seller_name"] == "Zaid"
    assert [p["photo_url"] for p in body["photos"]] == ["a.jpg", "b.jpg"]


def test_get_listing_scopes_to_callers_school(http):
    fake = _as_user({"profiles": [{"school_id": "tufts"}], "listings": []})
    assert http.get("/listings/l1").status_code == 404
    assert ("listings", "eq", ("school_id", "tufts")) in fake.log


def test_create_uses_caller_identity_and_converts_price(http):
    fake = _as_user(
        {"profiles": [{"school_id": "northeastern"}], "listings": [LISTING_ROW]}
    )
    r = http.post(
        "/listings",
        json={
            "title": " Flannel ",
            "price": 20.5,
            "seller_id": "someone-else",
            "photo_urls": [PHOTO_BASE + "a.jpg"],
        },
    )
    assert r.status_code == 201
    inserts = [c for c in fake.log if c[1] == "insert"]
    row = inserts[0][2][0]
    assert row["seller_id"] == "u1"  # not the spoofed one
    assert row["school_id"] == "northeastern"
    assert row["price_cents"] == 2050
    assert row["title"] == "Flannel"
    assert inserts[1][0] == "listing_photos"


@pytest.mark.parametrize(
    "body",
    [
        {"title": "", "price": 5},
        {"title": "x", "price": -1},
        {"title": "x", "price": 5, "listing_type": "rent"},
        {"title": "x", "price": 5, "photo_urls": ["u"] * 7},
    ],
)
def test_create_validation(http, body):
    _as_user({"profiles": [{"school_id": "northeastern"}]})
    assert http.post("/listings", json=body).status_code == 422


def test_requires_auth(http):
    assert http.get("/listings/l1").status_code == 401
    assert http.post("/listings", json={"title": "x", "price": 1}).status_code == 401


def test_mark_sold_updates_only_owned_listing(http):
    sold_row = {**LISTING_ROW, "status": "sold"}
    fake = _as_user({"profiles": [{"school_id": "northeastern"}], "listings": [sold_row]})
    r = http.post("/listings/l1/sold")
    assert r.status_code == 200
    assert r.json()["status"] == "sold"
    assert ("listings", "update", ({"status": "sold"},)) in fake.log
    assert ("listings", "eq", ("seller_id", "u1")) in fake.log


def test_mark_sold_404_when_not_owner_or_missing(http):
    _as_user({"profiles": [{"school_id": "northeastern"}], "listings": []})
    assert http.post("/listings/l1/sold").status_code == 404


def test_delete_is_a_soft_delete(http):
    fake = _as_user({"profiles": [{"school_id": "northeastern"}], "listings": [LISTING_ROW]})
    r = http.delete("/listings/l1")
    assert r.status_code == 204
    assert ("listings", "update", ({"status": "removed"},)) in fake.log
    assert not any(op == "delete" for _, op, _ in fake.log)


def test_delete_404_when_not_owner(http):
    _as_user({"profiles": [{"school_id": "northeastern"}], "listings": []})
    assert http.delete("/listings/l1").status_code == 404


def test_detail_excludes_removed(http):
    fake = _as_user({"profiles": [{"school_id": "northeastern"}], "listings": []})
    assert http.get("/listings/l1").status_code == 404
    assert ("listings", "neq", ("status", "removed")) in fake.log


def test_owner_actions_require_auth(http):
    assert http.post("/listings/l1/sold").status_code == 401
    assert http.delete("/listings/l1").status_code == 401


def test_mine_is_not_shadowed_by_listing_id_route(http):
    rows = [
        {**LISTING_ROW, "id": f"l{i}", "listing_photos": [{"photo_url": f"{i}.jpg", "sort_order": 0}]}
        for i in range(3)
    ]
    fake = _as_user({"listings": rows})
    body = http.get("/listings/mine", params={"limit": 2}).json()
    assert [r["id"] for r in body["results"]] == ["l0", "l1"]
    assert body["results"][0]["photo_url"] == "0.jpg"
    assert body["has_more"] is True
    assert ("listings", "eq", ("seller_id", "u1")) in fake.log
    assert ("listings", "neq", ("status", "removed")) in fake.log
    assert ("listings", "range", (0, 2)) in fake.log


def test_patch_updates_only_sent_fields_and_converts_price(http):
    fake = _as_user({"profiles": [{"school_id": "northeastern"}], "listings": [LISTING_ROW]})
    r = http.patch("/listings/l1", json={"title": " New ", "price": 12.5, "size": None})
    assert r.status_code == 200
    update = next(c for c in fake.log if c[1] == "update")
    assert update[2][0] == {"title": "New", "price_cents": 1250, "size": None}
    assert ("listings", "in_", ("status", ["active"])) in fake.log
    assert ("listings", "eq", ("seller_id", "u1")) in fake.log


@pytest.mark.parametrize(
    "body",
    [{}, {"title": None}, {"price": None}, {"title": ""}, {"price": -5}, {"listing_type": "rent"}],
)
def test_patch_validation(http, body):
    _as_user({"profiles": [{"school_id": "northeastern"}], "listings": [LISTING_ROW]})
    assert http.patch("/listings/l1", json=body).status_code == 422


def test_patch_404_when_not_owner_or_not_active(http):
    _as_user({"profiles": [{"school_id": "northeastern"}], "listings": []})
    assert http.patch("/listings/l1", json={"title": "x"}).status_code == 404


def test_patch_requires_auth(http):
    assert http.patch("/listings/l1", json={"title": "x"}).status_code == 401
