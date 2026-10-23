// @ai-generated
import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
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
  type SharedValue,
} from 'react-native-reanimated';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {GlassView} from 'expo-glass-effect';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {FrostedView} from '@/components/FrostedView';
import {ReciterImage} from '@/components/ReciterImage';
import {
  measureMiniPlayerAnchor,
  registerPlayerSheetController,
  unregisterPlayerSheetController,
  type PlayerOrigin,
  type PlayerRect,
  type PlayerSheetController,
} from '@/services/player/sheetRef';
import {appLayoutDirection, forceLTR} from '@/utils/rtl';
import {PlayerBody} from '../PlayerBody';
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

interface SurfaceMotion {
  /** Morph progress: 0 = on the mini player's rect, 1 = full screen. */
  progress: SharedValue<number>;
  onDragStart: () => void;
  onDragUpdate: (translationY: number) => void;
  onDragEnd: (velocityY: number) => void;
}

/**
 * Scroll component for the Mushaf / queue FlashLists inside the surface. A
 * downward drag that starts with the list at its top hands off to the
 * surface's dismiss; any other drag scrolls the list as usual. Unlike gorhom's
 * scrollable it never intercepts imperative scrollToIndex / scrollToOffset.
 */
function createSurfaceScrollable(motion: SurfaceMotion) {
  const SurfaceScrollable = React.forwardRef<ScrollView, ScrollViewProps>(
    (props, ref) => {
      const {onScroll, style, contentContainerStyle} = props;
      const scrollY = useSharedValue(0);
      const touchStartY = useSharedValue(0);

      const gesture = useMemo(() => {
        const native = Gesture.Native();
        const pan = Gesture.Pan()
          .manualActivation(true)
          .onTouchesDown(e => {
            touchStartY.value = e.allTouches[0]?.absoluteY ?? 0;
          })
          .onTouchesMove((e, manager) => {
            const touch = e.allTouches[0];
            if (!touch) return;
            const dy = touch.absoluteY - touchStartY.value;
            if (Math.abs(dy) < 10) return;
            if (dy > 0 && scrollY.value <= 0) {
              manager.activate();
            } else {
              manager.fail();
            }
          })
          .onStart(motion.onDragStart)
          .onUpdate(e => motion.onDragUpdate(e.translationY))
          .onEnd(e => motion.onDragEnd(e.velocityY))
          .simultaneousWithExternalGesture(native);
        return Gesture.Simultaneous(native, pan);
      }, [scrollY, touchStartY]);

      const handleScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          scrollY.value = e.nativeEvent.contentOffset.y;
          onScroll?.(e);
        },
        [onScroll, scrollY],
      );

      return (
        <GestureDetector gesture={gesture}>
          <ScrollView
            ref={ref}
            {...props}
            // Keep the native viewport LTR and let the content inherit the
            // app direction, matching the gorhom scrollable.
            style={[style, forceLTR]}
            contentContainerStyle={[contentContainerStyle, appLayoutDirection]}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            // The pull-down at the top belongs to the dismiss, not a bounce.
            bounces={false}
            overScrollMode="never"
          />
        </GestureDetector>
      );
    },
  );
  SurfaceScrollable.displayName = 'SurfaceScrollable';
  return SurfaceScrollable;
}

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
  const currentTrack = usePlayerStore(
    s => s.queue.tracks?.[s.queue.currentIndex ?? -1],
  );

  const progress = useSharedValue(0);
  const dragStartProgress = useSharedValue(0);
  // Where progress is heading, so a JS-side sheetMode change doesn't restart
  // (and drop the velocity of) an animation a gesture already started.
  const target = useSharedValue(0);
  const origin = useSharedValue<PlayerOrigin | null>(null);
  // False while a swipe-up from the mini player waits for its measurement.
  const originReady = useSharedValue(true);
  const artworkTarget = useSharedValue<PlayerRect | null>(null);
  const screen = useSharedValue({width: screenWidth, height: screenHeight});
  const contentRef = useRef<View>(null);

  useEffect(() => {
    screen.value = {width: screenWidth, height: screenHeight};
  }, [screen, screenWidth, screenHeight]);

  const settle = useCallback(
    (to: 0 | 1, velocity: number) => {
      'worklet';
      target.value = to;
      progress.value = reducedMotion
        ? withTiming(to, {duration: REDUCED_MOTION_DURATION})
        : withSpring(to, {...SPRING, velocity});
    },
    [reducedMotion, target, progress],
  );

  const open = useCallback(
    (from?: PlayerOrigin) => {
      if (target.value === 1) return;
      target.value = 1;
      const start = (o?: PlayerOrigin) => {
        origin.value = o ?? null;
        settle(1, 0);
      };
      if (from) start(from);
      else measureMiniPlayerAnchor(start);
    },
    [origin, settle, target],
  );

  const close = useCallback(() => {
    if (target.value === 0) return;
    target.value = 0;
    // Re-measure: the mini player may have moved while the player was open
    // (e.g. the iOS accessory switching between its two placements).
    measureMiniPlayerAnchor(o => {
      if (o) origin.value = o;
      settle(0, 0);
    });
  }, [origin, settle, target]);

  useEffect(() => {
    if (sheetMode === 'full') {
      open();
    } else {
      setImmersive(false);
      close();
    }
  }, [sheetMode, open, close, setImmersive]);

  const syncSheetMode = useCallback(
    (to: 0 | 1) => {
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
    dragStartProgress.value = progress.value;
  }, [progress, dragStartProgress]);

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

  const setArtworkTarget = useCallback(
    (rect: PlayerRect | null) => {
      artworkTarget.value = rect;
    },
    [artworkTarget],
  );

  const dismissApi = useMemo<PlayerDismissApi>(
    () => ({
      createDismissGesture,
      renderScrollComponent,
      artworkFlight: {progress, contentRef, setTarget: setArtworkTarget},
    }),
    [createDismissGesture, renderScrollComponent, progress, setArtworkTarget],
  );

  const frameStyle = useAnimatedStyle(() => {
    const {width: w, height: h} = screen.value;
    const p = progress.value;
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
    const startScale =
      reducedMotion || !origin.value ? 1 : origin.value.width / w;
    return {
      width: w,
      height: h,
      opacity: interpolate(p, [0.1, 0.45], [0, 1], Extrapolation.CLAMP),
      transform: [{scale: interpolate(p, [0, 1], [startScale, 1])}],
    };
  });

  // The artwork flies from the mini player's artwork to where the full
  // player's artwork is at this point of the morph (inside the moving,
  // scaling content), landing exactly on it at 1. The real artwork is
  // hidden while the copy is in flight (usePlayerArtworkTarget).
  const flightStyle = useAnimatedStyle(() => {
    const from = origin.value?.artwork;
    const to = artworkTarget.value;
    const p = progress.value;
    if (reducedMotion || !from || !to || p <= 0.001 || p >= 0.999) {
      return {opacity: 0, width: 0, height: 0};
    }
    const {width: w, height: h} = screen.value;
    const o = origin.value ?? fallbackOrigin(w, h);
    const scale = interpolate(p, [0, 1], [o.width / w, 1]);
    const landX = interpolate(p, [0, 1], [o.x, 0]) + to.x * scale;
    const landY = interpolate(p, [0, 1], [o.y, 0]) + to.y * scale;
    return {
      opacity: 1,
      width: interpolate(p, [0, 1], [from.width, to.width * scale]),
      height: interpolate(p, [0, 1], [from.height, to.height * scale]),
      borderRadius: interpolate(p, [0, 1], [from.radius, to.radius]),
      transform: [
        {translateX: interpolate(p, [0, 1], [from.x, landX])},
        {translateY: interpolate(p, [0, 1], [from.y, landY])},
      ],
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
      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
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
        <Animated.View
          ref={contentRef}
          collapsable={false}
          style={[styles.content, contentStyle]}>
          <PlayerBody />
        </Animated.View>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.flight, flightStyle]}>
        <ReciterImage
          imageUrl={currentTrack?.artwork}
          reciterName={currentTrack?.artist || ''}
          style={styles.flightImage}
        />
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
  flight: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
    zIndex: 2001,
    elevation: 21,
  },
  flightImage: {
    width: '100%',
    height: '100%',
  },
});
