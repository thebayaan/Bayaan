// @ai-generated
import React, {useCallback, useMemo} from 'react';
import {
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type ScrollViewInstance,
} from 'react-native';
import {useSharedValue, type SharedValue} from 'react-native-reanimated';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {appLayoutDirection, forceLTR} from '@/utils/rtl';

export interface SurfaceMotion {
  /** Morph progress: 0 = on the mini player's rect, 1 = full screen. */
  progress: SharedValue<number>;
  onDragStart: () => void;
  onDragUpdate: (translationY: number) => void;
  onDragEnd: (velocityY: number) => void;
}

/**
 * Scroll component for the Mushaf / queue FlashLists inside the surface. A
 * downward drag that starts with the list at its top hands off to the
 * surface's dismiss; any other drag scrolls the list as usual. Imperative
 * scrollToIndex / scrollToOffset calls reach the native list directly.
 */
export function createSurfaceScrollable(motion: SurfaceMotion) {
  const SurfaceScrollable = React.forwardRef<
    ScrollViewInstance,
    ScrollViewProps
  >((props, ref) => {
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
          // app direction, so scroll offsets mean the same in RTL.
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
  });
  SurfaceScrollable.displayName = 'SurfaceScrollable';
  return SurfaceScrollable;
}
