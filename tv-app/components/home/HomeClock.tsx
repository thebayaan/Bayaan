import React from 'react';
import {Text, View} from 'react-native';
import {formatClockTime, formatWeekday} from '../../hooks/useClock';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

type Props = {
  /** The time to show; pass the screen's useClock() value. */
  now: Date;
};

/**
 * Time and weekday, top right, as on every approved screen. Pin it with the
 * parent's layout (Home places it absolutely); it never takes focus.
 */
export function HomeClock({now}: Props): React.ReactElement {
  return (
    <View style={styles.wrap} accessible={false} pointerEvents="none">
      <Text style={styles.time}>{formatClockTime(now)}</Text>
      <Text style={styles.day}>{formatWeekday(now)}</Text>
    </View>
  );
}

const styles = createScaledStyles({
  wrap: {alignItems: 'flex-end'},
  time: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 30,
    letterSpacing: -0.3,
  },
  day: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 19,
    marginTop: 2,
  },
});
