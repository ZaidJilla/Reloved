import { supabase } from './supabase';

// Tiny prefetch cache for the listing screen. Home starts the fetch the moment a
// card is tapped, so it finishes while the card-expand animation is still
// running and the listing screen can render complete on its first frame.

const entries = new Map();

export function prefetchListing(id) {
  const entry = { value: null };
  entry.promise = (async () => {
    const [{ data: sessionData }, { data, error }] = await Promise.all([
      supabase.auth.getSession(),
      supabase
        .from('listings')
        .select('*, listing_photos(photo_url), profiles!listings_seller_id_fkey(full_name)')
        .eq('id', id)
        .single(),
    ]);
    entry.value = { userId: sessionData?.session?.user?.id ?? null, listing: error ? null : data };
  })().catch(() => {});
  entries.set(id, entry);
}

// Synchronous: returns the result only if the prefetch has already finished.
export function getPrefetched(id) {
  return entries.get(id)?.value ?? null;
}

export function clearPrefetched(id) {
  entries.delete(id);
}
