from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.listing_options import CATEGORIES, CONDITIONS, SIZES, canonical


class ListingSearchParams(BaseModel):
    q: str | None = Field(default=None, max_length=100)
    category: str | None = None
    size: str | None = None
    condition: str | None = None
    listing_type: Literal["resale", "handmade"] | None = None
    min_price: float | None = Field(default=None, ge=0, description="Dollars")
    max_price: float | None = Field(default=None, ge=0, description="Dollars")
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)

    # Lenient: 'tops' becomes 'Tops', but an unknown value just matches nothing.
    @field_validator("category")
    @classmethod
    def _category(cls, v):
        return canonical(v, CATEGORIES, strict=False, field="category")

    @field_validator("size")
    @classmethod
    def _size(cls, v):
        return canonical(v, SIZES, strict=False, field="size")

    @field_validator("condition")
    @classmethod
    def _condition(cls, v):
        return canonical(v, CONDITIONS, strict=False, field="condition")

    @model_validator(mode="after")
    def _price_range_is_ordered(self) -> "ListingSearchParams":
        if (
            self.min_price is not None
            and self.max_price is not None
            and self.min_price > self.max_price
        ):
            raise ValueError("min_price cannot be greater than max_price")
        return self


class ListingResult(BaseModel):
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
    photo_url: str | None = None


class ListingSearchResponse(BaseModel):
    results: list[ListingResult]
    limit: int
    offset: int
    has_more: bool
