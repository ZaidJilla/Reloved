import React from 'react';
import { Text } from 'react-native';
import { colors, fonts, type } from '../theme';

// Two-part headline: plain, then italic. Custom fonts can't use fontStyle: 'italic',
// so the italic half is a nested Text that swaps to the italic font file.
export default function Headline({ plain, italic, size = 'display', style }) {
  return (
    <Text style={[type[size], { color: colors.ink }, style]}>
      {plain}
      {italic ? <Text style={{ fontFamily: fonts.displayItalic }}> {italic}</Text> : null}
    </Text>
  );
}
