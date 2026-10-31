// @ai-generated
import React, {useEffect, useRef} from 'react';
import {StyleSheet} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {EASE_OUT, FADE_MS, ThemeCrossfade} from './motion';
import {isSwipeLayout, type ReadingLayout} from './readingLayout';

/** How far the new page starts from its place, in points. */
export const ENTRANCE_OFFSET = 36;
export const ENTRANCE_MS = 300;

/**
 * The reader's page area. When the layout changes (from the Reading
 * sheet) the new page fades in from a short way off its place: sideways
 * for the swipe layouts, from below for the scrolling ones. Under Reduce
 * Motion it only fades. A theme change cross-fades it. The first layout
 * shows without motion.
 */
export function ReaderLayoutTransition({
  layout,
  background,
  children,
}: {
  layout: ReadingLayout;
  /** The page's background, faded from when the theme changes. */
  background: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const shown = useRef(layout);
  // 1 is the start of the entrance, 0 the page at rest.
  const entrance = useSharedValue(0);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);

  useEffect(() => {
    if (shown.current === layout) return;
    shown.current = layout;
    const sideways = isSwipeLayout(layout);
    // The mushaf turns its pages toward the right in any app language, so
    // the next page comes from the left.
    offsetX.value = reduceMotion || !sideways ? 0 : -ENTRANCE_OFFSET;
    offsetY.value = reduceMotion || sideways ? 0 : ENTRANCE_OFFSET;
    entrance.value = 1;
    entrance.value = withTiming(0, {
      duration: reduceMotion ? FADE_MS : ENTRANCE_MS,
      easing: EASE_OUT,
    });
  }, [layout, reduceMotion, entrance, offsetX, offsetY]);

  const animated = useAnimatedStyle(() => ({
    opacity: 1 - entrance.value,
    transform: [
      {translateX: offsetX.value * entrance.value},
      {translateY: offsetY.value * entrance.value},
    ],
  }));

  return (
    <Animated.View style={[styles.fill, animated]}>
      {children}
      <ThemeCrossfade color={background} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
