-- Clean up existing listings so category / size / condition use the canonical
-- spelling from backend/app/core/listing_options.py ('tops' -> 'Tops',
-- 'like new' -> 'Like new', 'OS' -> 'One Size'). Only fixes capitalization and
-- known aliases; anything else is left alone and reported by the last query.
-- Safe to re-run.

update listings l set category = v.canon
from unnest(array['Tops','Bottoms','Dresses','Jackets','Shoes','Accessories']) as v(canon)
where lower(btrim(l.category)) = lower(v.canon) and l.category <> v.canon;

update listings l set size = v.canon
from unnest(array['XS','S','M','L','XL','XXL','One Size']) as v(canon)
where lower(btrim(l.size)) = lower(v.canon) and l.size <> v.canon;

update listings set size = 'One Size'
where lower(btrim(size)) in ('os', 'onesize', 'one-size');

update listings l set condition = v.canon
from unnest(array['New','Like new','Good','Fair']) as v(canon)
where lower(btrim(l.condition)) = lower(v.canon) and l.condition <> v.canon;

-- Result: values that still don't match the lists (empty = all clean).
-- Fix these by hand, or they'll block migration 003.
select 'category' as field, category as value, count(*) as listings
from listings
where category is not null
  and category not in ('Tops','Bottoms','Dresses','Jackets','Shoes','Accessories')
group by category
union all
select 'condition', condition, count(*)
from listings
where condition is not null and condition not in ('New','Like new','Good','Fair')
group by condition
union all
select 'size', size, count(*)
from listings
where size is not null
  and size not in ('XS','S','M','L','XL','XXL','One Size',
                   '5','5.5','6','6.5','7','7.5','8','8.5','9','9.5',
                   '10','10.5','11','11.5','12','12.5','13')
group by size;
