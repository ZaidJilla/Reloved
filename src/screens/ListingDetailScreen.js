import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { categoryFor, colors, radius, space, type } from '../theme';
import { Headline, Button } from '../components';

export default function ListingDetailScreen({ route, navigation }) {
  const { listingId } = route.params;
  const [listing, setListing] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    load();
  }, [listingId]);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    setCurrentUserId(userData?.user?.id);

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
      navigation.goBack();
    }
  }

  if (!listing) {
    return <View style={styles.container} />;
  }

  const isOwner = currentUserId === listing.seller_id;
  const cat = categoryFor(listing.category);
  // Title is plain words plus an italic last word, per the style guide.
  const words = listing.title.trim().split(/\s+/);
  const italicWord = words.length > 1 ? words.pop() : null;
  const plainTitle = words.join(' ');

  return (
    // Listing is the one full-color screen: it uses the item's category color.
    <ScrollView
      style={[styles.container, { backgroundColor: cat.color }]}
      contentContainerStyle={styles.content}
    >
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
        <Text style={styles.seller}>Sold by {listing.profiles?.full_name}</Text>
        <Text style={styles.description}>{listing.description}</Text>
        <Text style={styles.meta}>
          {[listing.category, listing.size && `Size ${listing.size}`, listing.condition]
            .filter(Boolean)
            .join(' · ')}
        </Text>

        {isOwner ? (
          listing.status === 'active' && <Button label="Mark as sold" onPress={markSold} style={styles.cta} />
        ) : (
          <Button label="Message" onPress={messageSeller} style={styles.cta} />
        )}
      </View>
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
  seller: { ...type.bodyMedium, color: colors.ink, marginTop: space.lg },
  description: { ...type.body, color: colors.ink, marginTop: space.md },
  meta: { ...type.caption, color: colors.ink, marginTop: space.md },
  cta: { marginTop: space.xxl },
});
