# Handoff: Search API

Covers two PRs into `dev`:

1. **`backend/search-api`** - the endpoint, SQL, tests (Zaid)
2. **`frontend/search-api-wiring`** - `HomeScreen` calling it, plus the Expo SDK 57 upgrade (stacked on #1, merge #1 first)

## What shipped

`GET /search/listings` searches **active listings at the caller's own school**.
The school comes from the caller's profile row inside the database, never from
the request, so a user can't search another campus by editing params.

- Partial-word matching: every typed term must appear somewhere in the title
  or description (`tes` finds "Test Flannel Shirt", `annel` finds "Flannel").
  Multiple words are AND-ed. Titles matching more terms rank first, then newest.
- Filters: category, size, condition, listing type, price range.
- Pagination: `limit` / `offset` with a `has_more` flag.
- All fields are optional; no params returns the newest listings.

## API contract

`Authorization: Bearer <supabase access_token>` is required (401 without it).

| Param | Notes |
|---|---|
| `q` | Search text, max 100 chars |
| `category`, `size`, `condition` | Exact match (case-sensitive) |
| `listing_type` | `resale` or `handmade` |
| `min_price`, `max_price` | **Dollars**, e.g. `12.50`. min must be <= max (else 422) |
| `limit` | 1-100, default 20 |
| `offset` | default 0 |

Response:

```json
{
  "results": [
    { "id": "...", "title": "Flannel Button-Up", "description": "...",
      "price_cents": 2000, "category": "Tops", "size": "M",
      "condition": "Like new", "listing_type": "resale", "status": "active",
      "created_at": "2026-10-12T03:29:33Z", "seller_id": "...", "photo_url": null }
  ],
  "limit": 20, "offset": 0, "has_more": false
}
```

Prices come back as `price_cents` (integer) but go in as dollars. Display with
`(price_cents / 100).toFixed(2)`.

## Setup after pulling

**1. Database** (Supabase SQL Editor; see `supabase/README.md` for the naming workflow)
- New query `001 search_listings`, paste `supabase/migrations/001_search_listings.sql`, run. Safe to re-run.
- Optional: query `Seed listings`, paste `supabase/seed.sql`, run. Inserts 8 sample listings for the `Test` and `Admin NEU` profiles.
- Do **not** re-run `supabase/schema.sql`; it's already applied and fails with "policy already exists".

**2. Backend**

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pytest
```

Note the module path is `app.main:app` (not `main:app`). `backend/.env` needs
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

**3. App** (root `.env`)

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
API_URL=http://<your-computer-LAN-IP>:8000
```

On a physical phone `localhost` is the phone itself, so `API_URL` must be your
computer's Wi-Fi IP (`ipconfig getifaddr en0` on Mac). Phone and computer on the
same network. If your IP changes, update `API_URL`. Keep the service-role key
**out** of the root `.env`; only `backend/.env` needs it.

```bash
npm install
npx expo start -c   # -c clears cache; needed whenever .env changes
```

**SDK 57:** the frontend PR upgrades Expo SDK 54 -> 57. Run `npm install` and
update the Expo Go app on your phone to a version that supports SDK 57.

## For Priyanka: how the frontend wiring works

`src/lib/api.js` is one shared Axios instance. Its **request interceptor** runs
before every call and adds the logged-in user's token, so screens never touch
auth headers:

```js
const { data } = await api.get('/search/listings', { params: { q: 'jacket' } });
setListings(data.results);
```

`HomeScreen.js` is the pattern to copy:

- **`useState`** holds `listings` and the `search` text. Calling `setListings`
  re-renders the screen with the new data.
- **`useCallback`** wraps `loadListings` so it's the same function between
  renders unless `search` changes.
- **`useEffect`** calls `loadListings` on mount and again whenever it changes
  (i.e. whenever `search` changes). That's how "load on open" and "reload on new
  search" both come from one effect.
- **`FlatList`** renders `listings`; `keyExtractor` gives each row a stable id,
  and `refreshControl` powers pull-to-refresh.
- Failed searches currently only `console.warn` and show the empty state, so
  check the Metro terminal and the backend terminal first when the feed is empty.

### Next for `frontend/search-filters`
- Filter UI (category, size, condition, price range, handmade toggle). Just
  add them to `params`; the backend already supports them.
- Live search: debounce `search` (~300ms) in a `useEffect` so results update as
  the user types instead of on return.
- Infinite scroll: `onEndReached` -> call again with `offset += limit` while
  `has_more` is true, appending to the list.
- Show a real error state instead of the empty state when the request fails.

## For Zaid: reuse when building `backend/listings-api`

- **`app/core/auth.py` -> `get_user_client`** is the dependency for any
  user-scoped endpoint. It verifies the JWT and returns a Supabase client that
  acts as that user, so RLS and `auth.uid()` apply. Don't use `get_admin_client`
  (service role) for user data; it bypasses RLS.
- RLS on `listings` lets any signed-in user read any school's rows. School
  scoping is enforced in the `search_listings` function, **not** by policy. New
  read endpoints must scope by school themselves (or we tighten the policy).
- `photo_url` in search results is the first photo by `sort_order`; listings
  with no photos return `null`.
- Search only looks at title and description, not category.
- New DB changes go in `supabase/migrations/NNN_name.sql` (next is `002`).

## Known gaps / not in these PRs
- No tests cover the SQL function itself (backend tests mock Supabase). It was
  verified manually by running `search_listings(...)` as a test user in the
  SQL editor.
- Case-sensitive exact filters: `Tops` != `tops`.
- Substring matching is a sequential scan. Fine at campus scale; add a
  `pg_trgm` index if listings reach the tens of thousands.
- `.pyc` files are tracked in git from an earlier commit; should be untracked.
