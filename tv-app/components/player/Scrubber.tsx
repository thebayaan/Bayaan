import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Pressable,
  Text,
  TVFocusGuideView,
  useTVEventHandler,
  View,
} from 'react-native';
import type {HWEvent} from 'react-native';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {colors} from '../../theme/colors';
import {spacing} from '../../theme/spacing';
import {createScaledStyles} from '../../theme/scale';

const SCRUBBER_STEP_SECONDS = 10;

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) return '0:00';
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function Scrubber(): React.ReactElement {
  const positionSeconds = useTVPlayerStore(s => s.positionSeconds);
  const durationSeconds = useTVPlayerStore(s => s.durationSeconds);
  const status = useTVPlayerStore(s => s.status);
  const speed = useTVPlayerStore(s => s.speed);
  const seekBy = useTVPlayerStore(s => s.seekBy);
  const toggle = useTVPlayerStore(s => s.toggle);
  const anim = useRef(new Animated.Value(positionSeconds)).current;

  // Track focus in a ref so the remote handler always reads the live value
  // regardless of how the TV event subscription is memoized.
  const focusedRef = useRef(false);
  const [focused, setFocused] = useState(false);

  // While the scrubber holds focus, Left/Right seek by a fixed step. The
  // wrapping guide traps horizontal focus so these presses reach this handler
  // instead of moving focus; Up/Down are not trapped, so they still escape to
  // the Back button (above) and the transport controls (below).
  const handleSeekEvent = useCallback(
    (event: HWEvent): void => {
      if (!focusedRef.current) return;
      if (event.eventType === 'right') seekBy(SCRUBBER_STEP_SECONDS);
      else if (event.eventType === 'left') seekBy(-SCRUBBER_STEP_SECONDS);
    },
    [seekBy],
  );
  useTVEventHandler(handleSeekEvent);

  useEffect(() => {
    anim.stopAnimation();
    anim.setValue(positionSeconds);
    if (
      status === 'playing' &&
      durationSeconds > 0 &&
      speed > 0 &&
      positionSeconds < durationSeconds
    ) {
      const remainingMs = ((durationSeconds - positionSeconds) / speed) * 1000;
      Animated.timing(anim, {
        toValue: durationSeconds,
        duration: remainingMs,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    }
    return () => anim.stopAnimation();
  }, [anim, positionSeconds, durationSeconds, status, speed]);

  const maxRange = useMemo(
    () => Math.max(durationSeconds, 1),
    [durationSeconds],
  );
  const widthPct = anim.interpolate({
    inputRange: [0, maxRange],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <TVFocusGuideView trapFocusLeft trapFocusRight style={styles.wrap}>
      <Pressable
        onPress={toggle}
        onFocus={() => {
          focusedRef.current = true;
          setFocused(true);
        }}
        onBlur={() => {
          focusedRef.current = false;
          setFocused(false);
        }}
        accessibilityLabel="Seek bar. Left and right to seek, select to play or pause."
        style={styles.hit}>
        <View style={[styles.track, focused && styles.trackFocused]}>
          <Animated.View style={[styles.fill, {width: widthPct}]} />
          <Animated.View
            style={[
              styles.thumb,
              focused && styles.thumbFocused,
              {left: widthPct},
            ]}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.time}>{fmt(positionSeconds)}</Text>
          <Text style={styles.time}>{fmt(durationSeconds)}</Text>
        </View>
      </Pressable>
    </TVFocusGuideView>
  );
}

const TRACK_H = 6;
const THUMB = 18;

const styles = createScaledStyles({
  wrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 220,
  },
  hit: {paddingVertical: 12},
  trackFocused: {
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  thumbFocused: {
    width: THUMB + 8,
    height: THUMB + 8,
    borderRadius: (THUMB + 8) / 2,
    top: -(THUMB + 8 - TRACK_H) / 2,
    marginLeft: -(THUMB + 8) / 2,
  },
  track: {
    height: TRACK_H,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: TRACK_H / 2,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: TRACK_H,
    backgroundColor: colors.text,
    borderRadius: TRACK_H / 2,
  },
  thumb: {
    position: 'absolute',
    top: -(THUMB - TRACK_H) / 2,
    marginLeft: -THUMB / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.text,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  time: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.65,
    letterSpacing: 0.5,
  },
});
