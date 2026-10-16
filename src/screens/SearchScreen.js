import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, Keyboard, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import useOpenListing from '../hooks/useOpenListing';
import { colors, space, type } from '../theme';
import { Headline, ItemCard, Pill, SearchBar } from '../components';

// Values must match what sellers type for `category` (the backend matches exactly).
const CATEGORIES = ['Tops', 'Jackets', 'Bottoms', 'Shoes', 'Accessories'];
const TYPES = [
  { value: 'resale', label: 'Resale' },
  { value: 'handmade', label: 'Handmade' },
];

// New result cards fade and rise in, lightly staggered. Only the first few are
// staggered so a long list doesn't take forever to finish appearing.
function FadeInCell({ index, style, children }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      delay: Math.min(index, 8) * 35,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progress, index]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null); // one category at a time, or null for all
  const [listingType, setListingType] = useState(null);
  const [results, setResults] = useState([]);
  const [version, setVersion] = useState(0); // bumps on each new result set so cards re-run their entrance
  const [searched, setSearched] = useState(false);
  const { openListing, registerCard } = useOpenListing(navigation, 'search');

  // While a search is in flight the old results dim a little, so a tap gets
  // instant feedback instead of nothing happening until the network answers.
  const dim = useRef(new Animated.Value(1)).current;
  const fadeTo = (toValue, duration) =>
    Animated.timing(dim, { toValue, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();

  // Guards against a slow earlier request landing after a newer one.
  const latestRequest = useRef(0);

  const runSearch = useCallback(async () => {
    const requestId = ++latestRequest.current;
    fadeTo(0.45, 100);
    try {
      const { data } = await api.get('/search/listings', {
        params: {
          q: query.trim() || undefined,
          category: category || undefined,
          listing_type: listingType || undefined,
        },
      });
      if (requestId !== latestRequest.current) return;
      // New cards bring their own fade-and-rise, so snap the dim back to full
      // instead of easing it (the two opacities would multiply and feel slow).
      dim.setValue(1);
      setResults(data.results);
      setVersion((v) => v + 1);
      setSearched(true);
    } catch (e) {
      console.warn('Search failed:', e.response?.data?.detail || e.message);
      // No new cards to fade in, so ease the old ones back up.
      if (requestId === latestRequest.current) fadeTo(1, 180);
    }
  }, [query, category, listingType]);

  // Typing is debounced (300ms, so we don't fire on every keystroke), but a
  // filter tap searches right away.
  const lastQuery = useRef(query);
  useEffect(() => {
    const typing = query !== lastQuery.current;
    lastQuery.current = query;
    const timer = setTimeout(runSearch, typing ? 300 : 0);
    return () => clearTimeout(timer);
  }, [runSearch]);

  function renderItem({ item, index }) {
    return (
      <Animated.View style={[styles.cell, { opacity: dim }]}>
        <FadeInCell index={index}>
          <ItemCard
            title={item.title}
            priceCents={item.price_cents}
            category={item.category}
            imageUri={item.photo_url}
            sold={item.status === 'sold'}
            innerRef={registerCard(item)}
            onPress={() => openListing(item)}
          />
        </FadeInCell>
      </Animated.View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={results}
        keyExtractor={(item) => `${version}:${item.id}`}
        renderItem={renderItem}
        numColumns={2}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Headline plain="Find" italic="your thing" />
            <SearchBar placeholder="Search your campus" value={query} onChangeText={setQuery} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
              {TYPES.map((t) => (
                <Pill
                  key={t.value}
                  label={t.label}
                  selected={listingType === t.value}
                  onPress={() => setListingType(listingType === t.value ? null : t.value)}
                />
              ))}
              {CATEGORIES.map((c) => (
                <Pill
                  key={c}
                  label={c}
                  selected={category === c}
                  onPress={() => setCategory(category === c ? null : c)}
                />
              ))}
            </ScrollView>
            {searched ? (
              <Text style={styles.count}>
                {results.length} {results.length === 1 ? 'result' : 'results'}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          searched ? <Text style={styles.empty}>Nothing matches. Try fewer filters.</Text> : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { paddingTop: space.lg, paddingBottom: space.md, gap: space.lg, paddingHorizontal: space.sm / 2 },
  pills: { gap: space.sm, paddingVertical: 6 },
  count: { ...type.caption, color: colors.muted },
  // Bottom padding keeps the last row clear of the floating nav bar.
  list: { paddingHorizontal: space.xl - space.sm / 2, paddingBottom: 112 },
  cell: { flex: 1 / 2, padding: space.sm / 2 },
  empty: { ...type.body, textAlign: 'center', marginTop: 60, color: colors.inkSoft, paddingHorizontal: 40 },
});
