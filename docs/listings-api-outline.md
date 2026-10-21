# Listings API outline (`backend/listings-api`)

Serves **Post a listing**, **Listing detail** and the owner actions behind
them (edit / delete / mark sold). Search lives in `/search/listings` already.

Status key: DONE = implemented + tested, TODO = stubbed in `routers/listings.py`.

## Endpoints

| Status | Endpoint | Who | Notes |
|---|---|---|---|
| DONE | `POST /listings` | any signed-in user | seller + school come from the token, never the body. Price in **dollars**, up to 6 `photo_urls`. Returns the detail shape. |
| DONE | `GET /listings/{id}` | same school only | Photos sorted by `sort_order`, plus `seller_name`. 404 for other schools. |
| TODO | `GET /listings/mine` | owner | Profile tab. Declare **before** `/{id}`. Include sold items, newest first. |
| TODO | `PATCH /listings/{id}` | owner | Partial update with `ListingUpdate`. 404 if not the owner (RLS filters it). |
| DONE | `POST /listings/{id}/sold` | owner | Sets `status = 'sold'`; idempotent. Drops out of search automatically. 404 if not yours. |
| DONE | `DELETE /listings/{id}` | owner | **Soft delete** (`status = 'removed'`), returns 204, idempotent. Removed listings 404 on detail and never show in search. |
| TODO | `POST /listings/{id}/photos` | owner | Registers an already-uploaded photo URL. |

## Design decisions already made
- **Photos upload straight from the app to Supabase Storage** (`listing-photos`
  bucket), then the app sends the public URLs. FastAPI never handles image bytes.
- **Everything goes through `get_user_context`** (`app/core/auth.py`), so RLS
  applies. Never use the service-role client here.
- **School scoping is explicit in code.** RLS lets any signed-in user read any
  school's listings, so every read filters by the caller's `school_id`
  (`_my_school_id`).
- Detail and search share the vocabulary: `price_cents` out, dollars in.

## Open questions for Zaid
1. **Allowed values for category / size / condition.** Right now they're free
   text, and search filters are case-sensitive exact matches (`Tops` != `tops`).
   Options: a fixed list validated server-side (and a `GET /listings/options`
   for the app's pickers), or lowercase everything on write. Recommend the list.
2. ~~Delete vs soft delete.~~ **Decided: soft delete** via `status = 'removed'`,
   so buyers keep their conversations. Revisit if we need real data deletion.
3. ~~Mark sold: separate endpoint or `PATCH status`?~~ **Decided: separate
   endpoint** (`POST /{id}/sold`); lets us hook notifications/ratings later.
4. **Photo cleanup.** Deleting a listing doesn't delete its Storage files.
   Fine for now; later a cleanup job.
5. **`listing_photos` has no update/delete RLS policy**, so removing or
   reordering photos needs a migration (`002_listing_photos_policies.sql`).

## Suggested order (smallest useful steps)
1. ~~`POST /listings/{id}/sold` and `DELETE`~~ (done).
2. `GET /listings/mine`.
3. `PATCH /listings/{id}`.
4. Decide question 1, then add validation of category/size/condition.
5. Photo endpoint + the `002` migration.

## Frontend (Priyanka) once it lands
- `CreateListingScreen` currently inserts into Supabase directly. Switch it to:
  upload the photo to Storage, then `api.post('/listings', {...})` using
  `src/lib/api.js`.
- `ListingDetailScreen` -> `api.get('/listings/' + id)`.
- Branches: `frontend/post-listing`, `frontend/listing-detail`.

## Testing
`cd backend && pytest`. `tests/test_listings.py` has a chainable fake of the
Supabase query builder; copy its pattern for new endpoints. Remember the
tests mock Supabase, so also try each endpoint once against the real project
(Swagger at `/docs` has an Authorize button for the token).
