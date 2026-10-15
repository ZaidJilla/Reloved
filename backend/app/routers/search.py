from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from app.core.auth import get_user_client
from app.schemas.search import (
    ListingResult,
    ListingSearchParams,
    ListingSearchResponse,
)

router = APIRouter(prefix="/search", tags=["search"])


def _dollars_to_cents(value: float | None) -> int | None:
    return None if value is None else round(value * 100)


@router.get("/listings", response_model=ListingSearchResponse)
def search_listings(
    params: Annotated[ListingSearchParams, Query()],
    client: Client = Depends(get_user_client),
) -> ListingSearchResponse:
    """Search active listings at the caller's school (scoping happens in the RPC)."""
    try:
        # Ask for one extra row so we can report has_more without a count query.
        rows = (
            client.rpc(
                "search_listings",
                {
                    "p_query": params.q,
                    "p_category": params.category,
                    "p_size": params.size,
                    "p_condition": params.condition,
                    "p_listing_type": params.listing_type,
                    "p_min_price_cents": _dollars_to_cents(params.min_price),
                    "p_max_price_cents": _dollars_to_cents(params.max_price),
                    "p_limit": params.limit + 1,
                    "p_offset": params.offset,
                },
            )
            .execute()
            .data
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Search is unavailable.") from exc

    has_more = len(rows) > params.limit
    return ListingSearchResponse(
        results=[ListingResult(**row) for row in rows[: params.limit]],
        limit=params.limit,
        offset=params.offset,
        has_more=has_more,
    )
