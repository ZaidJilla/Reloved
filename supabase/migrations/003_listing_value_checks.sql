-- Database-level guard for category / size / condition, matching
-- backend/app/core/listing_options.py (backend/tests keeps them in sync).
--
-- RUN THIS ONLY AFTER the app posts through the API (or uses pickers): until
-- then the old post-listing screen sends free text straight to Supabase and
-- will be rejected here. Run 002 first and make sure its final query is empty.
--
-- NOT VALID = new and edited rows are checked, old rows are not re-scanned.
-- NULL is allowed (these fields are optional).
-- Safe to re-run.

alter table listings drop constraint if exists listings_category_check;
alter table listings add constraint listings_category_check
  check (category in ('Tops','Bottoms','Dresses','Jackets','Shoes','Accessories')) not valid;

alter table listings drop constraint if exists listings_condition_check;
alter table listings add constraint listings_condition_check
  check (condition in ('New','Like new','Good','Fair')) not valid;

alter table listings drop constraint if exists listings_size_check;
alter table listings add constraint listings_size_check
  check (size in ('XS','S','M','L','XL','XXL','One Size',
                  '5','5.5','6','6.5','7','7.5','8','8.5','9','9.5',
                  '10','10.5','11','11.5','12','12.5','13')) not valid;
