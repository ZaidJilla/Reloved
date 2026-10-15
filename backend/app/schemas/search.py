from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


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
