import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, Easing, StyleSheet, Text, View} from 'react-native';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {colors} from '../../theme/colors';
import {spacing} from '../../theme/spacing';

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
  const anim = useRef(new Animated.Value(positionSeconds)).current;

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
    <View style={styles.wrap}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, {width: widthPct}]} />
        <Animated.View style={[styles.thumb, {left: widthPct}]} />
      </View>
      <View style={styles.row}>
        <Text style={styles.time}>{fmt(positionSeconds)}</Text>
        <Text style={styles.time}>{fmt(durationSeconds)}</Text>
      </View>
    </View>
  );
}

const TRACK_H = 6;
const THUMB = 18;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 220,
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
