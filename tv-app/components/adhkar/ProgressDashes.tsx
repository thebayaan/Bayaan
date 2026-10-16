import React from 'react';
import {View} from 'react-native';
import {colors} from '../../theme/colors';
import {createScaledStyles} from '../../theme/scale';

type Props = {
  total: number;
  /** The dhikr on screen. */
  index: number;
  /** Which adhkar are complete. */
  done: readonly boolean[];
};

/** Past this many adhkar the dashes would be slivers; draw one line instead. */
const MAX_DASHES = 40;

/**
 * One dash per dhikr: complete ones in cream, the current one in sky, the
 * rest faint. Long lists (the 99 Names) get a single progress line.
 */
export function ProgressDashes({
  total,
  index,
  done,
}: Props): React.ReactElement {
  if (total > MAX_DASHES) {
    const progress = total > 0 ? (index + 1) / total : 0;
    return (
      <View style={styles.track}>
        <View style={[styles.line, {flex: progress}]} />
        <View style={{flex: 1 - progress}} />
      </View>
    );
  }
  return (
    <View style={styles.row}>
      {Array.from({length: total}, (_, i) => (
        <View
          key={i}
          style={[
            styles.dash,
            {
              backgroundColor:
                i === index
                  ? colors.accent
                  : done[i]
                    ? colors.textSecondary
                    : colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = createScaledStyles({
  row: {flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center'},
  dash: {flex: 1, height: 4, borderRadius: 2},
  track: {
    flex: 1,
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  line: {backgroundColor: colors.accent, borderRadius: 2},
});
