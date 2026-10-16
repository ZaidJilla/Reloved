import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Alert, Animated, Easing, Pressable, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { clearPrefetched, getPrefetched } from '../lib/listingCache';
import { categoryFor, colors, motion, radius, space, type } from '../theme';
import { Headline, Button, useCardTransition } from '../components';

export default function ListingDetailScreen({ route, navigation }) {
  const { listingId, preview, cardKey } = route.params;
  // Start from the search result passed in by Home so there's something to show
  // immediately; load() then fills in the rest (seller name, all photos).
  // If Home's prefetch already finished (it runs during the expand animation),
  // use the complete listing so the first frame has everything, seller included.
  const prefetched = useRef(getPrefetched(listingId)).current;
  const [listing, setListing] = useState(
    prefetched?.listing ??
      (preview
        ? { ...preview, listing_photos: preview.photo_url ? [{ photo_url: preview.photo_url }] : [], profiles: null }
        : null)
  );
  const [currentUserId, setCurrentUserId] = useState(prefetched?.userId ?? null);
  const { collapse, release, reduceMotion } = useCardTransition();

  // Category comes from the tapped card, so the screen is the right color before
  // the listing has even loaded. That's what makes it feel like the card grew.
  const cat = categoryFor(listing?.category ?? route.params.category);

  // Listing content fades in once the expanding card has landed. We wait until
  // this screen has laid out and painted a frame before lifting the overlay, so
  // there's never a flash of whatever is underneath.
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const leaving = useRef(false);
  const revealed = useRef(false);
  const [overlayLifted, setOverlayLifted] = useState(false);

  function onFirstLayout() {
    if (revealed.current) return;
    revealed.current = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        release();
        setOverlayLifted(true);
      })
    );
  }

  // The fade needs both things: the overlay gone AND the listing loaded.
  // Otherwise it plays over a blank screen and the text just pops in.
  useEffect(() => {
    if (!overlayLifted || !listing) return;
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: motion.contentFadeMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [overlayLifted, listing, contentOpacity]);

  // Going back reverses the expand: content fades out (150ms), then the color
  // block shrinks home to the card. With "reduce motion" on we just go back.
  const playBack = useCallback(
    (pop) => {
      if (leaving.current) return;
      leaving.current = true;
      Animated.timing(contentOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        collapse(cardKey ?? listingId, cat.color, pop);
      });
    },
    [collapse, cardKey, listingId, cat.color, contentOpacity]
  );

  // One entry point for every way of leaving, so the pop is never cancelled
  // (native-stack can't cleanly cancel a pop once it has started).
  const goBackAnimated = useCallback(() => {
    if (reduceMotion) navigation.goBack();
    else playBack(() => navigation.goBack());
  }, [reduceMotion, navigation, playBack]);

  // Android hardware back: consume the press and play the reverse ourselves.
  // useFocusEffect so it's only active while this screen is the one showing.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBackAnimated();
        return true;
      });
      return () => sub.remove();
    }, [goBackAnimated])
  );

  // The header back button is custom on purpose. The native one starts popping
  // the screen itself, so intercepting it flashes the grid before the animation.
  // Ours plays the reverse first and only then pops.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={goBackAnimated}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </Pressable>
      ),
    });
  }, [navigation, goBackAnimated]);

  useEffect(() => {
    load();
    return () => clearPrefetched(listingId);
  }, [listingId]);

  async function load() {
    // getSession reads the saved session locally; getUser would hit the network.
    supabase.auth.getSession().then(({ data }) => setCurrentUserId(data?.session?.user?.id));

    const { data, error } = await supabase
      .from('listings')
      .select('*, listing_photos(photo_url), profiles!listings_seller_id_fkey(full_name)')
      .eq('id', listingId)
      .single();

    if (!error) setListing(data);
  }

  async function messageSeller() {
    if (!listing || !currentUserId) return;
    if (listing.seller_id === currentUserId) {
      Alert.alert("That's your listing", "You can't message yourself about your own item.");
      return;
    }

    // Find or create the conversation for this listing + buyer.
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('listing_id', listingId)
      .eq('buyer_id', currentUserId)
      .maybeSingle();

    let conversationId = existing?.id;

    if (!conversationId) {
      const { data: created, error } = await supabase
        .from('conversations')
        .insert({ listing_id: listingId, buyer_id: currentUserId, seller_id: listing.seller_id })
        .select('id')
        .single();
      if (error) {
        Alert.alert('Could not start conversation', error.message);
        return;
      }
      conversationId = created.id;
    }

    navigation.getParent()?.navigate('MessagesTab', {
      screen: 'Chat',
      params: { conversationId, listingTitle: listing.title },
    });
  }

  async function markSold() {
    const { error } = await supabase
      .from('listings')
      .update({ status: 'sold' })
      .eq('id', listingId);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Marked as sold');
      goBackAnimated();
    }
  }

  if (!listing) {
    return <View style={[styles.container, { backgroundColor: cat.color }]} onLayout={onFirstLayout} />;
  }

  const isOwner = currentUserId === listing.seller_id;
  // Title is plain words plus an italic last word, per the style guide.
  const words = listing.title.trim().split(/\s+/);
  const italicWord = words.length > 1 ? words.pop() : null;
  const plainTitle = words.join(' ');

  return (
    // Listing is the one full-color screen: it uses the item's category color.
    <ScrollView
      style={[styles.container, { backgroundColor: cat.color }]}
      onLayout={onFirstLayout}
      contentContainerStyle={styles.content}
    >
      <Animated.View style={{ opacity: contentOpacity }}>
      <View style={[styles.photoFrame, { backgroundColor: cat.tint }]}>
        {listing.listing_photos?.length ? (
          <Image source={{ uri: listing.listing_photos[0].photo_url }} style={styles.image} />
        ) : null}
      </View>

      <View style={styles.body}>
        {plainTitle ? (
          <Headline size="title" plain={plainTitle} italic={italicWord} />
        ) : (
          <Headline size="title" plain={italicWord} />
        )}
        <Text style={[type.priceL, styles.price]}>${(listing.price_cents / 100).toFixed(2)}</Text>
        {listing.listing_type === 'handmade' && (
          <View style={styles.badge}>
            <Text style={[type.caption, { color: colors.white }]}>Handmade by seller</Text>
          </View>
        )}
        <Text style={styles.seller}>
          {listing.profiles?.full_name ? `Sold by ${listing.profiles.full_name}` : ' '}
        </Text>
        <Text style={styles.description}>{listing.description}</Text>
        <Text style={styles.meta}>
          {[listing.category, listing.size && `Size ${listing.size}`, listing.condition]
            .filter(Boolean)
            .join(' · ')}
        </Text>

        {/* Wait for the user id so owners never see "Message" flip to "Mark as sold". */}
        <View style={styles.ctaSlot}>
          {!currentUserId ? null : isOwner ? (
            listing.status === 'active' && <Button label="Mark as sold" onPress={markSold} />
          ) : (
            <Button label="Message" onPress={messageSeller} />
          )}
        </View>
      </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: space.xxxl },
  photoFrame: {
    height: 340,
    marginHorizontal: space.xl,
    borderRadius: radius.hero,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  body: { padding: space.xl },
  price: { color: colors.ink, marginTop: space.sm },
  badge: {
    marginTop: space.md,
    backgroundColor: colors.ink,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  seller: { ...type.bodyMedium, color: colors.ink, marginTop: space.lg, minHeight: 21 },
  description: { ...type.body, color: colors.ink, marginTop: space.md },
  meta: { ...type.caption, color: colors.ink, marginTop: space.md },
  ctaSlot: { marginTop: space.xxl, minHeight: 56 },
});
