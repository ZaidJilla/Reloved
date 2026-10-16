import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { categoryFor, colors, motion, radius, space, type } from '../theme';

// Card takes its color from the item's category. Photo sits in a radius-16 frame
// with a white wash behind it while the image loads.
export default function ItemCard({ title, priceCents, category, imageUri, sold, onPress, style, innerRef }) {
  const cat = categoryFor(category);
  const price = Math.round(priceCents / 100);
  return (
    <Pressable
      ref={innerRef}
      collapsable={false}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, $${price}${sold ? ', sold' : ''}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: cat.color, transform: [{ scale: pressed ? motion.pressScale : 1 }] },
        style,
      ]}
    >
      <View style={styles.photo}>
        {imageUri ? <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} /> : null}
        {sold && (
          <View style={styles.sold}>
            <Text style={[type.caption, { color: colors.white }]}>Sold</Text>
          </View>
        )}
      </View>
      <View style={styles.metaRow}>
        <Text style={[type.caption, styles.name]} numberOfLines={1}>{title}</Text>
        <Text style={[type.priceS, { color: colors.ink }]}>${price}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: 10, gap: space.sm },
  photo: {
    borderRadius: radius.inner,
    backgroundColor: colors.photoWash,
    aspectRatio: 1,
    overflow: 'hidden',
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.xs },
  name: { color: colors.ink, flex: 1 },
  sold: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
});
