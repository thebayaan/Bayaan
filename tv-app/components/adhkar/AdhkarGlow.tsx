import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import Svg, {Defs, Ellipse, RadialGradient, Rect, Stop} from 'react-native-svg';
import {mixHex} from '../../services/adhkarBrowse';
import {colors} from '../../theme/colors';

type Props = {
  /** The list's colour. */
  color: string;
  /** 0..1, how far the scrim darkens (the closing card). */
  dim?: number;
};

// Three soft pools, like the listening room's backdrop: the list colour on
// the left, a deeper shade of it top right, a touch of sky at the bottom.
const POOLS = [
  {cx: 30, cy: 42, rx: 36, ry: 48, opacity: 0.34},
  {cx: 78, cy: 30, rx: 32, ry: 42, opacity: 0.22},
  {cx: 62, cy: 92, rx: 38, ry: 36, opacity: 0.16},
] as const;

/**
 * The adhkar reader's background: the list's colour drifting slowly under a
 * dark vignette, calm enough to leave on for the whole session.
 */
export function AdhkarGlow({color, dim = 0}: Props): React.ReactElement {
  const palette = [
    color,
    mixHex(color, colors.backgroundSecondary, 0.4),
    colors.accent,
  ];
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 26000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 26000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const translateX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-28, 28],
  });
  const translateY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [14, -14],
  });

  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View
        style={[
          styles.field,
          {transform: [{translateX}, {translateY}, {scale: 1.12}]},
        ]}>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none">
          <Defs>
            {POOLS.map((pool, i) => (
              <RadialGradient
                key={i}
                id={`adhkar-glow-${i}`}
                cx="50%"
                cy="50%"
                r="50%">
                <Stop
                  offset="0"
                  stopColor={palette[i]}
                  stopOpacity={pool.opacity}
                />
                <Stop offset="1" stopColor={palette[i]} stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>
          {POOLS.map((pool, i) => (
            <Ellipse
              key={i}
              cx={pool.cx}
              cy={pool.cy}
              rx={pool.rx}
              ry={pool.ry}
              fill={`url(#adhkar-glow-${i})`}
            />
          ))}
        </Svg>
      </Animated.View>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="adhkar-glow-scrim" cx="50%" cy="45%" r="75%">
            <Stop
              offset="0"
              stopColor={colors.background}
              stopOpacity={0.3 + dim * 0.4}
            />
            <Stop
              offset="1"
              stopColor={colors.background}
              stopOpacity={0.85 + dim * 0.12}
            />
          </RadialGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="url(#adhkar-glow-scrim)"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  field: {...StyleSheet.absoluteFillObject},
});
