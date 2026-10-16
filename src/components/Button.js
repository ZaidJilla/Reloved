import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, motion, radius, type } from '../theme';

// Primary = ink pill (one per screen). Secondary = white pill with a line border.
export default function Button({ label, onPress, variant = 'primary', disabled, style }) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        disabled && { opacity: 0.5 },
        { transform: [{ scale: pressed ? motion.pressScale : 1 }] },
        style,
      ]}
    >
      <Text style={[type.bodyMedium, { color: primary ? colors.white : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.ink },
  secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
});
