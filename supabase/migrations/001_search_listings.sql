-- ============================================================
-- Search + filter listings
-- ============================================================
-- Runs as the caller (security invoker, the default), so the existing RLS
-- policies still apply. School scoping is enforced here from the caller's
-- own profile row rather than trusting a client-supplied school_id, since
-- the "listings are viewable by authenticated users" policy above doesn't
-- itself restrict rows to the caller's campus.
-- Drop every existing version so the new signature replaces them instead of
-- becoming an ambiguous overload.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.proname = 'search_listings' and p.pronamespace = 'public'::regnamespace
  loop
    execute 'drop function ' || r.sig;
  end loop;
end $$;

create or replace function public.search_listings(
  p_query text default null,
  p_category text default null,
  p_size text default null,
  p_condition text default null,
  p_listing_type text default null,
  p_min_price_cents int default null,
  p_max_price_cents int default null,
  p_limit int default 20,
  p_offset int default 0
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
    -- Split the query into terms and escape LIKE wildcards in each one, so
    -- typing "50%" or "_" searches for those characters literally.
    select coalesce(array(
      select '%' || regexp_replace(t, '([\\%_])', '\\\1', 'g') || '%'
      from unnest(regexp_split_to_array(lower(btrim(coalesce(p_query, ''))), '\s+')) t
      where t <> ''
    ), '{}') as pats
  ) q
  where l.status = 'active'
    and l.school_id = (select p.school_id from profiles p where p.id = auth.uid())
    and (p_category is null or l.category = p_category)
    and (p_size is null or l.size = p_size)
    and (p_condition is null or l.condition = p_condition)
    and (p_listing_type is null or l.listing_type = p_listing_type)
    and (p_min_price_cents is null or l.price_cents >= p_min_price_cents)
    and (p_max_price_cents is null or l.price_cents <= p_max_price_cents)
    -- Every term must appear somewhere in the title or description, so
    -- partial words ("tes") and middle-of-word matches ("annel") both work.
    and not exists (
      select 1 from unnest(q.pats) pat
      where not (l.title ilike pat or coalesce(l.description, '') ilike pat)
    )
  order by
    -- Listings whose title matches more terms come first.
    (select count(*) from unnest(q.pats) pat where l.title ilike pat) desc,
    l.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_listings(
  text, text, text, text, text, int, int, int, int
) to authenticated;
