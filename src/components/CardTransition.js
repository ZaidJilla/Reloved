import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import { motion, radius } from '../theme';

// The "card expand" moment from the style guide: tapping an ItemCard grows a
// block of the card's color from its spot in the grid to fill the screen, then
// the listing screen takes over. Going back reverses it.
//
// This uses the manual-overlay approach: one absolutely positioned View that
// lives above the whole navigator (so it can cover the tab bar and header too),
// animated with the core Animated API. Layout props can't use the native driver,
// but it's a single View for 450ms so that's fine.

const CardTransitionContext = createContext(null);

export function useCardTransition() {
  return useContext(CardTransitionContext);
}

const EXPAND_EASING = Easing.bezier(...motion.expandCurve);

export function CardTransitionProvider({ children }) {
  const { width, height } = useWindowDimensions();
  const [color, setColor] = useState(null); // overlay is mounted while this is set
  const [reduceMotion, setReduceMotion] = useState(false);

  // Animated values for the overlay's frame.
  const left = useRef(new Animated.Value(0)).current;
  const top = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const h = useRef(new Animated.Value(0)).current;
  const corner = useRef(new Animated.Value(radius.card)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Cards register their refs here (by listing id) so we can measure where a
  // card is *right now*, even if the list has scrolled since it was tapped.
  const cardRefs = useRef({});

  // 'idle' | 'expanding' | 'holding' (full screen, waiting for the listing) | 'collapsing'.
  // release() only acts while holding, so a late safety call can't cut a collapse short.
  const phase = useRef('idle');

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const measureCard = useCallback(
    (id) =>
      new Promise((resolve) => {
        const node = cardRefs.current[id];
        if (!node?.measureInWindow) return resolve(null);
        node.measureInWindow((x, y, rw, rh) => resolve(rw > 0 && rh > 0 ? { x, y, width: rw, height: rh } : null));
      }),
    []
  );

  const setFrame = useCallback(
    (rect, cornerRadius) => {
      left.setValue(rect.x);
      top.setValue(rect.y);
      w.setValue(rect.width);
      h.setValue(rect.height);
      corner.setValue(cornerRadius);
      opacity.setValue(1);
    },
    [left, top, w, h, corner, opacity]
  );

  const animateFrame = useCallback(
    (rect, cornerRadius) =>
      new Promise((resolve) => {
        const to = (value, toValue) =>
          Animated.timing(value, {
            toValue,
            duration: motion.expandMs,
            easing: EXPAND_EASING,
            useNativeDriver: false,
          });
        Animated.parallel([
          to(left, rect.x),
          to(top, rect.y),
          to(w, rect.width),
          to(h, rect.height),
          to(corner, cornerRadius),
        ]).start(() => resolve());
      }),
    [left, top, w, h, corner]
  );

  const fullScreen = useMemo(() => ({ x: 0, y: 0, width, height }), [width, height]);

  // Card -> full screen. Resolves once the overlay has landed.
  const expand = useCallback(
    async (id, overlayColor) => {
      const rect = await measureCard(id);
      if (!rect) return;
      phase.current = 'expanding';
      setFrame(rect, radius.card);
      setColor(overlayColor);
      await animateFrame(fullScreen, radius.hero);
      phase.current = 'holding';
    },
    [measureCard, setFrame, animateFrame, fullScreen]
  );

  // Removes the overlay. Call a beat after the listing screen has mounted so
  // there's no flash between the two.
  const release = useCallback(() => {
    if (phase.current !== 'holding') return;
    phase.current = 'idle';
    setColor(null);
  }, []);

  // Full screen -> back home to the card. Shows the overlay full-screen at once,
  // runs `beforeShrink` (which pops the listing screen underneath), then shrinks.
  const collapse = useCallback(
    async (id, overlayColor, beforeShrink) => {
      phase.current = 'collapsing';
      setFrame(fullScreen, radius.hero);
      setColor(overlayColor);
      // Let the full-screen overlay paint before we reveal the grid under it.
      await new Promise((r) => requestAnimationFrame(() => r()));
      beforeShrink?.();
      await new Promise((r) => setTimeout(r, 50)); // give Home a moment to lay out
      const rect = await measureCard(id);
      if (rect) {
        await animateFrame(rect, radius.card);
      } else {
        await new Promise((r) =>
          Animated.timing(opacity, { toValue: 0, duration: motion.contentFadeMs, useNativeDriver: false }).start(() => r())
        );
      }
      phase.current = 'idle';
      setColor(null);
    },
    [fullScreen, setFrame, measureCard, animateFrame, opacity]
  );

  const value = useMemo(
    () => ({ cardRefs, expand, collapse, release, reduceMotion }),
    [expand, collapse, release, reduceMotion]
  );

  return (
    <CardTransitionContext.Provider value={value}>
      {children}
      {color ? (
        <Animated.View
          pointerEvents="auto" // swallow taps while the transition runs
          style={[
            styles.overlay,
            { backgroundColor: color, left, top, width: w, height: h, borderRadius: corner, opacity },
          ]}
        />
      ) : null}
    </CardTransitionContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', zIndex: 100, elevation: 100 },
});
