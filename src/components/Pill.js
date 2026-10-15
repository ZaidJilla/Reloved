import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, type } from '../theme';

// Default = white with a line border. Selected = ink with white text.
// hitSlop keeps the tap target at 44 tall even though the pill is 32.
export default function Pill({ label, selected, onPress, style }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.base, selected ? styles.selected : styles.idle, style]}
    >
      <Text style={[type.caption, { color: selected ? colors.white : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  idle: { backgroundColor: colors.white, borderColor: colors.line },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
});
