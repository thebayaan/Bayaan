import React from 'react';
import {Text, View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';

type Props = {
  count: number;
  target: number;
  /** Ring diameter in design px. */
  size?: number;
  /** The reader's stage has focus (OK counts): a cream disc, ink numerals. */
  focused?: boolean;
};

const STROKE = 6;

/**
 * The tasbeeh counter: "34 of 100" inside a sky ring that fills as you
 * count. Focused, the inside fills cream with ink numerals (Ink & Cream), so
 * it is plain that OK counts.
 */
export function CountRing({
  count,
  target,
  size = 156,
  focused = false,
}: Props): React.ReactElement {
  const d = scale(size);
  const stroke = scale(STROKE);
  const r = (d - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = target > 0 ? Math.min(1, count / target) : 0;
  const done = count >= target;
  return (
    <View
      style={{width: d, height: d}}
      accessible
      accessibilityLabel={`${count} of ${target}`}>
      <Svg width={d} height={d} style={{transform: [{rotate: '-90deg'}]}}>
        <Circle
          cx={d / 2}
          cy={d / 2}
          r={r}
          stroke={colors.border}
          strokeWidth={stroke}
          fill="none"
        />
        {focused ? (
          <Circle
            cx={d / 2}
            cy={d / 2}
            r={r - stroke * 1.5}
            fill={colors.focusFill}
          />
        ) : null}
        <Circle
          cx={d / 2}
          cy={d / 2}
          r={r}
          stroke={done ? colors.text : colors.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.count, focused && styles.inkCount]}>{count}</Text>
        <Text style={[styles.of, focused && styles.inkOf]}>
          {`of ${target}`}
        </Text>
      </View>
    </View>
  );
}

const styles = createScaledStyles({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 46,
    lineHeight: 52,
  },
  of: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 18,
  },
  inkCount: {color: colors.onFocus},
  inkOf: {color: colors.onFocus, opacity: 0.7},
});
