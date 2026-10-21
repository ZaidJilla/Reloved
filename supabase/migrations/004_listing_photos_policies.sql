-- Let a listing's owner delete or update its photos. Before this, listing_photos
-- only had select and insert policies, so DELETE /listings/{id}/photos/{photo_id}
-- would silently match zero rows. Same ownership rule as the existing insert
-- policy in schema.sql. Safe to re-run.

drop policy if exists "listing owner can delete photos" on listing_photos;
create policy "listing owner can delete photos"
  on listing_photos for delete
  using (
    exists (
      select 1 from listings
      where listings.id = listing_photos.listing_id
      and listings.seller_id = auth.uid()
    )
  );

drop policy if exists "listing owner can update photos" on listing_photos;
create policy "listing owner can update photos"
  on listing_photos for update
  using (
    exists (
      select 1 from listings
      where listings.id = listing_photos.listing_id
      and listings.seller_id = auth.uid()
    )
  );
