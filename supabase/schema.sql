-- Campus Closet — Supabase schema
-- Run this in the Supabase SQL editor on a fresh project.

-- 1. Schools (campuses supported at launch)
create table if not exists schools (
  id text primary key,
  name text not null,
  email_domain text not null unique
);

insert into schools (id, name, email_domain) values
  ('tufts', 'Tufts University', 'tufts.edu'),
  ('northeastern', 'Northeastern University', 'northeastern.edu')
on conflict (id) do nothing;

-- 2. Profiles (one row per authenticated user, linked to auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id text references schools(id) not null,
  full_name text not null,
  photo_url text,
  grad_year int,
  is_verified boolean default false,
  created_at timestamptz default now()
);

-- 3. Listings
create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references profiles(id) on delete cascade not null,
  school_id text references schools(id) not null,
  title text not null,
  description text,
  price_cents int not null check (price_cents >= 0),
  category text,
  size text,
  condition text,
  listing_type text not null default 'resale' check (listing_type in ('resale', 'handmade')),
  status text not null default 'active' check (status in ('active', 'sold', 'removed')),
  created_at timestamptz default now()
);

create index if not exists idx_listings_school_status_created
  on listings(school_id, status, created_at desc);
create index if not exists idx_listings_category on listings(category);
create index if not exists idx_listings_size on listings(size);
create index if not exists idx_listings_condition on listings(condition);
create index if not exists idx_listings_price on listings(price_cents);

-- Full-text search over title + description, weighted toward title.
alter table listings add column if not exists search_text tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;

create index if not exists idx_listings_search_text on listings using gin(search_text);

-- 4. Listing photos (multiple per listing)
create table if not exists listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id) on delete cascade not null,
  photo_url text not null,
  sort_order int default 0
);

-- 5. Conversations (one per listing per buyer)
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id) on delete cascade not null,
  buyer_id uuid references profiles(id) on delete cascade not null,
  seller_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (listing_id, buyer_id)
);

-- 6. Messages
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists idx_messages_conversation on messages(conversation_id);

-- 7. Reports (for moderation)
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete cascade not null,
  listing_id uuid references listings(id) on delete cascade,
  reported_user_id uuid references profiles(id) on delete cascade,
  reason text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles enable row level security;
alter table listings enable row level security;
alter table listing_photos enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table reports enable row level security;

-- Profiles: anyone signed in can read profiles, only owner can edit their own
create policy "profiles are viewable by authenticated users"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Listings: viewable by anyone signed in, only owner can insert/update/delete their own
create policy "listings are viewable by authenticated users"
  on listings for select
  using (auth.role() = 'authenticated');

create policy "users can insert their own listings"
  on listings for insert
  with check (auth.uid() = seller_id);

create policy "users can update their own listings"
  on listings for update
  using (auth.uid() = seller_id);

create policy "users can delete their own listings"
  on listings for delete
  using (auth.uid() = seller_id);

-- Listing photos: readable by anyone signed in, insert only by listing owner
create policy "listing photos viewable by authenticated users"
  on listing_photos for select
  using (auth.role() = 'authenticated');

create policy "listing owner can add photos"
  on listing_photos for insert
  with check (
    exists (
      select 1 from listings
      where listings.id = listing_photos.listing_id
      and listings.seller_id = auth.uid()
    )
  );

-- Conversations: only buyer or seller in the conversation can see it
create policy "participants can view their conversations"
  on conversations for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "buyer can start a conversation"
  on conversations for insert
  with check (auth.uid() = buyer_id);

-- Messages: only participants of the parent conversation can read/write
create policy "participants can view messages"
  on messages for select
  using (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
      and (conversations.buyer_id = auth.uid() or conversations.seller_id = auth.uid())
    )
  );

create policy "participants can send messages"
  on messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
      and (conversations.buyer_id = auth.uid() or conversations.seller_id = auth.uid())
    )
  );

-- Reports: reporter can insert, nobody can read others' reports (admin uses service role)
create policy "users can file reports"
  on reports for insert
  with check (auth.uid() = reporter_id);

-- ============================================================
-- Search + filter listings
-- ============================================================
-- Runs as the caller (security invoker, the default), so the existing RLS
-- policies still apply. School scoping is enforced here from the caller's
-- own profile row rather than trusting a client-supplied school_id, since
-- the "listings are viewable by authenticated users" policy above doesn't
-- itself restrict rows to the caller's campus.
create or replace function public.search_listings(
  p_query text default null,
  p_category text default null,
  p_size text default null,
  p_condition text default null,
  p_listing_type text default null,
  p_min_price_cents int default null,
  p_max_price_cents int default null
)
returns table (
  id uuid,
  title text,
  description text,
  price_cents int,
  category text,
  size text,
  condition text,
  listing_type text,
  status text,
  created_at timestamptz,
  seller_id uuid,
  photo_url text
)
language sql
stable
set search_path = public
as $$
  select
    l.id, l.title, l.description, l.price_cents, l.category, l.size,
    l.condition, l.listing_type, l.status, l.created_at, l.seller_id,
    (
      select lp.photo_url from listing_photos lp
      where lp.listing_id = l.id
      order by lp.sort_order
      limit 1
    ) as photo_url
  from listings l
  cross join lateral (
    select
      nullif(btrim(p_query), '') as q_text,
      websearch_to_tsquery('english', nullif(btrim(p_query), '')) as tsq
  ) q
  where l.status = 'active'
    and l.school_id = (select p.school_id from profiles p where p.id = auth.uid())
    and (p_category is null or l.category = p_category)
    and (p_size is null or l.size = p_size)
    and (p_condition is null or l.condition = p_condition)
    and (p_listing_type is null or l.listing_type = p_listing_type)
    and (p_min_price_cents is null or l.price_cents >= p_min_price_cents)
    and (p_max_price_cents is null or l.price_cents <= p_max_price_cents)
    and (q.q_text is null or l.search_text @@ q.tsq)
  order by
    case when q.q_text is not null
      then ts_rank(l.search_text, q.tsq)
    end desc nulls last,
    l.created_at desc;
$$;

grant execute on function public.search_listings to authenticated;

-- ============================================================
-- Auto-create profile row on signup
-- ============================================================
-- signUp() has no active session yet when email confirmation is required,
-- so a client-side insert into profiles fails the RLS check (auth.uid() is
-- null). This trigger runs server-side as the table owner, bypassing RLS,
-- and reads the school_id/full_name passed via signUp's `options.data`.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(new.raw_user_meta_data ->> 'school_id', '') is null
     or nullif(new.raw_user_meta_data ->> 'full_name', '') is null then
    raise exception 'Missing required signup metadata (school_id, full_name)';
  end if;

  insert into public.profiles (id, school_id, full_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'school_id',
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
