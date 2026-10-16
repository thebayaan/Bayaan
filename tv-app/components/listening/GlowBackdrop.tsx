import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import Svg, {Defs, Ellipse, RadialGradient, Rect, Stop} from 'react-native-svg';
import {surahGlow} from '../../theme/surahColors';
import {colors} from '../../theme/colors';

type Props = {
  surahNumber: number;
  /** 0..1, how far the scrim darkens. */ dim?: number;
};

// Three soft pools of the surah's palette, laid out like the approved design:
// left, top right and bottom middle, in a 100x100 viewBox stretched to fill.
const POOLS = [
  {cx: 25, cy: 50, rx: 34, ry: 46, opacity: 0.38},
  {cx: 75, cy: 28, rx: 34, ry: 44, opacity: 0.3},
  {cx: 58, cy: 92, rx: 36, ry: 38, opacity: 0.2},
] as const;

/**
 * The listening room's background: the surah's color field drifting slowly
 * under a dark vignette, so the screen is calm enough to leave on for an hour
 * and still reads as this surah.
 */
export function GlowBackdrop({
  surahNumber,
  dim = 0,
}: Props): React.ReactElement {
  const palette = surahGlow(surahNumber);
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 24000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 24000,
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
    outputRange: [-30, 30],
  });
  const translateY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [16, -16],
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
                id={`glow-${i}`}
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
              fill={`url(#glow-${i})`}
            />
          ))}
        </Svg>
      </Animated.View>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="glow-scrim" cx="50%" cy="50%" r="75%">
            <Stop
              offset="0"
              stopColor={colors.background}
              stopOpacity={0.35 + dim * 0.4}
            />
            <Stop
              offset="1"
              stopColor={colors.background}
              stopOpacity={0.85 + dim * 0.12}
            />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow-scrim)" />
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
