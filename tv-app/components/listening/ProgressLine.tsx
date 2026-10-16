import React from 'react';
import {View} from 'react-native';
import {colors} from '../../theme/colors';
import {createScaledStyles} from '../../theme/scale';

type Props = {
  /** 0..1 */
  progress: number;
  /** Verse starts as fractions of the track; drawn as ticks when given. */
  ticks?: number[];
  thick?: boolean;
};

/** Progress bar in brand sky, with optional verse ticks. */
export function ProgressLine({
  progress,
  ticks,
  thick,
}: Props): React.ReactElement {
  const pct = `${Math.max(0, Math.min(1, progress)) * 100}%` as const;
  // A tick per verse turns into a smear on long surahs, so only draw them
  // while they stay at least a few pixels apart.
  const showTicks = ticks && ticks.length > 0 && ticks.length <= 120;
  return (
    <View style={[styles.track, thick && styles.trackThick]}>
      <View style={[styles.fill, {width: pct}]} />
      {showTicks
        ? ticks.map((t, i) => (
            <View key={i} style={[styles.tick, {left: `${t * 100}%`}]} />
          ))
        : null}
    </View>
  );
}

const styles = createScaledStyles({
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(244,243,236,0.18)',
    overflow: 'hidden',
    flex: 1,
  },
  trackThick: {height: 8, borderRadius: 4},
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.accent,
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(5,11,16,0.7)',
  },
});
