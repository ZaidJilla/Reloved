import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { colors, radius, type } from '../theme';

// White, radius-20 row used for every text field. Pass multiline for tall fields.
export default function FormInput({ style, multiline, ...props }) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      multiline={multiline}
      style={[styles.input, multiline && styles.multiline, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    ...type.body,
    color: colors.ink,
    backgroundColor: colors.white,
    borderRadius: radius.row,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    minHeight: 48,
  },
  multiline: { height: 96, textAlignVertical: 'top' },
});
