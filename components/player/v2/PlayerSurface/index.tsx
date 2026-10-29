// @ai-generated
import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {Platform, StyleSheet, useWindowDimensions} from 'react-native';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {Gesture} from 'react-native-gesture-handler';
import {GlassView} from 'expo-glass-effect';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {FrostedView} from '@/components/FrostedView';
import {
  measureMiniPlayerAnchor,
  registerPlayerSheetController,
  unregisterPlayerSheetController,
  type PlayerOrigin,
  type PlayerSheetController,
} from '@/services/player/sheetRef';
import {PlayerBody} from '../PlayerBody';
import {createSurfaceScrollable, type SurfaceMotion} from './SurfaceScrollable';
import {
  PlayerDismissProvider,
  type PlayerDismissApi,
} from '../PlayerDismissContext';

/**
 * Corner radius the surface takes while it is in motion or being dragged. It
 * eases to 0 as the surface settles full screen, so an open player is a plain
 * full-screen view and the physical screen corners do the rounding: nothing
 * can show around the corners whatever the device's real radius is.
 */
const SCREEN_CORNER_RADIUS = Platform.select({ios: 44, default: 32});

// Critically damped, no overshoot: an overshoot past full screen would
// briefly pull the corners off the screen edges.
const SPRING = {
  damping: 30,
  stiffness: 280,
  mass: 1,
  overshootClamping: true,
} as const;

const REDUCED_MOTION_DURATION = 200;

// On release, progress is projected this many seconds ahead at the finger's
// velocity; past halfway it opens, otherwise it closes. A flick decides on
// its own, a slow drag by how far it went.
const RELEASE_PROJECTION_S = 0.2;
const BACKDROP_OPACITY = 0.5;

/**
 * The full player as one always-mounted surface that morphs out of the mini
 * player (iOS bottom accessory, Android pill, tablet dock) and back onto it.
 * The surface starts exactly over the mini player's rect, with a transparent
 * background that fades in as it grows, so the mini player underneath is
 * covered for the whole open and close and needs no hiding of its own.
 */
export const PlayerSurface = () => {
  const {theme} = useTheme();
  const glassColorScheme = useGlassColorScheme();
  const {width: screenWidth, height: screenHeight} = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const {setSheetMode, setImmersive} = usePlayerActions();
  const sheetMode = usePlayerStore(s => s.sheetMode);

  const progress = useSharedValue(0);
  const dragStartProgress = useSharedValue(0);
  // Where the player is heading, and a token for the latest open/close/drag
  // request, kept on the JS thread: a shared value written on JS isn't
  // readable back on JS right away, so it can't guard the async measurement.
  // The token lets a stale measurement give way to a newer request, and the
  // heading keeps a sheetMode change from restarting (and dropping the
  // velocity of) an animation a gesture already started.
  const headingRef = useRef<0 | 1>(0);
  const requestRef = useRef(0);
  const origin = useSharedValue<PlayerOrigin | null>(null);
  // False while a swipe-up from the mini player waits for its measurement.
  const originReady = useSharedValue(true);
  const screen = useSharedValue({width: screenWidth, height: screenHeight});
  // Read in worklets as a shared value, so toggling Reduce Motion doesn't
  // rebuild the gestures and the lists' scroll component (a remount).
  const reduceMotion = useSharedValue(reducedMotion);

  useEffect(() => {
    reduceMotion.value = reducedMotion;
  }, [reduceMotion, reducedMotion]);

  useEffect(() => {
    screen.value = {width: screenWidth, height: screenHeight};
  }, [screen, screenWidth, screenHeight]);

  const settle = useCallback(
    (to: 0 | 1, velocity: number) => {
      'worklet';
      progress.value = reduceMotion.value
        ? withTiming(to, {duration: REDUCED_MOTION_DURATION})
        : withSpring(to, {...SPRING, velocity});
    },
    [reduceMotion, progress],
  );

  const open = useCallback(
    (from?: PlayerOrigin) => {
      if (headingRef.current === 1) return;
      headingRef.current = 1;
      const request = ++requestRef.current;
      const start = (o?: PlayerOrigin) => {
        // A close or drag may have taken over while measuring.
        if (requestRef.current !== request) return;
        origin.value = o ?? null;
        settle(1, 0);
      };
      if (from) start(from);
      else measureMiniPlayerAnchor(start);
    },
    [origin, settle],
  );

  const close = useCallback(() => {
    if (headingRef.current === 0) return;
    headingRef.current = 0;
    const request = ++requestRef.current;
    // Re-measure: the mini player may have moved while the player was open
    // (e.g. the iOS accessory switching between its two placements).
    measureMiniPlayerAnchor(o => {
      // A reopen or drag (e.g. a swipe up) may have taken over meanwhile.
      if (requestRef.current !== request) return;
      if (o) origin.value = o;
      settle(0, 0);
    });
  }, [origin, settle]);

  useEffect(() => {
    if (sheetMode === 'full') {
      open();
    } else {
      setImmersive(false);
      close();
    }
  }, [sheetMode, open, close, setImmersive]);

  const beginDrag = useCallback(() => {
    requestRef.current++;
  }, []);

  const syncSheetMode = useCallback(
    (to: 0 | 1) => {
      headingRef.current = to;
      const mode = to === 1 ? 'full' : 'hidden';
      if (usePlayerStore.getState().sheetMode !== mode) setSheetMode(mode);
    },
    [setSheetMode],
  );

  // A drag drives the morph itself: the top edge follows the finger while
  // the sides and the bottom close in on the mini player (and the reverse
  // on a swipe up), so the card always shrinks toward where it will land.
  const openDistance = useCallback(() => {
    'worklet';
    return Math.max(origin.value?.y ?? screen.value.height, 1);
  }, [origin, screen]);

  const onDragStart = useCallback(() => {
    'worklet';
    cancelAnimation(progress);
    // The finger owns progress now; a pending open or close measurement
    // must not settle it. The release settles to 0 or 1.
    runOnJS(beginDrag)();
    dragStartProgress.value = progress.value;
  }, [progress, dragStartProgress, beginDrag]);

  const onDragUpdate = useCallback(
    (translationY: number) => {
      'worklet';
      if (!originReady.value) return;
      const next = dragStartProgress.value - translationY / openDistance();
      progress.value = Math.min(1, Math.max(0, next));
    },
    [originReady, dragStartProgress, openDistance, progress],
  );

  const onDragEnd = useCallback(
    (velocityY: number) => {
      'worklet';
      // Progress is in units of the open distance; carry the finger's
      // velocity into the spring so a flick finishes naturally.
      const velocity = -velocityY / openDistance();
      const projected = progress.value + velocity * RELEASE_PROJECTION_S;
      const to = projected > 0.5 ? 1 : 0;
      settle(to, velocity);
      runOnJS(syncSheetMode)(to);
    },
    [openDistance, progress, settle, syncSheetMode],
  );

  const motion = useMemo<SurfaceMotion>(
    () => ({progress, onDragStart, onDragUpdate, onDragEnd}),
    [progress, onDragStart, onDragUpdate, onDragEnd],
  );

  const renderScrollComponent = useMemo(
    () => createSurfaceScrollable(motion),
    [motion],
  );

  const createDismissGesture = useCallback(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .failOffsetX([-20, 20])
        .onStart(motion.onDragStart)
        .onUpdate(e => motion.onDragUpdate(e.translationY))
        .onEnd(e => motion.onDragEnd(e.velocityY))
        .shouldCancelWhenOutside(false),
    [motion],
  );

  const measureOriginForDrag = useCallback(() => {
    measureMiniPlayerAnchor(o => {
      if (o) origin.value = o;
      originReady.value = true;
    });
  }, [origin, originReady]);

  // Swipe up on the mini player: the morph follows the finger from the
  // mini player's rect, measured as the touch lands.
  const createOpenGesture = useCallback(
    () =>
      Gesture.Pan()
        .activeOffsetY(-10)
        .failOffsetY(10)
        .failOffsetX([-20, 20])
        .onBegin(() => {
          originReady.value = false;
          runOnJS(measureOriginForDrag)();
        })
        .onStart(motion.onDragStart)
        .onUpdate(e => motion.onDragUpdate(e.translationY))
        .onEnd(e => motion.onDragEnd(e.velocityY))
        .onFinalize(() => {
          originReady.value = true;
        })
        .shouldCancelWhenOutside(false),
    [motion, originReady, measureOriginForDrag],
  );

  useEffect(() => {
    const controller: PlayerSheetController = {
      expand: open,
      close,
      createOpenGesture,
    };
    registerPlayerSheetController(controller);
    return () => unregisterPlayerSheetController(controller);
  }, [open, close, createOpenGesture]);

  const dismissApi = useMemo<PlayerDismissApi>(
    () => ({createDismissGesture, renderScrollComponent}),
    [createDismissGesture, renderScrollComponent],
  );

  // At rest the surface is parked below the screen, fully opaque and at scale
  // 1, rather than hidden with opacity. GlassView installs its effect once,
  // the first time it and its ancestors are visible; installed mid-morph
  // (faded, scaled down) the header and controls cards lose their glass shape.
  const frameStyle = useAnimatedStyle(() => {
    const {width: w, height: h} = screen.value;
    const p = progress.value;
    if (p === 0) {
      return {
        width: w,
        height: h,
        borderRadius: 0,
        opacity: 1,
        transform: [{translateX: 0}, {translateY: h * 2}],
      };
    }
    if (reducedMotion) {
      return {
        width: w,
        height: h,
        borderRadius: 0,
        opacity: p,
        transform: [{translateX: 0}, {translateY: 0}],
      };
    }
    const o = origin.value ?? fallbackOrigin(w, h);
    return {
      width: interpolate(p, [0, 1], [o.width, w]),
      height: interpolate(p, [0, 1], [o.height, h]),
      borderRadius: interpolate(
        p,
        [0, 0.9, 1],
        [o.radius, SCREEN_CORNER_RADIUS, 0],
      ),
      opacity: 1,
      transform: [
        {translateX: interpolate(p, [0, 1], [o.x, 0])},
        {translateY: interpolate(p, [0, 1], [o.y, 0])},
      ],
    };
  });

  // Uniform scale so the full-size content grows with the frame instead of
  // being revealed by it; it is laid out once at screen size and never relaid
  // out during the morph.
  const contentStyle = useAnimatedStyle(() => {
    const {width: w, height: h} = screen.value;
    const p = progress.value;
    if (p === 0) {
      return {width: w, height: h, opacity: 1, transform: [{scale: 1}]};
    }
    const startScale =
      reducedMotion || !origin.value ? 1 : origin.value.width / w;
    return {
      width: w,
      height: h,
      opacity: interpolate(p, [0.1, 0.45], [0, 1], Extrapolation.CLAMP),
      transform: [{scale: interpolate(p, [0, 1], [startScale, 1])}],
    };
  });

  // The mini player's own material at the start, so the surface's first frame
  // matches the capsule it sits on, then the player background.
  const glassStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.05, 0.3],
      [0, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));
  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.05, 0.3],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * BACKDROP_OPACITY,
  }));

  const isOpen = sheetMode === 'full';

  return (
    <PlayerDismissProvider value={dismissApi}>
      <Animated.View
        pointerEvents="none"
        style={[styles.backdrop, backdropStyle]}
      />
      {/* Closed, the surface stays mounted off-screen: keep screen readers
          out of it, and out of the app behind it while it's open. */}
      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
        accessibilityElementsHidden={!isOpen}
        importantForAccessibility={isOpen ? 'auto' : 'no-hide-descendants'}
        accessibilityViewIsModal={isOpen}
        style={[styles.frame, frameStyle]}>
        {USE_GLASS ? (
          <Animated.View style={[StyleSheet.absoluteFill, glassStyle]}>
            <GlassView
              style={StyleSheet.absoluteFill}
              glassEffectStyle="regular"
              colorScheme={glassColorScheme}
            />
          </Animated.View>
        ) : (
          <Animated.View style={[StyleSheet.absoluteFill, glassStyle]}>
            <FrostedView style={StyleSheet.absoluteFill} />
          </Animated.View>
        )}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {backgroundColor: theme.colors.background},
            backgroundStyle,
          ]}
        />
        <Animated.View style={[styles.content, contentStyle]}>
          <PlayerBody />
        </Animated.View>
      </Animated.View>
    </PlayerDismissProvider>
  );
};

/** No mini player to grow from (e.g. a deep link): slide up from below. */
function fallbackOrigin(width: number, height: number): PlayerOrigin {
  'worklet';
  return {x: 0, y: height, width, height, radius: SCREEN_CORNER_RADIUS};
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000',
    zIndex: 2000,
    elevation: 20,
  },
  frame: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
    borderCurve: 'continuous',
    zIndex: 2000,
    elevation: 20,
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: 'left top',
  },
});
