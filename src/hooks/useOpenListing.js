import { useRef } from 'react';
import { useCardTransition } from '../components';
import { prefetchListing } from '../lib/listingCache';
import { categoryFor } from '../theme';

// Shared by every screen that shows a grid of ItemCards (Home, Search).
// `scope` namespaces the card refs, since the same listing can be on screen in
// two tabs at once and the reverse animation has to land on the right card.
export default function useOpenListing(navigation, scope) {
  const { cardRefs, expand, release, isBusy, reduceMotion } = useCardTransition();
  const opening = useRef(false);

  const cardKey = (item) => `${scope}:${item.id}`;

  // Callback ref for an ItemCard: lets the transition measure it later.
  const registerCard = (item) => (node) => {
    cardRefs.current[cardKey(item)] = node;
  };

  // Tapping a card: grow a block of the card's color to full screen, push the
  // listing underneath it, then the listing lifts the block and fades in.
  // With "reduce motion" on we skip the grow and go straight to the listing.
  async function openListing(item) {
    // Ignore taps while another card is still growing or shrinking home. The
    // shared overlay can only run one transition at a time, and starting a new
    // grow mid-shrink makes it jump.
    if (opening.current || isBusy()) return;
    opening.current = true;
    // `preview` is the search result we already have, so the listing screen can
    // show content instantly instead of waiting on the network.
    const params = { listingId: item.id, category: item.category, preview: item, cardKey: cardKey(item) };
    // Start loading the full listing now; it finishes while the card is growing.
    prefetchListing(item.id);
    try {
      if (!reduceMotion) {
        await expand(cardKey(item), categoryFor(item.category).color);
      }
      navigation.navigate('ListingDetail', params);
      // The listing screen lifts the overlay itself once it has painted; this
      // is only a safety net in case it never does.
      setTimeout(release, 1500);
    } finally {
      opening.current = false;
    }
  }

  return { openListing, registerCard };
}
