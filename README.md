# Reloved

A campus-only marketplace for students to buy, sell, and resell clothes —
launching with **Tufts University** and **Northeastern University**.

This is a working starter codebase: React Native (Expo) + Supabase.
You'll need to run a few setup steps on your own machine, but every file is
ready to go — this is not a from-scratch tutorial.

## What's included

- Email-based sign up that only accepts `@tufts.edu` and `@northeastern.edu`
- Home feed scoped to the user's own campus, with search
- Create listing flow with photo upload and a **Resale / Handmade by me** toggle
- Listing detail page with "Message Seller" and "Mark as Sold"
- Real-time in-app chat between buyer and seller
- Profile page showing your own listings
- Full Postgres schema + Row Level Security policies in `supabase/schema.sql`

## 1. Set up Supabase (5 minutes)

1. Go to https://supabase.com and create a free project.
2. In the Supabase dashboard, open the **SQL Editor**, paste the entire
   contents of `supabase/schema.sql`, and run it. This creates all tables,
   seeds Tufts + Northeastern as supported schools, and sets up security
   policies so users can only see/edit what they should.
3. Go to **Storage** → create a new **public** bucket named `listing-photos`.
4. Go to **Project Settings → API** and copy your **Project URL** and
   **anon public key**.

## 2. Configure the app

Copy `.env.example` to `.env` and fill in your real values:

```bash
cp .env.example .env
```

```
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

`.env` is git-ignored, so your keys never get committed.

## 3. Install and run locally

You'll need Node.js installed, and the Expo Go app on your phone
(or an iOS/Android simulator).

```bash
npm install
npx expo start
```

Scan the QR code with the Expo Go app (Android) or your Camera app (iOS)
to run it on your phone.

## 4. Try it out

1. Sign up with a `@tufts.edu` or `@northeastern.edu` email (any other domain
   will be rejected).
2. Supabase will email a confirmation link — by default this goes to
   Supabase's built-in test email flow. In **Authentication → Settings**
   you can turn off "Confirm email" while testing, so sign-up logs you in
   immediately.
3. Post a listing from the "Sell" tab, mark it Resale or Handmade.
4. Log in as a second test user and message the seller from the listing page.

## Project structure

```
App.js                        entry point, routes to auth or main app
src/
  lib/supabase.js             Supabase client
  constants/schools.js        supported schools + email domain matching
  navigation/
    AuthNavigator.js          login/signup stack
    MainTabNavigator.js       Browse / Sell / Messages / Profile tabs
  screens/
    auth/LoginScreen.js
    auth/SignUpScreen.js
    HomeScreen.js              browse feed for the user's campus
    CreateListingScreen.js     post a new listing
    ListingDetailScreen.js     view listing, message seller, mark sold
    MessagesScreen.js          conversation inbox
    ChatScreen.js              real-time 1:1 chat
    ProfileScreen.js           your listings + sign out
supabase/
  schema.sql                   full DB schema + RLS policies
```

## Search API

`GET /search/listings` — searches active listings at the caller's school (the
school is taken from their profile server-side, never from the request).

Send the Supabase session token: `Authorization: Bearer <access_token>`.

| Query param | Notes |
|---|---|
| `q` | Keywords, matched against title + description (max 100 chars) |
| `category`, `size`, `condition` | Exact match |
| `listing_type` | `resale` or `handmade` |
| `min_price`, `max_price` | Dollars (e.g. `12.50`); min must be <= max |
| `limit`, `offset` | Pagination. `limit` 1-100 (default 20) |

Response: `{ results: [...], limit, offset, has_more }`. Each result has `id`,
`title`, `description`, `price_cents`, `category`, `size`, `condition`,
`listing_type`, `status`, `created_at`, `seller_id`, `photo_url`.
For infinite scroll in a `FlatList`, call again with `offset += limit` while
`has_more` is true. Re-run `supabase/schema.sql`'s `search_listings` section
in the Supabase SQL editor to pick up the pagination params.

Backend tests: `cd backend && pip install -r requirements-dev.txt && pytest`.

## Next steps (see the ticket backlog doc for the full list)

- Add push notifications for new messages (Expo Notifications)
- Add filters (category, price, size, condition) to the Browse tab
- Add ratings/reviews after a completed transaction
- Add a report/block flow for safety
- Only after the above is solid: consider in-app payments
