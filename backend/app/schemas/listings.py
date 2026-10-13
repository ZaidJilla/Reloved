from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ListingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    price: float = Field(ge=0, le=10000, description="Dollars")
    category: str | None = None
    size: str | None = None
    condition: str | None = None
    listing_type: Literal["resale", "handmade"] = "resale"
    # Photos are uploaded to Supabase Storage by the app first; these are the
    # resulting public URLs, in display order.
    photo_urls: list[str] = Field(default_factory=list, max_length=6)


class ListingUpdate(BaseModel):
    """Partial update: only fields that are sent get changed."""

    title: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    price: float | None = Field(default=None, ge=0, le=10000, description="Dollars")
    category: str | None = None
    size: str | None = None
    condition: str | None = None
    listing_type: Literal["resale", "handmade"] | None = None


class ListingPhoto(BaseModel):
    photo_url: str
    sort_order: int = 0


class ListingDetail(BaseModel):
    id: str
    title: str
    description: str | None = None
    price_cents: int
    category: str | None = None
    size: str | None = None
    condition: str | None = None
    listing_type: str
    status: str
    created_at: datetime
    seller_id: str
    seller_name: str | None = None
    photos: list[ListingPhoto] = []
