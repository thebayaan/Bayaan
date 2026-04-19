// tv-app/components/player/Scrubber.tsx
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors} from '../../theme/colors';
import {spacing} from '../../theme/spacing';

type Props = {positionSeconds: number; durationSeconds: number};

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function Scrubber({
  positionSeconds,
  durationSeconds,
}: Props): React.ReactElement {
  const progress =
    durationSeconds > 0 ? Math.min(1, positionSeconds / durationSeconds) : 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={[styles.fill, {width: `${progress * 100}%`}]} />
        <View style={[styles.thumb, {left: `${progress * 100}%`}]} />
      </View>
      <View style={styles.row}>
        <Text style={styles.time}>{fmt(positionSeconds)}</Text>
        <Text style={styles.time}>{fmt(durationSeconds)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: 90},
  track: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 4,
    backgroundColor: colors.text,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.text,
  },
  row: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 6},
  time: {color: colors.text, fontSize: 11, opacity: 0.55},
});
