// @ai-start
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AccessibilityActionEvent,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {runOnJS} from 'react-native-worklets';
import {moderateScale} from 'react-native-size-matters';
import {useTranslation} from 'react-i18next';
import {localizeDigits} from '@/i18n/format';
import {ayahAt, type MomentClip} from '@/services/moments/buildMoment';
import {
  clampToClip,
  clipProgress,
  formatClipTime,
  followsSeek,
  ratioToClipMs,
  xToRatio,
} from '@/services/moments/scrub';

interface MomentScrubberProps {
  clip: MomentClip;
  /** Playback position in the surah file. */
  positionMs: number;
  playing: boolean;
  /** Off for cards that are not the active moment, so they cannot seek it. */
  enabled?: boolean;
  /** Seeks to a position in the surah file, already clamped to the clip. */
  onSeek: (positionMs: number) => void;
  /** The ayah under the finger while scrubbing, null when the drag ends. */
  onScrubAyah?: (ayah: number | null) => void;
}

/** Tall invisible touch area; the visible track stays thin inside it. */
const HIT_HEIGHT = 40;
const TRACK_IDLE = 2;
const TRACK_ACTIVE = 5;
const THUMB = 13;
/** Lets a drag start right at the screen edge (the bar is inset by 16). */
const EDGE_SLOP = 16;
/** Give up waiting for a seek to land after this long. */
const SETTLE_TIMEOUT_MS = 1500;
/** Bigger jumps than this snap instead of animating. */
const MAX_ANIMATED_STEP_MS = 1000;
const ACCESSIBILITY_STEP_MS = 5000;

const WHITE = '#FFFFFF';
const TRACK = 'rgba(255,255,255,0.22)';

export function MomentScrubber({
  clip,
  positionMs,
  playing,
  enabled = true,
  onSeek,
  onScrubAyah,
}: MomentScrubberProps) {
  const {t} = useTranslation('home');
  const clipRange = useMemo(
    () => ({startMs: clip.startMs, endMs: clip.endMs}),
    [clip.startMs, clip.endMs],
  );

  const trackWidth = useSharedValue(0);
  // Playback progress, animated between position updates.
  const progress = useSharedValue(clipProgress(positionMs, clipRange));
  // The finger's progress while dragging; playback updates never touch it.
  const dragProgress = useSharedValue(0);
  const dragging = useSharedValue(false);
  const touch = useSharedValue(0);
  const lastSecond = useSharedValue(-1);

  // Set on the UI thread when a seek is released, until JS has taken it, so
  // a render in between cannot pull the bar back to the old position.
  const seekPending = useSharedValue(false);

  const [dragMs, setDragMs] = useState<number | null>(null);
  const settleRef = useRef<{ms: number; at: number} | null>(null);
  const lastUpdateRef = useRef<{ms: number; at: number} | null>(null);
  const scrubAyahRef = useRef<number | null>(null);
  // Latest props for the gesture callbacks, so the gesture is not rebuilt on
  // every position update (the feed passes a new onSeek each render).
  const clipRef = useRef(clip);
  clipRef.current = clip;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const onScrubAyahRef = useRef(onScrubAyah);
  onScrubAyahRef.current = onScrubAyah;

  const reportAyah = useCallback((ayah: number | null) => {
    if (ayah === scrubAyahRef.current) return;
    scrubAyahRef.current = ayah;
    onScrubAyahRef.current?.(ayah);
  }, []);

  // Follow playback, unless a drag is holding the bar or a seek has not
  // landed yet (stale updates would make the bar jump back).
  useEffect(() => {
    if (!enabled) {
      // Not the active moment any more: drop any seek in flight.
      settleRef.current = null;
      lastUpdateRef.current = null;
      reportAyah(null);
      progress.value = clipProgress(positionMs, clipRange);
      return;
    }
    if (dragging.value || seekPending.value) return;
    const now = Date.now();
    const settle = settleRef.current;
    if (settle) {
      const elapsed = now - settle.at;
      if (elapsed < SETTLE_TIMEOUT_MS) {
        if (!followsSeek(positionMs, settle.ms, elapsed)) return;
        // The caption follows the accepted positions, not the raw ones,
        // until the seek has surely landed.
        reportAyah(ayahAt(clipRef.current, positionMs));
      } else {
        settleRef.current = null;
        reportAyah(null);
      }
    }
    const next = clipProgress(positionMs, clipRange);
    const last = lastUpdateRef.current;
    lastUpdateRef.current = {ms: positionMs, at: now};
    const step = last ? positionMs - last.ms : Infinity;
    if (last && playing && step > 0 && step < MAX_ANIMATED_STEP_MS) {
      // Glide over the gap until the next update instead of stepping.
      const duration = Math.min(250, Math.max(50, now - last.at));
      progress.value = withTiming(next, {duration, easing: Easing.linear});
    } else {
      progress.value = next;
    }
  }, [
    positionMs,
    playing,
    enabled,
    clipRange,
    dragging,
    seekPending,
    progress,
    reportAyah,
  ]);

  const updateDrag = useCallback(
    (ms: number) => {
      setDragMs(ms);
      reportAyah(ayahAt(clipRef.current, ms));
    },
    [reportAyah],
  );

  const commitSeek = useCallback(
    (ms: number) => {
      const target = clampToClip(ms, clipRef.current);
      settleRef.current = {ms: target, at: Date.now()};
      lastUpdateRef.current = null;
      seekPending.value = false;
      setDragMs(null);
      // Show the target ayah right away (this also covers tap-to-seek); it
      // is dropped once playback has surely moved there.
      reportAyah(ayahAt(clipRef.current, target));
      onSeekRef.current(target);
    },
    [seekPending, reportAyah],
  );

  const cancelDrag = useCallback(() => {
    setDragMs(null);
    if (!settleRef.current) reportAyah(null);
  }, [reportAyah]);

  const gesture = useMemo(() => {
    const range = clipRange;
    const reportDrag = (ratio: number) => {
      'worklet';
      const ms = ratioToClipMs(ratio, range);
      const second = Math.floor((ms - range.startMs) / 1000);
      if (second !== lastSecond.value) {
        lastSecond.value = second;
        runOnJS(updateDrag)(ms);
      }
    };
    // Horizontal drags only, so a vertical swipe that starts on the bar
    // still scrolls the feed.
    const pan = Gesture.Pan()
      .enabled(enabled)
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .hitSlop({left: EDGE_SLOP, right: EDGE_SLOP})
      .onBegin(() => {
        touch.value = withTiming(1, {duration: 120});
      })
      .onStart(e => {
        dragging.value = true;
        lastSecond.value = -1;
        dragProgress.value = xToRatio(e.x, trackWidth.value);
        reportDrag(dragProgress.value);
      })
      .onUpdate(e => {
        dragProgress.value = xToRatio(e.x, trackWidth.value);
        reportDrag(dragProgress.value);
      })
      .onEnd((_e, success) => {
        if (!success) return;
        seekPending.value = true;
        progress.value = dragProgress.value;
        runOnJS(commitSeek)(ratioToClipMs(dragProgress.value, range));
      })
      .onFinalize((_e, success) => {
        const wasDragging = dragging.value;
        dragging.value = false;
        touch.value = withTiming(0, {duration: 180});
        if (wasDragging && !success) runOnJS(cancelDrag)();
      });
    const tap = Gesture.Tap()
      .enabled(enabled)
      .hitSlop({left: EDGE_SLOP, right: EDGE_SLOP})
      .onEnd((e, success) => {
        if (!success) return;
        const ratio = xToRatio(e.x, trackWidth.value);
        seekPending.value = true;
        progress.value = ratio;
        runOnJS(commitSeek)(ratioToClipMs(ratio, range));
      });
    return Gesture.Race(pan, tap);
  }, [
    clipRange,
    enabled,
    seekPending,
    updateDrag,
    commitSeek,
    cancelDrag,
    touch,
    dragging,
    dragProgress,
    progress,
    trackWidth,
    lastSecond,
  ]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      trackWidth.value = e.nativeEvent.layout.width;
    },
    [trackWidth],
  );

  const trackStyle = useAnimatedStyle(() => {
    const h = interpolate(touch.value, [0, 1], [TRACK_IDLE, TRACK_ACTIVE]);
    return {height: h, borderRadius: h / 2};
  });
  const fillStyle = useAnimatedStyle(() => ({
    width: `${(dragging.value ? dragProgress.value : progress.value) * 100}%`,
  }));
  const thumbStyle = useAnimatedStyle(() => {
    const p = dragging.value ? dragProgress.value : progress.value;
    return {
      opacity: touch.value,
      transform: [
        {translateX: p * trackWidth.value - THUMB / 2},
        {scale: interpolate(touch.value, [0, 1], [0.4, 1])},
      ],
    };
  });

  const onAccessibilityAction = useCallback(
    (e: AccessibilityActionEvent) => {
      if (!enabled) return;
      const {actionName} = e.nativeEvent;
      if (actionName === 'increment') {
        commitSeek(positionMs + ACCESSIBILITY_STEP_MS);
      } else if (actionName === 'decrement') {
        commitSeek(positionMs - ACCESSIBILITY_STEP_MS);
      }
    },
    [commitSeek, positionMs, enabled],
  );

  const totalMs = clip.endMs - clip.startMs;
  const timeLabel = (ms: number) =>
    t('moments.scrubTime', {
      elapsed: localizeDigits(formatClipTime(ms - clip.startMs)),
      total: localizeDigits(formatClipTime(totalMs)),
    });

  return (
    <View style={styles.container}>
      {dragMs !== null && (
        <View style={styles.timeWrap} pointerEvents="none">
          <Text style={styles.time}>{timeLabel(dragMs)}</Text>
        </View>
      )}
      <GestureDetector gesture={gesture}>
        <View
          style={styles.hitArea}
          onLayout={onLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('moments.seek')}
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(clipProgress(positionMs, clipRange) * 100),
            text: timeLabel(clampToClip(positionMs, clipRange)),
          }}
          accessibilityActions={[{name: 'increment'}, {name: 'decrement'}]}
          onAccessibilityAction={onAccessibilityAction}>
          <Animated.View style={[styles.track, trackStyle]}>
            <Animated.View style={[styles.fill, fillStyle]} />
          </Animated.View>
          <Animated.View
            style={[styles.thumb, thumbStyle]}
            pointerEvents="none"
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // The hit area reaches into the card's bottom padding, so the visible
    // track sits about where it always did. It still stops short of the
    // bottom inset, clear of the tab bar.
    marginBottom: -8,
  },
  hitArea: {
    height: HIT_HEIGHT,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_IDLE,
    borderRadius: TRACK_IDLE / 2,
    backgroundColor: TRACK,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: WHITE,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: (HIT_HEIGHT - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: WHITE,
  },
  timeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: HIT_HEIGHT + moderateScale(6),
    alignItems: 'center',
  },
  time: {
    overflow: 'hidden',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(5),
    borderRadius: moderateScale(10),
    backgroundColor: 'rgba(0,0,0,0.6)',
    fontFamily: 'Manrope-Bold',
    fontSize: moderateScale(17),
    color: WHITE,
    fontVariant: ['tabular-nums'],
  },
});
// @ai-end
