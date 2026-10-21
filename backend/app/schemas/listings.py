from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.core.listing_options import CATEGORIES, CONDITIONS, MAX_PHOTOS, SIZES, canonical


class _ListingOptionsMixin(BaseModel):
    """Normalizes and validates category/size/condition (shared by create and edit)."""

    @field_validator("category", check_fields=False)
    @classmethod
    def _category(cls, v):
        return canonical(v, CATEGORIES, strict=True, field="category")

    @field_validator("size", check_fields=False)
    @classmethod
    def _size(cls, v):
        return canonical(v, SIZES, strict=True, field="size")

    @field_validator("condition", check_fields=False)
    @classmethod
    def _condition(cls, v):
        return canonical(v, CONDITIONS, strict=True, field="condition")


class ListingCreate(_ListingOptionsMixin):
    title: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    price: float = Field(ge=0, le=10000, description="Dollars")
    category: str | None = None
    size: str | None = None
    condition: str | None = None
    listing_type: Literal["resale", "handmade"] = "resale"
    # Photos are uploaded to Supabase Storage by the app first; these are the
    # resulting public URLs, in display order.
    photo_urls: list[str] = Field(default_factory=list, max_length=MAX_PHOTOS)


class ListingUpdate(_ListingOptionsMixin):
    """Partial update: only fields that are sent get changed."""

    title: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    price: float | None = Field(default=None, ge=0, le=10000, description="Dollars")
    category: str | None = None
    size: str | None = None
    condition: str | None = None
    listing_type: Literal["resale", "handmade"] | None = None


class ListingPhoto(BaseModel):
    id: str | None = None
    photo_url: str
    sort_order: int = 0


class PhotoCreate(BaseModel):
    photo_url: str = Field(max_length=2000)


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
