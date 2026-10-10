# Reloved

A campus-focused secondhand clothing marketplace app. Launching first at Tufts, then expanding to Northeastern.

## What makes this different from Depop/iWantIt/Vezzy

- **.edu email verification** — hyperlocal trust, only verified students
- **No shipping** — in-person meetups only
- **No seller fees**
- **Explore Board** — discover local flea/thrift markets
- These are structural advantages, not just features. Larger competitors can't easily replicate them.

## Tech stack

- **Frontend:** React Native (Expo)
- **Backend:** Python, FastAPI
- **Database / Auth / Storage:** Supabase
- **Payments:** Stripe (in-app payment or pay-at-meetup)
- **HTTP client:** Axios

## Team & ownership

- **Zaid (Northeastern)** — backend (FastAPI, Supabase, Stripe). Background in Java/Python.
- **Priyanka (Tufts)** — frontend (React Native). Learning as they go — prioritize `useState`, `useEffect`, and `FlatList` explanations since those power nearly every screen.

## Branch structure

```
main                 → deployable, protected, only merges from dev
dev                  → integration branch, all feature branches merge here first
  frontend/*         → co-founder's screen branches
  backend/*          → Zaid's endpoint branches
```

Always branch from `dev`, never from `main`. Merge feature branches into `dev` via PR once a screen's happy path works end-to-end against the real backend (not mocked data). Promote `dev` → `main` periodically via PR once stable.

## Screens ↔ endpoints

| Screen | Frontend branch | Backend branch | Priority |
|---|---|---|---|
| Onboarding / .edu auth | `frontend/onboarding-auth` | `backend/auth-supabase` | 1 |
| Home feed (grid) | `frontend/home-feed` | `backend/listings-api` | 2 |
| Post a listing | `frontend/post-listing` | `backend/listings-api` | 2 |
| Listing detail | `frontend/listing-detail` | `backend/listings-api` | 3 |
| Messaging | `frontend/messaging` | `backend/messaging-api` | 3 |
| Search & filters | `frontend/search-filters` | `backend/search-api` | 4 |
| Explore board | `frontend/explore-board` | `backend/explore-board-api` | 4 |
| Profile / saved | `frontend/profile-saved` | (part of `backend/auth-supabase`) | 4 |
| Checkout | (part of relevant screens) | `backend/stripe-integration` | last |

Auth gates everything, so it lands first. Feed + post-listing are the core loop. Messaging and checkout close the transaction. Search, explore board, and profile are parallelizable once the core loop works.

## Conventions

- Branch names: lowercase, hyphenated, prefixed `frontend/` or `backend/`.
- Keep feature branches short-lived — merge to `dev` within a few days.
- Pull `dev` into your feature branch often to avoid painful conflicts, especially on shared files (API contracts, shared types).
- Commit messages: present tense, short, descriptive (`Add .edu domain validation`, not `fixed stuff`).
- Design reference: Depop, Vinted, VSCO — for inspiration, not direct replication.
- Visual direction: Campus Community green palette (chosen over 3 other moodboard options for the hyperlocal trust angle).

## Build sequence (don't skip steps)

validate demand → recruit seed sellers → paper sketches → low-fi Figma → define design language → high-fi Figma → code

Figma is not the starting point. Wireframes for all 8 core screens are done; navigation architecture (bottom tabs + stack navigators, Supabase auth gate) is mapped.

## Commands

```bash
# Frontend (Expo)
npx expo start

# Backend (FastAPI)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in Supabase URL + anon key + service role key
uvicorn app.main:app --reload
```

## Notes for Claude Code

- When working on `frontend/*` branches, favor explaining `useState`/`useEffect`/`FlatList` patterns clearly — co-founder is learning React Native.
- When working on `backend/*` branches, match endpoint naming to the screen it serves (see table above) so frontend/backend stay easy to cross-reference.
- Don't introduce shipping/logistics features — meetup-only is a deliberate constraint, not a gap.
- Don't add seller fees — no-fee is a deliberate differentiator.
