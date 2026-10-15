-- Dev seed data: adds sample listings for local testing. Never run in production.
-- Run in the Supabase SQL editor. Uses the two existing test profiles
-- ('Test' and 'Admin NEU'); adjust the names below if yours differ.
-- This only inserts. Clear old test listings separately first if you want a clean slate.

insert into listings
  (seller_id, school_id, title, description, price_cents, category, size, condition, listing_type)
select p.id, p.school_id, v.title, v.description, v.price_cents, v.category, v.size, v.condition, v.listing_type
from (values
  ('Test',      'Vintage Carhartt Jacket',   'Brown duck canvas work jacket, broken in perfectly',  4500, 'Jackets', 'L',  'Good',     'resale'),
  ('Test',      'Levi''s 501 Jeans',         'Classic straight fit, light wash, size 30x32',         3000, 'Bottoms', 'S',  'Like new', 'resale'),
  ('Test',      'Flannel Button-Up',         'Warm cozy flannel, red and black plaid',               2000, 'Tops',    'M',  'Like new', 'resale'),
  ('Test',      'Hand-Knit Wool Beanie',     'Handmade chunky beanie, one of a kind',                1800, 'Accessories', 'OS', 'New',  'handmade'),
  ('Admin NEU', 'Doc Martens 1460 Boots',    'Black leather, worn a handful of times, US 8',         6500, 'Shoes',   '8',  'Good',     'resale'),
  ('Admin NEU', 'Patagonia Fleece Pullover', 'Quarter zip, navy, super warm for Boston winters',    5500, 'Jackets', 'M',  'Good',     'resale'),
  ('Admin NEU', 'Y2K Baby Tee',              'Cropped graphic tee, tiny snag on hem',                1200, 'Tops',    'XS', 'Fair',     'resale'),
  ('Admin NEU', 'Upcycled Denim Tote',       'Made from old jeans, fully lined, fits a laptop',      2800, 'Accessories', 'OS', 'New',  'handmade')
) as v(seller, title, description, price_cents, category, size, condition, listing_type)
join profiles p on p.full_name = v.seller;
