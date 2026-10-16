// Single source of truth for Reloved's look. Import from here; never type a hex in a component.
// See "Reloved style guide" for the rules behind these tokens.

export const colors = {
  cream: '#FBF6EC',
  white: '#FFFFFF',
  sand: '#EFE7D8',
  line: '#E3DBCB',
  inkSoft: '#6B665C',
  muted: '#8A8478',
  ink: '#1C1B19',
  onInkMuted: '#B5AFA4',
  photoWash: 'rgba(255,255,255,0.45)',
  danger: '#B3372B',
};

export const categories = {
  tops: { label: 'Tops', color: '#F3A6C4', tint: '#FBE1EB', shape: 'scallop' },
  outerwear: { label: 'Outerwear', color: '#F5D46B', tint: '#FBE9A8', shape: 'square' },
  shoes: { label: 'Shoes', color: '#B9C8EE', tint: '#E2E8F8', shape: 'circle' },
  deals: { label: 'Deals', color: '#C5DB7A', tint: '#E6EFC4', shape: 'leaf' },
};

// Listings store category as free text, so match loosely. Unknown text gets
// neutral sand rather than borrowing a category color.
const CATEGORY_KEYWORDS = {
  tops: ['top', 'shirt', 'tee', 't-shirt', 'sweater', 'hoodie', 'blouse', 'tank', 'dress', 'knit'],
  outerwear: ['jacket', 'coat', 'outer', 'parka', 'vest', 'fleece', 'puffer'],
  shoes: ['shoe', 'sneaker', 'boot', 'loafer', 'sandal', 'heel', 'cleat'],
  deals: ['deal', 'bundle', 'free'],
};

export function categoryFor(text) {
  const t = (text || '').toLowerCase();
  for (const key of Object.keys(CATEGORY_KEYWORDS)) {
    if (CATEGORY_KEYWORDS[key].some((word) => t.includes(word))) {
      return { key, ...categories[key] };
    }
  }
  return { key: null, label: text || '', color: colors.sand, tint: colors.sand, shape: 'square' };
}

export const fonts = {
  display: 'Fraunces_400Regular',
  displayItalic: 'Fraunces_400Regular_Italic',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
};

export const type = {
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 40, letterSpacing: -1.2 },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 34, letterSpacing: -0.8 },
  section: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  priceL: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  priceS: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17 },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const radius = { pill: 999, hero: 28, card: 24, row: 20, inner: 16 };

export const motion = {
  expandMs: 520,
  expandCurve: [0.2, 0.85, 0.25, 1],
  contentDelayMs: 260,
  contentFadeMs: 200,
  pressScale: 0.97,
};

// React Navigation theme so headers/backgrounds default to cream instead of white.
export const navTheme = {
  dark: false,
  colors: {
    primary: colors.ink,
    background: colors.cream,
    card: colors.cream,
    text: colors.ink,
    border: colors.line,
    notification: colors.ink,
  },
};

// Shared options for stack headers: cream, no shadow, DM Sans title.
export const stackHeaderOptions = {
  headerStyle: { backgroundColor: colors.cream },
  headerShadowVisible: false,
  headerTintColor: colors.ink,
  headerTitleStyle: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  contentStyle: { backgroundColor: colors.cream },
};
