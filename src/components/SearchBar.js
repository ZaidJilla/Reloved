import React from 'react';
import { TextInput, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from '../theme';

// White pill with a line border, search icon on the left. 48 tall.
export default function SearchBar({ style, ...props }) {
  return (
    <View style={[styles.bar, style]}>
      <Ionicons name="search" size={20} color={colors.muted} />
      <TextInput
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: space.lg,
  },
  input: { ...type.body, flex: 1, color: colors.ink, height: '100%' },
});
