from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.core.auth import UserContext, get_user_context
from app.core.listing_options import CATEGORIES, CONDITIONS, LISTING_TYPES, SIZES
from app.schemas.listings import (
    ListingCreate,
    ListingDetail,
    ListingPhoto,
    ListingUpdate,
)
from app.schemas.search import ListingResult, ListingSearchResponse

router = APIRouter(prefix="/listings", tags=["listings"])

DETAIL_SELECT = "*, listing_photos(photo_url, sort_order), profiles!seller_id(full_name)"


def _my_school_id(ctx: UserContext) -> str:
    rows = (
        ctx.client.table("profiles")
        .select("school_id")
        .eq("id", ctx.user_id)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=403, detail="Profile not found.")
    return rows[0]["school_id"]


def _to_detail(row: dict) -> ListingDetail:
    photos = sorted(row.get("listing_photos") or [], key=lambda p: p.get("sort_order", 0))
    seller = row.get("profiles") or {}
    return ListingDetail(
        **{k: row[k] for k in ListingDetail.model_fields if k in row},
        seller_name=seller.get("full_name"),
        photos=[ListingPhoto(**p) for p in photos],
    )


@router.post("", response_model=ListingDetail, status_code=201)
def create_listing(
    payload: ListingCreate, ctx: UserContext = Depends(get_user_context)
) -> ListingDetail:
    """Create a listing at the caller's school. Seller and school come from the
    caller's identity, never from the request body."""
    school_id = _my_school_id(ctx)
    try:
        created = (
            ctx.client.table("listings")
            .insert(
                {
                    "seller_id": ctx.user_id,
                    "school_id": school_id,
                    "title": payload.title.strip(),
                    "description": (payload.description or "").strip() or None,
                    "price_cents": round(payload.price * 100),
                    "category": payload.category,
                    "size": payload.size,
                    "condition": payload.condition,
                    "listing_type": payload.listing_type,
                }
            )
            .execute()
            .data[0]
        )
        if payload.photo_urls:
            ctx.client.table("listing_photos").insert(
                [
                    {"listing_id": created["id"], "photo_url": url, "sort_order": i}
                    for i, url in enumerate(payload.photo_urls)
                ]
            ).execute()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not create listing.") from exc

    return get_listing(created["id"], ctx)


@router.get("/options")
def listing_options() -> dict:
    """Allowed values for the post/edit pickers, so the app never hardcodes them.
    Static data, so no login needed. Declared before `/{listing_id}` like `/mine`."""
    return {
        "categories": CATEGORIES,
        "sizes": SIZES,
        "conditions": CONDITIONS,
        "listing_types": LISTING_TYPES,
    }


@router.get("/mine", response_model=ListingSearchResponse)
def my_listings(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    ctx: UserContext = Depends(get_user_context),
) -> ListingSearchResponse:
    """The caller's own listings, newest first, for the Profile tab. Includes
    sold items (check `status`); removed ones are hidden.

    Declared before `/{listing_id}` on purpose: FastAPI matches routes in order,
    so otherwise "mine" would be treated as a listing id."""
    try:
        # Ask for one extra row so we can report has_more without a count query.
        rows = (
            ctx.client.table("listings")
            .select("*, listing_photos(photo_url, sort_order)")
            .eq("seller_id", ctx.user_id)
            .neq("status", "removed")
            .order("created_at", desc=True)
            .range(offset, offset + limit)
            .execute()
            .data
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not load listings.") from exc

    def first_photo(row: dict) -> str | None:
        photos = sorted(row.get("listing_photos") or [], key=lambda p: p.get("sort_order", 0))
        return photos[0]["photo_url"] if photos else None

    return ListingSearchResponse(
        results=[
            ListingResult(**{**row, "photo_url": first_photo(row)}) for row in rows[:limit]
        ],
        limit=limit,
        offset=offset,
        has_more=len(rows) > limit,
    )


@router.get("/{listing_id}", response_model=ListingDetail)
def get_listing(
    listing_id: str, ctx: UserContext = Depends(get_user_context)
) -> ListingDetail:
    """One listing with photos and seller name. 404 if it's at another school
    (RLS alone doesn't scope reads by campus) or has been removed."""
    try:
        rows = (
            ctx.client.table("listings")
            .select(DETAIL_SELECT)
            .eq("id", listing_id)
            .eq("school_id", _my_school_id(ctx))
            .neq("status", "removed")
            .execute()
            .data
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not load listing.") from exc
    if not rows:
        raise HTTPException(status_code=404, detail="Listing not found.")
    return _to_detail(rows[0])


def _update_owned(
    ctx: UserContext, listing_id: str, values: dict, from_statuses: list[str]
) -> None:
    """Update a listing only if the caller owns it and it's in one of
    `from_statuses`. Not found, someone else's, and wrong state all give the
    same 404, so the response doesn't reveal whether a listing exists."""
    try:
        rows = (
            ctx.client.table("listings")
            .update(values)
            .eq("id", listing_id)
            .eq("seller_id", ctx.user_id)
            .in_("status", from_statuses)
            .execute()
            .data
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not update listing.") from exc
    if not rows:
        raise HTTPException(status_code=404, detail="Listing not found.")


@router.patch("/{listing_id}", response_model=ListingDetail)
def update_listing(
    listing_id: str,
    payload: ListingUpdate,
    ctx: UserContext = Depends(get_user_context),
) -> ListingDetail:
    """Owner edits their listing. Only the fields you send are changed. Only
    active listings can be edited (sold and removed ones are frozen)."""
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="No fields to update.")
    # Required columns can't be cleared. Optional ones (description, category,
    # size, condition) can be set to null to blank them out.
    for required in ("title", "price", "listing_type"):
        if required in fields and fields[required] is None:
            raise HTTPException(status_code=422, detail=f"{required} cannot be null.")

    values = {k: v for k, v in fields.items() if k != "price"}
    if "price" in fields:
        values["price_cents"] = round(fields["price"] * 100)
    if "title" in values:
        values["title"] = values["title"].strip()
    if values.get("description") is not None:
        values["description"] = values["description"].strip() or None

    _update_owned(ctx, listing_id, values, ["active"])
    return get_listing(listing_id, ctx)


@router.post("/{listing_id}/sold", response_model=ListingDetail)
def mark_sold(
    listing_id: str, ctx: UserContext = Depends(get_user_context)
) -> ListingDetail:
    """Owner marks a listing as sold. Safe to call twice. Sold listings drop out
    of search automatically (it only returns status = 'active')."""
    _update_owned(ctx, listing_id, {"status": "sold"}, ["active", "sold"])
    return get_listing(listing_id, ctx)


@router.delete("/{listing_id}", status_code=204)
def delete_listing(
    listing_id: str, ctx: UserContext = Depends(get_user_context)
) -> Response:
    """Owner removes a listing. This is a soft delete (status = 'removed'), so
    buyers keep their conversations and nothing cascades away. Safe to call twice."""
    _update_owned(ctx, listing_id, {"status": "removed"}, ["active", "sold", "removed"])
    return Response(status_code=204)


# TODO (see docs/listings-api-outline.md):
#   POST   /listings/{id}/photos     -> owner adds an uploaded photo URL
