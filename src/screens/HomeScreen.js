import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
} from 'react-native';
import { api } from '../lib/api';

export default function HomeScreen({ navigation }) {
  const [listings, setListings] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // useCallback keeps the same function between renders unless `search` changes,
  // so the useEffect below only re-runs when the search text actually changes.
  const loadListings = useCallback(async () => {
    try {
      const { data } = await api.get('/search/listings', {
        params: { q: search.trim() || undefined },
      });
      setListings(data.results);
    } catch (e) {
      console.warn('Search failed:', e.response?.data?.detail || e.message);
    }
  }, [search]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  async function onRefresh() {
    setRefreshing(true);
    await loadListings();
    setRefreshing(false);
  }

  function renderItem({ item }) {
    const photo = item.photo_url;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardPrice}>${(item.price_cents / 100).toFixed(2)}</Text>
        {item.listing_type === 'handmade' && (
          <Text style={styles.handmadeBadge}>Handmade</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search listings..."
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={loadListings}
      />
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>No listings yet on your campus. Be the first to sell something!</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 12 },
  search: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
  },
  list: { paddingHorizontal: 8, paddingBottom: 24 },
  card: { flex: 1, margin: 8, maxWidth: '46%' },
  image: { width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: '#eee' },
  imagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cardTitle: { marginTop: 6, fontSize: 14, fontWeight: '600' },
  cardPrice: { fontSize: 13, color: '#444' },
  handmadeBadge: {
    marginTop: 2,
    fontSize: 11,
    color: '#fff',
    backgroundColor: '#2f9e44',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  empty: { textAlign: 'center', marginTop: 60, color: '#888', paddingHorizontal: 40 },
});
