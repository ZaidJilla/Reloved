"""The allowed values for listing category, size and condition.

Single source of truth for the API. `supabase/migrations/003_listing_value_checks.sql`
repeats these lists as database CHECK constraints (a test keeps them in sync),
and the app fetches them from GET /listings/options instead of hardcoding them.
"""

CATEGORIES = ("Tops", "Bottoms", "Dresses", "Jackets", "Shoes", "Accessories")

SIZES = (
    "XS", "S", "M", "L", "XL", "XXL", "One Size",
    # Shoe sizes (US), half sizes included.
    *(str(n / 2).removesuffix(".0") for n in range(10, 27)),
)

CONDITIONS = ("New", "Like new", "Good", "Fair")

LISTING_TYPES = ("resale", "handmade")

# Common alternate spellings, matched case-insensitively.
_ALIASES = {"os": "One Size", "onesize": "One Size", "one-size": "One Size"}


def canonical(value: str | None, allowed: tuple[str, ...], *, strict: bool, field: str):
    """Map 'tops', ' TOPS ' etc. to the canonical 'Tops'.

    Blank becomes None. An unknown value raises ValueError when `strict`
    (creating/editing a listing) and is passed through untouched otherwise
    (search filters, where an unknown value should just match nothing).
    """
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    lookup = {a.lower(): a for a in allowed}
    match = lookup.get(cleaned.lower()) or _ALIASES.get(cleaned.lower())
    if match in allowed:
        return match
    if strict:
        raise ValueError(f"Invalid {field} '{cleaned}'. Allowed: {', '.join(allowed)}")
    return cleaned
