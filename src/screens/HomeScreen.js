import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import useOpenListing from '../hooks/useOpenListing';
import { colors, space, type } from '../theme';
import { Headline, ItemCard } from '../components';

export default function HomeScreen({ navigation }) {
  const [listings, setListings] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { openListing, registerCard } = useOpenListing(navigation, 'home');

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

  // FlatList calls renderItem once per row of `listings`. numColumns={2} lays
  // the cards out in a two-column grid; each card just fills its column.
  function renderItem({ item }) {
    return (
      <View style={styles.cell}>
        <ItemCard
          title={item.title}
          priceCents={item.price_cents}
          category={item.category}
          imageUri={item.photo_url}
          sold={item.status === 'sold'}
          innerRef={registerCard(item)}
          onPress={() => openListing(item)}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Headline plain="Pre-loved," italic="right on campus" />
            <TextInput
              style={styles.search}
              placeholder="Search your campus"
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={loadListings}
              returnKeyType="search"
            />
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Nothing here yet. List your first piece.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { paddingTop: space.lg, paddingBottom: space.lg, gap: space.xxl },
  search: {
    ...type.body,
    color: colors.ink,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: space.xl,
  },
  // Bottom padding keeps the last row clear of the floating nav bar.
  list: { paddingHorizontal: space.xl - space.sm / 2, paddingBottom: 112 },
  cell: { flex: 1 / 2, padding: space.sm / 2 },
  empty: { ...type.body, textAlign: 'center', marginTop: 60, color: colors.inkSoft, paddingHorizontal: 40 },
});
