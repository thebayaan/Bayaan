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

const TRACK_H = 6;
const THUMB = 18;

const styles = StyleSheet.create({
  wrap: {position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: 96},
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
