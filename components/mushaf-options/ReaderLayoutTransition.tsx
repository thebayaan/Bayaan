// @ai-generated
import React, {useEffect, useRef} from 'react';
import {StyleSheet, useWindowDimensions} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {EASE_OUT, FADE_MS, ThemeCrossfade} from './motion';
import {isSwipeLayout, type ReadingLayout} from './readingLayout';

const SLIDE_MS = 550;
const RISE_MS = 600;

/**
 * The reader's page area. When the layout changes (from the Reading
 * sheet) the new page slides in: sideways for the swipe layouts, up for
 * the scrolling ones, or fades in under Reduce Motion. A theme change
 * cross-fades it. The first layout shows without motion.
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
  const {width, height} = useWindowDimensions();
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
    // the next page comes in from the left.
    offsetX.value = reduceMotion || !sideways ? 0 : -1.1 * width;
    offsetY.value = reduceMotion || sideways ? 0 : 0.6 * height;
    entrance.value = 1;
    entrance.value = withTiming(0, {
      duration: reduceMotion ? FADE_MS : sideways ? SLIDE_MS : RISE_MS,
      easing: EASE_OUT,
    });
  }, [layout, reduceMotion, width, height, entrance, offsetX, offsetY]);

  const animated = useAnimatedStyle(() => ({
    // A sideways slide keeps the page opaque; rising and Reduce Motion fade.
    opacity: offsetX.value !== 0 ? 1 : 1 - entrance.value,
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
